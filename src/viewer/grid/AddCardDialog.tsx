import React, { useState } from 'react';
import { Button, Divider, TextField, CircularProgress } from '@mui/material';
import { Box } from '@mui/material';

export type CustomCardGridSettings = { rows: number; cols: number };

export type SaveCustomCardFn = (
  cardName: string,
  imageUrl: string | null,
  file: string | null,
  gridSettings?: CustomCardGridSettings
) => void;

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: SaveCustomCardFn;
  searchForApis: (cardName: string) => Promise<void>;
}

const AddCardDialog: React.FC<AddCardDialogProps> = ({ open, onClose, onSave, searchForApis }) => {
  const [gridRows, setGridRows] = useState(1);
  const [gridCols, setGridCols] = useState(1);
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  if (!open) return null;

  const handleFileUpload = async () => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadError('');

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      setIsUploading(false);
      if (response.ok && data.success) {
        onSave(file.name, null, data.generatedId);
        setFile(null);
        return data.generatedId;
      } else {
        setUploadError(data.message || 'Ein Fehler ist beim Hochladen aufgetreten.');
        return null;
      }
    } catch (error) {
      setIsUploading(false);
      setUploadError('Ein Fehler ist beim Hochladen der Datei aufgetreten.');
      console.error('Upload error:', error);
      return null;
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
              <div className="field">
                <TextField
                  fullWidth
                  label="Rows"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={gridRows}
                  onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <div className="field">
                <TextField
                  fullWidth
                  label="Columns"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={gridCols}
                  onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={() => onSave(imageUrl.split('/').pop() || 'custom-card', imageUrl, null, { rows: gridRows, cols: gridCols })}
                fullWidth
              >
                Add URL with Grid
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
                onClick={handleFileUpload}
                disabled={!file || isUploading}
                fullWidth
              >
                {isUploading ? <CircularProgress size={24} /> : 'upload'}
              </Button>
              {uploadError && (
                <p className="help is-danger mt-2">{uploadError}</p>
              )}
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
