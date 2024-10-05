import React, { useState } from 'react';

const CustomCardDialog = ({ open, onClose, onSave }) => {
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
        return data.generatedId; // Angenommen, der Server gibt die Datei-URL in der Nachricht zurück
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cardName) {
      alert('Bitte geben Sie einen Kartennamen ein');
      return;
    }

    let uploadedImageUrl;
    if (file) {
      uploadedImageUrl = await handleFileUpload();
      if (!uploadedImageUrl) {
        // Wenn der Datei-Upload fehlgeschlagen ist, nicht fortfahren
        return;
      }
    }

    onSave(cardName, imageUrl, uploadedImageUrl);
    setCardName('');
    setImageUrl('');
    setFile(null);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2>Benutzerdefinierte Karte hinzufügen</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="cardName">Kartenname:</label>
            <input
              type="text"
              id="cardName"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Kartennamen eingeben"
              required
            />
          </div>
          <div>
            <label htmlFor="imageUrl">Bild-URL:</label>
            <input
              type="text"
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Bild-URL eingeben"
            />
          </div>
          <div>
            <label htmlFor="imageFile">Oder ein Bild hochladen:</label>
            <input
              type="file"
              id="imageFile"
              onChange={handleFileChange}
              accept="image/*"
            />
          </div>
          {isUploading && <p>Wird hochgeladen...</p>}
          {uploadError && <p className="error">{uploadError}</p>}
          <div className="dialog-buttons">
            <button type="submit" disabled={isUploading}>Speichern</button>
            <button type="button" onClick={onClose}>Abbrechen</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomCardDialog;