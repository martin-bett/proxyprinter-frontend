import React, { useEffect, useState } from "react";
import { Tab, Tabs } from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CropIcon from '@mui/icons-material/Crop';
import DownloadIcon from '@mui/icons-material/Download';
import IconButton from '@mui/material/IconButton';
import { CropSettings } from "../service/ApiFactory";
import { CardResult } from "../api/types/types";
import CropMask from "../viewer/grid/crop/CropMask";
import { fetchImageViaProxy, imageLoaderService } from "../service/cache/ImageLoaderService";
import { useTranslation } from 'react-i18next';
import { downloadFileName, saveBlob } from "./imageDownload";

interface CropImageOverlayProps {
  selectedImage: CardResult | null;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect?: number;
}

type OverlayTab = 'info' | 'crop';

/**
 * Bild für Vorschau und Zuschnitt: erst die kleine Kopie aus dem lokalen Cache (sofort da, preview),
 * dann das Original aus dem Cache bzw. über den Backend-Proxy (gleiche Origin, also ohne CORS-Probleme).
 */
export const useProxiedImage = (card: CardResult | null | undefined) => {
  const imageUrl = card?.imageUrl;
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl || !card) {
      setImageSrc(null);
      setPreviewSrc(null);
      return;
    }
    const urls: string[] = [];
    const toUrl = (blob: Blob) => {
      const u = URL.createObjectURL(blob);
      urls.push(u);
      return u;
    };
    let cancelled = false;
    setLoading(true);
    setImageSrc(null);
    setPreviewSrc(null);
    (async () => {
      const cached = await imageLoaderService.getCachedBlobs(card);
      if (cancelled) return;
      if (cached?.thumb) setPreviewSrc(toUrl(cached.thumb));
      try {
        const blob = cached?.blob || (await fetchImageViaProxy(imageUrl));
        if (cancelled) return;
        setImageSrc(toUrl(blob));
      } catch (error) {
        console.error("Image could not be loaded:", error);
        // Ohne Proxy direkt versuchen
        if (!cancelled) setImageSrc(imageUrl);
      }
    })().finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, card?.apiName, card?.name]);

  return { imageSrc, previewSrc, loading };
};

const CropImageOverlay: React.FC<CropImageOverlayProps> = ({ selectedImage, cardAspect = 63 / 88 }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<OverlayTab>('info');
  const { imageSrc, previewSrc, loading } = useProxiedImage(selectedImage);
  // Zuschnitt direkt am gewählten Bild ablegen, der Dialog übernimmt es beim Schließen
  const handleCropChange = (crops: CropSettings[]) => {
    if (!selectedImage || crops.length === 0) return;
    selectedImage.cropSettings = { ...crops[0], isStretch: selectedImage.cropSettings?.isStretch ?? true };
  };

  const crop = selectedImage?.cropSettings;
  const hasCrop = !!crop && (crop.width || 0) > 0 && (crop.height || 0) > 0;
  const maxImageHeight = Math.round(window.innerHeight * 0.48);

  const [downloading, setDownloading] = useState(false);
  // Original in voller Auflösung speichern: aus dem Cache, sonst über den Proxy; klappt beides nicht, im neuen Tab öffnen
  const handleDownload = async () => {
    if (!selectedImage?.imageUrl) return;
    setDownloading(true);
    try {
      const cached = await imageLoaderService.getCachedBlobs(selectedImage);
      const blob = cached?.blob || (await fetchImageViaProxy(selectedImage.imageUrl));
      saveBlob(blob, downloadFileName(selectedImage, blob.type));
    } catch (error) {
      console.error("Image could not be downloaded:", error);
      window.open(selectedImage.imageUrl, '_blank', 'noopener');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="crop-image-overlay">
      <div className="crop-image-header">
        <div style={{ fontSize: "small", wordBreak: "break-all" }}>{selectedImage?.imageUrl}</div>
        {selectedImage?.imageUrl && (
          <IconButton
            size="small"
            className="crop-image-download"
            aria-label={t('container.cropOverlay.download')}
            title={t('container.cropOverlay.downloadHint')}
            disabled={downloading}
            onClick={handleDownload}
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <Tabs value={tab} onChange={(_, value: OverlayTab) => setTab(value)} variant="fullWidth" className="crop-image-tabs">
        <Tab value="info" icon={<InfoOutlinedIcon fontSize="small" />} iconPosition="start" label={t('common.info')} />
        <Tab value="crop" icon={<CropIcon fontSize="small" />} iconPosition="start" label={t('container.cropOverlay.tabCrop')} disabled={!selectedImage} />
      </Tabs>

      {loading && !(tab === 'info' && previewSrc) && (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      )}

      {selectedImage && (imageSrc || previewSrc) && tab === 'info' && (
        <>
          <div className="crop-image-preview">
            <img src={imageSrc || previewSrc || undefined} alt={selectedImage.name} style={{ maxHeight: maxImageHeight }} />
          </div>
          <table className="crop-image-info">
            <tbody>
              <tr><td>{t('container.cropOverlay.name')}</td><td>{selectedImage.name}</td></tr>
              <tr>
                <td>{t('container.cropOverlay.set')}</td>
                <td>{selectedImage.set}{selectedImage.setNumber ? ` (${selectedImage.setNumber})` : ""}</td>
              </tr>
              <tr><td>{t('container.cropOverlay.api')}</td><td>{selectedImage.apiName}</td></tr>
              <tr><td>{t('container.cropOverlay.language')}</td><td>{selectedImage.languageCode || "—"}</td></tr>
              {selectedImage.imageInfo && (
                <tr>
                  <td>{t('container.cropOverlay.imageSize')}</td>
                  <td>
                    {selectedImage.imageInfo.width} × {selectedImage.imageInfo.height}
                    {selectedImage.imageInfo.fileType ? ` (${selectedImage.imageInfo.fileType})` : ""}
                  </td>
                </tr>
              )}
              {hasCrop && (
                <tr>
                  <td>{t('container.cropOverlay.crop')}</td>
                  <td>{t('container.cropOverlay.cropValue', { width: crop!.width, height: crop!.height, x: crop!.offSetX || 0, y: crop!.offSetY || 0 })}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {selectedImage && imageSrc && tab === 'crop' && (
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
      )}
    </div>
  );
};

export default CropImageOverlay;
