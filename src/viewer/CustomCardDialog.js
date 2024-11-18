import React, { useState } from 'react';
import { Button, Divider, TextField, CircularProgress } from '@mui/material';

const CustomCardDialog = ({ open, onClose, onSave, searchForApis }) => {
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);
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

  const handleUrlSubmit = () => {
    if (!imageUrl) {
      alert('Bitte geben Sie eine URL ein');
      return;
    }
    onSave(imageUrl.split('/').pop() || 'custom-card', imageUrl, null);
    setImageUrl('');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  return (
    <div className="modal is-active">
      <div className="modal-background" onClick={onClose} />
      <div className="modal-card">
        <header className="modal-card-head">
          <p className="modal-card-title">Add Custom Card</p>
        </header>
        
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
                label="image url"
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
              onClick={handleUrlSubmit}
              fullWidth
            >
              add url
            </Button>
          </div>

          <Divider className="my-4" />

          {/* File Upload Section */}
          <div className="box">
            <h3 className="title is-5">upload filew</h3>
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

        <footer className="modal-card-foot is-justify-content-flex-end">
          <Button 
            variant="outlined" 
            onClick={onClose}
          >
            close
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default CustomCardDialog;