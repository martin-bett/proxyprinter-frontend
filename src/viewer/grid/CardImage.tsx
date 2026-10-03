import React, { useState, useEffect, useRef } from "react";
import { fetchImageViaProxy, imageLoaderService } from "../../service/cache/ImageLoaderService";
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { ImageInfo } from "../../service/ApiFactory";
import { CardResult } from "../../api/types/types";
import { ImageQuality, qualityCacheKey, queueImageQuality } from "../../service/quality/ImageQuality";

const RATING_LABEL: Record<ImageQuality["rating"], string> = {
  good: "gut lesbar",
  ok: "lesbar, etwas weich",
  poor: "Text vermutlich schlecht lesbar",
  unknown: "kein Text erkannt",
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

  useEffect(() => {
    if (isPermanent) {
      setIsVisible(true);
      return; // Observer nicht aktivieren!
    }
    // Intersection Observer erstellen
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        root: null, // Viewport als Bezugspunkt
        threshold: 0.1, // 10% Sichtbarkeit reicht aus
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [isPermanent]);

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

      // Hilfsfunktion für Bild laden (direkt oder via Proxy)
      const loadImage = (url: string, tryProxy = false, prevError: string | null = null) => {
        imageLoaderService.addToQueue({
          url,
          priority,
          cardInput: card,
          category: 'selectgrid',
          onLoad: (img) => {
            imageRef.current = img;
            handleLoad(img);
            renderCanvas(img);
          },
          onError: (error) => {
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
                    imageRef.current = img;
                    handleLoad(img);
                    renderCanvas(img);
                  };
                  img.onerror = () => {
                    const proxyError = "Proxy-Image-Load-Fehler";
                    setIsLoading(false);
                    const combined = [prevError, proxyError].filter(Boolean).join(" | ");
                    setLastError(combined);
                    if (onError) onError({ ...card!, error: combined });
                  };
                  img.src = proxyUrl;
                })
                .catch((proxyError) => {
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
    <div ref={containerRef} className="card-image-container">
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
        {!isLoading && quality && (
          <span
            className={`quality-dot quality-${quality.rating}`}
            title={`Druckschärfe: ${RATING_LABEL[quality.rating]} (Schärfe ${quality.sharpness.toFixed(2)}, ${quality.effectiveDpi} DPI)`}
          />
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
