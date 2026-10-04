import React, { useEffect, useState } from 'react';
import { Button, Divider, TextField } from '@mui/material';
import { Box } from '@mui/material';
import { CropSettings } from '../../service/ApiFactory';
import CropMask from './crop/CropMask';

/** crops: fertige Zuschnitte aus der Maske, je Zuschnitt eine Karte. Ohne crops wird das ganze Bild genommen. */
export type SaveCustomCardFn = (
  cardName: string,
  imageUrl: string | null,
  file: string | null,
  crops?: CropSettings[]
) => void;

type MaskSource =
  | { kind: 'url'; src: string; url: string }
  | { kind: 'file'; src: string; file: File };

/** Lädt ein Bild über den Backend-Proxy, falls die Seite das direkte Einbinden blockiert. */
const loadViaProxy = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/proxy/image', { headers: { 'X-Target-URL': url } });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
};

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: SaveCustomCardFn;
  searchForApis: (cardName: string) => Promise<void>;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect?: number;
}

const AddCardDialog: React.FC<AddCardDialogProps> = ({ open, onClose, onSave, searchForApis, cardAspect = 63 / 88 }) => {
  const [maskSource, setMaskSource] = useState<MaskSource | null>(null);
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Object-URLs der Vorschau wieder freigeben
  useEffect(() => {
    const src = maskSource?.src;
    return () => {
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    };
  }, [maskSource]);

  if (!open) return null;

  const openUrlMask = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setUploadError('');
    setMaskSource({ kind: 'url', src: url, url });
  };

  const openFileMask = () => {
    if (!file) return;
    setUploadError('');
    setMaskSource({ kind: 'file', src: URL.createObjectURL(file), file });
  };

  const uploadFile = async (fileToUpload: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return data.generatedId;
      }
      setUploadError(data.message || 'Ein Fehler ist beim Hochladen aufgetreten.');
      return null;
    } catch (error) {
      setUploadError('Ein Fehler ist beim Hochladen der Datei aufgetreten.');
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleConfirmCrop = async (crops: CropSettings[]) => {
    if (!maskSource) return;
    if (maskSource.kind === 'url') {
      onSave(maskSource.url.split('/').pop() || 'custom-card', maskSource.url, null, crops);
      setImageUrl('');
      setMaskSource(null);
      return;
    }
    setIsUploading(true);
    setUploadError('');
    const generatedId = await uploadFile(maskSource.file);
    setIsUploading(false);
    if (generatedId) {
      onSave(maskSource.file.name, null, generatedId, crops);
      setFile(null);
      setMaskSource(null);
    }
  };

  const handleNameSearch = async () => {
    if (!cardName) {
      alert('Bitte geben Sie einen Namen ein');
      return;
    }
    await searchForApis(cardName);
    setCardName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  if (maskSource) {
    return (
      <>
        <header className="modal-card-head">
          <p className="modal-card-title">Crop Image</p>
        </header>
        <section className="modal-card-body">
          <CropMask
            imageSrc={maskSource.src}
            cardAspect={cardAspect}
            loadFallback={maskSource.kind === 'url' ? () => loadViaProxy(maskSource.url) : undefined}
            busy={isUploading}
            error={uploadError}
            onBack={() => { setMaskSource(null); setUploadError(''); }}
            onConfirm={handleConfirmCrop}
          />
        </section>
      </>
    );
  }

  return (
    <>

      <header className="modal-card-head">
        <p className="modal-card-title">Add Custom Card</p>
      </header>
      <Box
        sx={{
          display: 'flex', // Verwende Flexbox
          justifyContent: 'space-between', // Abstand zwischen den divs
          alignItems: 'center', // Zentriere vertikal
          gap: 2 // Abstand zwischen den divs
        }}
      >
          <section className="modal-card-body">
            {/* Name Search Section */}
            <div className="box">
              <h3 className="title is-5">Search Apis</h3>
              <div className="field">
                <TextField
                  fullWidth
                  label="cardname"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={handleNameSearch}
                fullWidth
              >
                Search
              </Button>
            </div>

            <Divider className="my-4" />

            {/* External URL Section */}
            <div className="box">
              <h3 className="title is-5">Insert ImageUrl</h3>
              <div className="field">
                <TextField
                  fullWidth
                  label="Image URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={openUrlMask}
                disabled={!imageUrl.trim()}
                fullWidth
              >
                Next: crop
              </Button>
            </div>


            <Divider className="my-4" />

            {/* File Upload Section */}
            <div className="box">
              <h3 className="title is-5">upload file</h3>
              <div className="field">
                <div className="file has-name is-fullwidth">
                  <label className="file-label">
                    <input
                      className="file-input"
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                    />
                    <span className="file-cta">
                      <span className="file-label">choose file...</span>
                    </span>
                    <span className="file-name">
                      {file ? file.name : 'no file chosen'}
                    </span>
                  </label>
                </div>
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={openFileMask}
                disabled={!file}
                fullWidth
              >
                Next: crop
              </Button>
            </div>

          </section>
      </Box>
      {/* <footer className="modal-card-foot is-justify-content-flex-end">
        <Button
          variant="outlined"
          onClick={onClose}
        >
          close
        </Button>
      </footer> */}
    </>
  );
};

export default AddCardDialog;
