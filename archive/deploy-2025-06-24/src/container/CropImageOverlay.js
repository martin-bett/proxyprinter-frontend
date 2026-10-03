import React, { useState, useEffect, useRef } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import CropRotateIcon from '@mui/icons-material/CropRotate';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { IconButton } from "@mui/material";
import { ToggleButton } from "@mui/material";
import { useCallback } from "react";
import debounce from "lodash/debounce";
import { CropSquareRounded } from "@mui/icons-material";

const CropImageOverlay = ({ selectedImage, handleCropSettings, fixedHeight }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [crop, setCrop] = useState(null); // Beginne mit `null`
  const [imageSrc, setImageSrc] = useState(null); // Bildquelle
  const [imageDimensions, setImageDimensions] = useState(null); // Natürliche Bildabmessungen
  const [loading, setLoading] = useState(false); // Ladezustand für Spinner
  const [scaleRatioX, setScaleRatioX] = useState(1); // Verhältnis für X-Achse
  const [scaleRatioY, setScaleRatioY] = useState(1); // Verhältnis für Y-Achse
  const containerRef = useRef(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 100, height: 0 });
  const [cropSettings, setCropSettings] = useState(selectedImage?.cropSettings || {});
  const debounceTimeoutRef = useRef(null);
  const [cropMode, setCropMode] = useState(false);

  useEffect(() => {
    if (selectedImage?.cropSettings) {
      setCropSettings(selectedImage.cropSettings);
    }
    if (selectedImage?.imageUrl) {
      setImageUrl(selectedImage.imageUrl);
    }
  }, [selectedImage]);

  useEffect(()=> {
    if (selectedImage) {
      if(areCropSettingsDifferent(selectedImage.cropSettings, cropSettings)){
        selectedImage.cropSettings = cropSettings;
      }
    }
  },[cropSettings])

  // Lade das Bild über den Proxy
  useEffect(() => {
    if (imageUrl) {
      setLoading(true);
      setImageSrc(null);
      setImageDimensions(null);
      fetch("/api/proxy/image", {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-Target-URL": imageUrl,
        },
      })
        .then((response) => {
          if (!response.ok) throw new Error("Fehler beim Laden des Bildes");
          return response.blob();
        })
        .then((blob) => {
          const testUrl = URL.createObjectURL(blob);
          setImageSrc(testUrl);
        })
        .catch((error) => {
          console.error("Bild konnte nicht geladen werden:", error);
          setImageSrc(null);
        })
        .finally(() => setLoading(false));
    } else {
      setImageSrc(null);
      setLoading(false);
    }
  }, [imageUrl]);

  // Berechne Skalierungsverhältnisse und initialisiere Crop
  useEffect(() => {
    console.log('cropSettingsChange');
    if (imageDimensions) {
      const scale = 1e10;

      const ratioX = ((imageDimensions.naturalWidth * scale) / (containerDimensions.width * scale));
      const ratioY = ((imageDimensions.naturalHeight * scale) / (fixedHeight * scale));

      setScaleRatioX(ratioX);
      setScaleRatioY(ratioY);

      const c = {
        unit: "px",
        x: cropSettings.offSetX / ratioX,
        y: cropSettings.offSetY / ratioY,
        width: cropSettings.width / ratioX,
        height: cropSettings.height / ratioY
      }
      // Initialisiere Crop nur einmal, wenn es nicht existiert
      if (!crop && cropSettings) {
        setCrop(c);
      }
    }
  }, [imageDimensions, fixedHeight]);

  const areCropSettingsDifferent = (currentCrop, newCrop, tolerance = 1e-1) => {
    return (
      Math.abs(currentCrop.x - newCrop.x) > tolerance ||
      Math.abs(currentCrop.y - newCrop.y) > tolerance ||
      Math.abs(currentCrop.width - newCrop.width) > tolerance ||
      Math.abs(currentCrop.height - newCrop.height) > tolerance
    );
  };


  const debouncedHandleChange = useCallback(
    debounce((field, value) => {
      console.log(`Debounced update for field: ${field}, value: ${value}`);

      if (!selectedImage) return;

      const numericValue = field === "isStretch" ? value : Number(value);
      const { width: maxWidth, height: maxHeight } = selectedImage.imageInfo;

      setCropSettings((prev) => {
        const updatedSettings = { ...prev };

        if (field === "width" || field === "height") {
          const maxValue =
            field === "width"
              ? maxWidth - prev.offSetX
              : maxHeight - prev.offSetY;

          updatedSettings[field] =
            numericValue <= 0
              ? Math.max(maxValue - 1, 0) // Wrap auf max-1 bei 0 oder weniger
              : Math.min(numericValue, maxValue); // Begrenzen auf die maximale Größe
        } else if (field === "offSetX" || field === "offSetY") {
          const maxValue = field === "offSetX" ? maxWidth : maxHeight;
          updatedSettings[field] = Math.max(0, Math.min(numericValue, maxValue));
        } else if (field === "isStretch") {
          updatedSettings.isStretch = value; // 'isStretch' als Boolean behandeln
        }

        return updatedSettings;
      });

      // Den gleichen Wert auch an selectedImage.cropSettings übertragen
      selectedImage.cropSettings = {
        ...selectedImage.cropSettings,
        [field]: numericValue,
      };
      console.log("Updated selectedImage.cropSettings:", selectedImage.cropSettings);
    }, 150), // Debouncing mit 300ms
    [selectedImage, setCropSettings]
  );

  // Wrapper-Funktion, die das Debouncing auslöst
  const handleCropSettingChange = (field, value) => {
    console.log(`Called by ${field}, value: ${value}`);
    debouncedHandleChange(field, value);
  };

  const handleCropReset = () => {
    const cropSet = {
      width: selectedImage.imageInfo.width,
      height: selectedImage.imageInfo.height,
      offSetX: 0,
      offSetY: 0,
      isStretch: true
    };
    setCropSettings(cropSet);
  };



  useEffect(() => {
    if (selectedImage && selectedImage.cropSettings) {
      setCropSettings({
        offSetX: selectedImage.cropSettings.offSetX || 0,
        offSetY: selectedImage.cropSettings.offSetY || 0,
        width: selectedImage.cropSettings.width || 0,
        height: selectedImage.cropSettings.height || 0,
        isStretch: selectedImage.cropSettings.isStretch || true
      });
    }
  }, [selectedImage]);


  // Aktualisiere CropSettings, wenn sich Crop ändert
  useEffect(() => {
    if (crop && imageDimensions) {
      // Berechne absolute Crop-Werte
      const absoluteCropSettings = {
        offSetX: crop.x * scaleRatioX,
        offSetY: crop.y * scaleRatioY,
        width: crop.width * scaleRatioX,
        height: crop.height * scaleRatioY,
        isStretch: cropSettings.isStretch,
      };

      // Verhindere mehrfache Updates
      if (
        cropSettings?.offSetX !== absoluteCropSettings.offSetX ||
        cropSettings?.offSetY !== absoluteCropSettings.offSetY ||
        cropSettings?.width !== absoluteCropSettings.width ||
        cropSettings?.height !== absoluteCropSettings.height
      ) {
        // Falls ein Timeout existiert, abbrechen
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        // Neues Timeout für den debounceten Aufruf setzen
        debounceTimeoutRef.current = setTimeout(() => {
          setCropSettings({
            ...cropSettings,
            offSetX: Math.round(absoluteCropSettings.offSetX),
            offSetY: Math.round(absoluteCropSettings.offSetY),
            width: Math.round(absoluteCropSettings.width),
            height: Math.round(absoluteCropSettings.height),
          });
          debounceTimeoutRef.current = null; // Timeout zurücksetzen
        }, 150); // Debounce-Zeit (150ms)
      }
    }

    // Cleanup bei Komponentende-Mount oder Crop-Änderung
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [crop, scaleRatioX, scaleRatioY, imageDimensions, cropSettings]);

  const measureContainerDimensions = () => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setContainerDimensions({ width: offsetWidth, height: offsetHeight });
    }
  };

  // Handle Bild geladen
  const handleImageLoad = (event) => {
    measureContainerDimensions();

    const image = event.target;
    setImageDimensions({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    });
  };

  return (
    <div>
      <div style={{fontSize: "small"}} >{selectedImage?.imageUrl}</div>
      <div className="selected-image-container">
        {selectedImage && (
          cropMode ? (
            
            <div
              ref={containerRef}
              className="cropped-image-container"
              style={{
                position: "relative",
                height: fixedHeight,
              }}
            >
              {loading && (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
              )}

              {/* Unsichtbares Bild, um natürliche Abmessungen zu berechnen */}
              {imageSrc && !imageDimensions && (
                <img
                  src={imageSrc}
                  alt="Calculating dimensions"
                  onLoad={handleImageLoad}
                  style={{ display: "none" }}
                />
              )}

              {!loading && imageSrc && crop && (
                <ReactCrop
                  style={{ height: "100%" }}
                  crop={crop}
                  onChange={(newCrop) => setCrop(newCrop)}
                >
                  <img src={imageSrc} alt="Loaded" style={{ height: "100%" }} />
                </ReactCrop>
              )}
            </div>
          ) : (

             <>
              {loading && (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              {!loading && imageSrc && (
                <img
                  src={imageSrc}
                  style={{ height: fixedHeight + 'px', margin: '10px' }}
                  alt={selectedImage.name}
                />
              )}
            </>
          )
        )}
      </div>

      <div>
        {/* Basisinformationen zur Karte */}
        {selectedImage && (
          <table style={{ margin: "10px 0", width: "100%" }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: "bold", paddingRight: 8 }}>Name:</td>
                <td>{selectedImage.name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", paddingRight: 8 }}>Set:</td>
                <td>
                  {selectedImage.set}
                  {selectedImage.setNumber ? ` (${selectedImage.setNumber})` : ""}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", paddingRight: 8 }}>API:</td>
                <td>{selectedImage.apiName}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: "bold", paddingRight: 8 }}>Sprache:</td>
                <td>{selectedImage.languageCode || "—"}</td>
              </tr>
              {selectedImage.imageInfo && (
                <tr>
                  <td style={{ fontWeight: "bold", paddingRight: 8 }}>Bildgröße:</td>
                  <td>
                    {selectedImage.imageInfo.width} × {selectedImage.imageInfo.height}
                    {selectedImage.imageInfo.fileType ? ` (${selectedImage.imageInfo.fileType})` : ""}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <label>
          <ToggleButton
            value="crop"
            selected={cropMode}
            className="button"
            onChange={() => setCropMode(!cropMode)}
            sx={{
              "&.Mui-selected": {
                backgroundColor: "rgba(0, 0, 0, 0.1)", // Farbe für den ausgewählten Zustand
              },
            }}
          >
            <CropRotateIcon />
            <p>Crop</p>
          </ToggleButton>
        </label>

        {cropMode ? (
          <div className="crop-settings">
            {selectedImage && selectedImage.cropSettings && (
              <>
                <div>
                  {['offSetX', 'offSetY'].map((field) => (
                    <label key={field}>
                      {field}:
                      <input
                        type="number"
                        value={cropSettings[field]}
                        onChange={(e) => handleCropSettingChange(field, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <div>
                  {['width', 'height'].map((field) => (
                    <label key={field}>
                      {field}:
                      <input
                        type="number"
                        value={cropSettings[field]}
                        onChange={(e) => handleCropSettingChange(field, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label key='isStretch'>
                  <IconButton
                    onClick={() => handleCropSettingChange("isStretch", !cropSettings.isStretch)}
                    sx={{
                      color: "inherit",
                      "&:hover": {
                        color: "primary.main", // Farbe beim Hover
                      },
                    }}
                  >
                    {cropSettings.isStretch ? <OpenInFullIcon /> : <CloseFullscreenIcon />}
                  </IconButton>
                </label>
                {selectedImage.imageInfo.width && selectedImage.imageInfo.height &&
                  <label key='resetSettings'>
                    <IconButton onClick={handleCropReset} className='button'><FullscreenIcon /></IconButton>
                  </label>
                }
              </>
            )}
          </div>
        ) : (
          <></>
        )}
      </div>
    </div>
  );
};

export default CropImageOverlay;
