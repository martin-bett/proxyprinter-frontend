import React, { useEffect, useState } from "react";
import { IconButton, Tab, Tabs } from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CropIcon from '@mui/icons-material/Crop';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { CropSettings } from "../service/ApiFactory";
import { CardResult } from "../api/types/types";
import CropMask from "../viewer/grid/crop/CropMask";

interface CropImageOverlayProps {
  selectedImage: CardResult | null;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect?: number;
}

type OverlayTab = 'info' | 'crop';

/** Bild über den Backend-Proxy laden, damit auch Seiten ohne Hotlinking funktionieren. */
const useProxiedImage = (imageUrl: string | undefined) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setImageSrc(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setImageSrc(null);
    fetch("/api/proxy/image", { method: "GET", cache: "no-store", headers: { "X-Target-URL": imageUrl } })
      .then((response) => {
        if (!response.ok) throw new Error("Fehler beim Laden des Bildes");
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      })
      .catch((error) => {
        console.error("Bild konnte nicht geladen werden:", error);
        // Ohne Proxy direkt versuchen
        if (!cancelled) setImageSrc(imageUrl);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageUrl]);

  return { imageSrc, loading };
};

const CropImageOverlay: React.FC<CropImageOverlayProps> = ({ selectedImage, cardAspect = 63 / 88 }) => {
  const [tab, setTab] = useState<OverlayTab>('info');
  const { imageSrc, loading } = useProxiedImage(selectedImage?.imageUrl);
  const [isStretch, setIsStretch] = useState(selectedImage?.cropSettings?.isStretch ?? true);

  useEffect(() => {
    setIsStretch(selectedImage?.cropSettings?.isStretch ?? true);
  }, [selectedImage]);

  // Zuschnitt direkt am gewählten Bild ablegen, der Dialog übernimmt es beim Schließen
  const handleCropChange = (crops: CropSettings[]) => {
    if (!selectedImage || crops.length === 0) return;
    selectedImage.cropSettings = { ...crops[0], isStretch };
  };

  const toggleStretch = () => {
    const next = !isStretch;
    setIsStretch(next);
    if (selectedImage) {
      selectedImage.cropSettings = { ...(selectedImage.cropSettings || {}), isStretch: next };
    }
  };

  const crop = selectedImage?.cropSettings;
  const hasCrop = !!crop && (crop.width || 0) > 0 && (crop.height || 0) > 0;
  const maxImageHeight = Math.round(window.innerHeight * 0.48);

  return (
    <div className="crop-image-overlay">
      <div style={{ fontSize: "small", wordBreak: "break-all" }}>{selectedImage?.imageUrl}</div>
      <Tabs value={tab} onChange={(_, value: OverlayTab) => setTab(value)} variant="fullWidth" className="crop-image-tabs">
        <Tab value="info" icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label="Info" />
        <Tab value="crop" icon={<CropIcon fontSize="small" />} iconPosition="start" label="Crop" disabled={!selectedImage} />
      </Tabs>

      {loading && (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      )}

      {selectedImage && imageSrc && tab === 'info' && (
        <>
          <div className="crop-image-preview">
            <img src={imageSrc} alt={selectedImage.name} style={{ maxHeight: maxImageHeight }} />
          </div>
          <table className="crop-image-info">
            <tbody>
              <tr><td>Name:</td><td>{selectedImage.name}</td></tr>
              <tr>
                <td>Set:</td>
                <td>{selectedImage.set}{selectedImage.setNumber ? ` (${selectedImage.setNumber})` : ""}</td>
              </tr>
              <tr><td>API:</td><td>{selectedImage.apiName}</td></tr>
              <tr><td>Sprache:</td><td>{selectedImage.languageCode || "—"}</td></tr>
              {selectedImage.imageInfo && (
                <tr>
                  <td>Bildgröße:</td>
                  <td>
                    {selectedImage.imageInfo.width} × {selectedImage.imageInfo.height}
                    {selectedImage.imageInfo.fileType ? ` (${selectedImage.imageInfo.fileType})` : ""}
                  </td>
                </tr>
              )}
              {hasCrop && (
                <tr>
                  <td>Zuschnitt:</td>
                  <td>{crop!.width} × {crop!.height} ab {crop!.offSetX || 0}, {crop!.offSetY || 0}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {selectedImage && imageSrc && tab === 'crop' && (
        <>
          <CropMask
            key={selectedImage.imageUrl}
            imageSrc={imageSrc}
            cardAspect={cardAspect}
            initialCrop={hasCrop ? crop : undefined}
            allowCut={false}
            layout="stacked"
            maxImageHeight={maxImageHeight}
            onChange={handleCropChange}
          />
          <div className="crop-image-stretch">
            <IconButton onClick={toggleStretch} sx={{ color: "inherit" }} title="Beim Druck aufs Kartenformat strecken">
              {isStretch ? <OpenInFullIcon /> : <CloseFullscreenIcon />}
            </IconButton>
            <span>{isStretch ? 'Stretch to card' : 'Keep image size'}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default CropImageOverlay;
