import React, { useState } from 'react';

const CustomCardDialog = ({ open, onClose, onSave }) => {
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cardName) {
      alert('Please enter a card name');
      return;
    }
    onSave(cardName, imageUrl, file);
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
        <h2>Add Custom Card</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="cardName">Card Name:</label>
            <input
              type="text"
              id="cardName"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Enter card name"
              required
            />
          </div>
          <div>
            <label htmlFor="imageUrl">Image URL:</label>
            <input
              type="text"
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL"
            />
          </div>
          <div>
            <label htmlFor="imageFile">Or upload an image:</label>
            <input
              type="file"
              id="imageFile"
              onChange={handleFileChange}
              accept="image/*"
            />
          </div>
          <div className="dialog-buttons">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomCardDialog;