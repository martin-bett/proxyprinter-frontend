import React, { useState, useEffect, useRef } from "react";
import { fetchImageViaProxy, imageLoaderService } from "../../service/cache/ImageLoaderService";
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { ImageInfo } from "../../service/ApiFactory";
import { CardResult } from "../../api/types/types";
import { ImageQuality, qualityCacheKey, queueImageQuality } from "../../service/quality/ImageQuality";
import LanguageFlag from "../../container/LanguageFlag";

const RATING_LABEL: Record<ImageQuality["rating"], string> = {
  good: "gut lesbar",
  ok: "lesbar, etwas weich",
  poor: "Text vermutlich schlecht lesbar",
  unknown: "kein Text erkannt",
};

// Kartenformat 63 x 88 mm, damit lässt sich die Höhe aus der Breite ableiten
const CARD_ASPECT = 63 / 88;
// Laden beginnt eine Kartenhöhe vor dem sichtbaren Bereich, entladen erst ab zwei Kartenhöhen
const LOAD_MARGIN_CARDS = 1;
const UNLOAD_MARGIN_CARDS = 2;

export const QUEUE_CATEGORY_SELECT = 'selectgrid';
const QUEUE_CATEGORY_DECK = 'deckgrid';

// Nächster scrollbarer Vorfahre (z.B. das Grid im Bildauswahl-Dialog), sonst Viewport.
// Wichtig, weil rootMargin nur am root wirkt und ein scrollender Container sonst abschneidet.
const findScrollParent = (el: HTMLElement): HTMLElement | null => {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
};

export interface CardImageError extends CardResult {
  error: string;
}

interface CardImageProps {
  cardInput: CardResult;
  onLoad?: (imageInfo: ImageInfo) => void;
  onError?: (error: CardImageError) => void;
  showImageSettings?: boolean;
  onlyDimensions?: boolean;
  priority?: number;
  isPermanent?: boolean;
}

const CardImage: React.FC<CardImageProps> = ({
  cardInput,
  onLoad,
  onError,
  showImageSettings,
  onlyDimensions = false,
  priority = 1,
  isPermanent = false,
}) => {
  const [isVisible, setIsVisible] = useState(isPermanent);
  const containerRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<CardResult | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [show, setShow] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");
  const imageRef = useRef<HTMLImageElement | null>(null); // Referenz zum geladenen Bild
  const [proxyTried, setProxyTried] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [quality, setQuality] = useState<ImageQuality | null>(null);
  const qualityRun = useRef(0);
  const loadRun = useRef(0);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isPermanent) {
      setIsVisible(true);
      return; // Observer nicht aktivieren!
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const root = findScrollParent(el);
    let loadObserver: IntersectionObserver | null = null;
    let unloadObserver: IntersectionObserver | null = null;
    let observedWidth = -1;

    // Zwei Observer mit Abstand in Kartenhöhen: Laden startet schon
    // LOAD_MARGIN_CARDS Kartenhöhen vor dem sichtbaren Bereich, entladen wird erst
    // ab UNLOAD_MARGIN_CARDS Kartenhöhen. Die Lücke dazwischen verhindert Flackern.
    const setupObservers = (width: number) => {
      loadObserver?.disconnect();
      unloadObserver?.disconnect();
      observedWidth = width;
      const cardHeight = Math.max(1, Math.round(width / CARD_ASPECT));
      setPlaceholderHeight(width > 0 ? cardHeight : undefined);
      loadObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setIsVisible(true);
        },
        { root, rootMargin: `${cardHeight * LOAD_MARGIN_CARDS}px 0px`, threshold: 0 }
      );
      unloadObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) setIsVisible(false);
        },
        { root, rootMargin: `${cardHeight * UNLOAD_MARGIN_CARDS}px 0px`, threshold: 0 }
      );
      loadObserver.observe(el);
      unloadObserver.observe(el);
    };

    setupObservers(el.offsetWidth);

    // Kartengröße ändert sich (Fenster, Grid) -> Abstände neu berechnen
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const width = el.offsetWidth;
            if (width > 0 && width !== observedWidth) setupObservers(width);
          })
        : null;
    resizeObserver?.observe(el);

    return () => {
      loadObserver?.disconnect();
      unloadObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [isPermanent]);

  // Weit genug weggescrollt: Bild freigeben (der wartende Download wird beim Aufräumen des Lade-Effekts abgebrochen)
  useEffect(() => {
    if (isVisible || isPermanent || !card) return;
    qualityRun.current++;
    imageRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    setIsLoading(true);
    setStatus("");
  }, [isVisible, isPermanent, card]);

  useEffect(() => {
    setShow(showImageSettings ? showImageSettings : false);
  }, [showImageSettings]);

  useEffect(() => {
    setCard(cardInput);
  }, [cardInput]);

  useEffect(() => {
    if (isVisible && card && card.imageUrl) {
      setIsLoading(true);
      setProxyTried(false);
      setLastError(null);

      // Ergebnisse eines inzwischen entladenen Ladevorgangs ignorieren
      const run = loadRun.current;
      const stale = () => run !== loadRun.current;
      // Karte wechselt (Filter), wird entladen oder verschwindet: wartenden Queue-Eintrag zurückziehen,
      // damit er frisch eingeblendete Bilder nicht blockiert. Ein laufender Download wird trotzdem fertig.
      const abort = new AbortController();

      // Hilfsfunktion für Bild laden (direkt oder via Proxy)
      const loadImage = (url: string, tryProxy = false, prevError: string | null = null) => {
        imageLoaderService.addToQueue({
          url,
          priority,
          cardInput: card,
          category: isPermanent ? QUEUE_CATEGORY_DECK : QUEUE_CATEGORY_SELECT,
          signal: abort.signal,
          onLoad: (img) => {
            if (stale()) return;
            imageRef.current = img;
            handleLoad(img);
            renderCanvas(img);
          },
          onError: (error) => {
            if (stale()) return;
            // Lief das Bild schon über den Proxy (Feld "Proxy Images"), bringt ein zweiter Versuch nichts
            if (!tryProxy && !imageLoaderService.usesProxy(card)) {
              // Erster Versuch fehlgeschlagen, jetzt Proxy probieren
              setProxyTried(true);
              fetchImageViaProxy(url)
                .then((blob) => {
                  const proxyUrl = URL.createObjectURL(blob);
                  // Bild aus Blob laden
                  const img = new window.Image();
                  img.onload = () => {
                    if (stale()) return;
                    imageRef.current = img;
                    handleLoad(img);
                    renderCanvas(img);
                  };
                  img.onerror = () => {
                    if (stale()) return;
                    const proxyError = "Proxy-Image-Load-Fehler";
                    setIsLoading(false);
                    const combined = [prevError, proxyError].filter(Boolean).join(" | ");
                    setLastError(combined);
                    if (onError) onError({ ...card!, error: combined });
                  };
                  img.src = proxyUrl;
                })
                .catch((proxyError) => {
                  if (stale()) return;
                  setIsLoading(false);
                  const combined = [prevError, proxyError.message].filter(Boolean).join(" | ");
                  setLastError(combined);
                  if (onError) onError({ ...card!, error: combined });
                });
            } else {
              // Proxy auch fehlgeschlagen
              setIsLoading(false);
              const combined = [prevError, String(error)].filter(Boolean).join(" | ");
              setLastError(combined);
              if (onError) onError({ ...card!, error: combined });
            }
          },
          onProcessListChange: (newStatus) => {
            setStatus(newStatus);
          },
        });
      };

      // Starte mit dem normalen Bild
      loadImage(card.imageUrl, false, null);

      return () => {
        abort.abort();
        loadRun.current++;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, priority, isVisible]);

  // Neu rendern bei Änderung von cropSettings
  useEffect(() => {
    if (cardInput.cropSettings && imageRef.current) {
      renderCanvas(imageRef.current);
      measureQuality(imageRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardInput.cropSettings]);

  const handleLoad = (img: HTMLImageElement) => {
    const { naturalWidth, naturalHeight } = img;

    const fileType = extractFileType(card?.imageUrl || '');

    setImageInfo({
      width: naturalWidth,
      height: naturalHeight,
      fileType,
    });

    setIsLoading(false);

    if (onLoad) {
      onLoad({
        width: naturalWidth,
        height: naturalHeight,
        fileType,
      });
    }
    measureQuality(img);
  };

  // Schärfe/Lesbarkeit des Textfeldes schätzen und als Meta-Info nachreichen
  const measureQuality = (img: HTMLImageElement) => {
    const run = ++qualityRun.current;
    const crop = cardInput.cropSettings;
    const cacheInput = card || cardInput;
    const key = qualityCacheKey(crop);
    imageLoaderService.getCachedQuality(cacheInput, key).then(async (cached) => {
      if (run !== qualityRun.current) return;
      const result = cached || (await queueImageQuality(img, crop));
      if (run !== qualityRun.current || !result) return;
      if (!cached) imageLoaderService.saveQuality(cacheInput, key, result);
      setQuality(result);
      const info: ImageInfo = {
        width: img.naturalWidth,
        height: img.naturalHeight,
        fileType: extractFileType(card?.imageUrl || cardInput.imageUrl || ''),
        quality: result,
      };
      setImageInfo(info);
      if (onLoad) onLoad(info);
    });
  };

  const extractFileType = (url: string): string => {
    const validImageTypes = ["JPG", "JPEG", "PNG", "GIF", "WEBP", "BMP", "SVG"];
    try {
      const cleanUrl = url.split("?")[0];
      const fileType = validImageTypes.find((type) =>
        cleanUrl.toUpperCase().endsWith(type)
      );
      return fileType || "???";
    } catch (error) {
      console.error("Error extracting file type:", error);
      return "???";
    }
  };

  const renderCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { offSetX = 0, offSetY = 0, width = 0, height = 0, isStretch = true } =
      card?.cropSettings || {};

    const cropWidth = width > 0 ? width : img.naturalWidth;
    const cropHeight = height > 0 ? height : img.naturalHeight;

    let targetWidth = cropWidth;
    let targetHeight = cropHeight;

    if (isStretch) {
      const targetAspectRatio = 63 / 88;
      const currentAspectRatio = cropWidth / cropHeight;

      if (currentAspectRatio > targetAspectRatio) {
        targetWidth = cropHeight * targetAspectRatio;
      } else {
        targetHeight = cropWidth / targetAspectRatio;
      }
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      img,
      offSetX,
      offSetY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
  };

  return (
    <div
      ref={containerRef}
      className="card-image-container"
      // Kartenhöhe halten solange kein Bild da ist (entladen oder lädt), sonst springt das Grid
      style={(!isVisible || isLoading) && placeholderHeight ? { minHeight: placeholderHeight } : undefined}
    >
      <div style={{ display: isVisible ? "block" : "none" }}>
        {isLoading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ display: isLoading ? "none" : "block" }}
        />
        {!isLoading && (quality || card?.languageCode) && (
          <div className="card-badges">
            <LanguageFlag language={card?.languageCode} />
            {quality && (
              <span
                className={`quality-dot quality-${quality.rating}`}
                title={`Druckschärfe: ${RATING_LABEL[quality.rating]} (Schärfe ${quality.sharpness.toFixed(2)}, ${quality.effectiveDpi} DPI)`}
              />
            )}
          </div>
        )}
        <div className="image-info">
          {isLoading && <div className="info-row">{status}</div>}
          {imageInfo && show && (
            <>
              <div className="info-row">
                {imageInfo.width && imageInfo.height
                  ? `w${imageInfo.width} h${imageInfo.height}`
                  : "Unknown resolution"}{" "}
                ({imageInfo.fileType})
              </div>
              {quality && (
                <div className="info-row">
                  Schärfe {quality.sharpness.toFixed(2)} · {quality.effectiveDpi} DPI · {RATING_LABEL[quality.rating]}
                </div>
              )}
              {!onlyDimensions && card && (
                <>
                  {card.cropSettings && (
                    <div className="info-row">
                      offX{card.cropSettings.offSetX || 0} offY
                      {card.cropSettings.offSetY || 0} w
                      {card.cropSettings.width || 0} h
                      {card.cropSettings.height || 0}{" "}
                      {card.cropSettings.isStretch ? (
                        <OpenInFullIcon />
                      ) : (
                        <CloseFullscreenIcon />
                      )}
                    </div>
                  )}
                  <div className="info-row">{card.apiName}</div>
                  <div className="info-row">
                    {card.languageCode || "NO LANGUAGE"}
                  </div>
                  <div className="info-row">
                    {card.set
                      ? `${card.set}(${card.setNumber || "??"})`
                      : "NO SET INFO"}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CardImage;
