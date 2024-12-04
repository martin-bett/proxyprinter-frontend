import React, { useState, useEffect, useRef } from "react";
import { imageLoaderService } from "../../service/cache/ImageLoaderService.js";
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';

const CardImage = ({
  cardInput,
  onLoad,
  onError,
  showImageSettings,
  onlyDimensions = false,
  priority = 1,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const [card, setCard] = useState({});
  const [imageInfo, setImageInfo] = useState(null);
  const [show, setShow] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("");
  const imageRef = useRef(null); // Referenz zum geladenen Bild

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    setShow(showImageSettings ? showImageSettings : false);
  }, [showImageSettings]);

  useEffect(() => {
    setCard(cardInput);
  }, [cardInput]);

  useEffect(() => {
    if (isVisible && card && card.imageUrl) {
      setIsLoading(true);

      imageLoaderService.addToQueue({
        url: card.imageUrl,
        priority,
        cardInput: card,
        category: 'selectgrid',
        onLoad: (img) => {
          imageRef.current = img; // Bild speichern
          handleLoad(img);
          renderCanvas(img);
        },
        onError: () => {
          setIsLoading(false);
          if (onError) onError(card);
        },
        onProcessListChange: (newStatus) => {
          setStatus(newStatus);
        },
      });
    }
  }, [card, priority, isVisible]);

  // Neu rendern bei Änderung von cropSettings
  useEffect(() => {
    if (cardInput.cropSettings && imageRef.current) {
      renderCanvas(imageRef.current);
    }
  }, [cardInput.cropSettings]);

  const handleLoad = (img) => {
    const { naturalWidth, naturalHeight } = img;

    const fileType = extractFileType(card.imageUrl);

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
  };

  const extractFileType = (url) => {
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

  const renderCanvas = (img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const { offSetX = 0, offSetY = 0, width = 0, height = 0, isStretch = true } =
      card.cropSettings || {};

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
