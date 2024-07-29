import React, { useState } from 'react';
import Button from '@mui/material/Button';
import ImageSelectDialog from '../ImageSelectDialog';
import './CardTile.css';

const CardTile = ({ card }) => {
  const [selectedSource, setSelectedSource] = useState(card.imageUrl);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getImageOptions = () => {
    return [
      {
        value: card.imageUrl,
        label: `${card.set} (${card.setNumber}) - ${card.languageCode}`,
        foreignKey: card.languageCode
      }
    ];
  };

  const handleSourceChange = (newSource) => {
    setSelectedSource(newSource);
    setDialogOpen(false);
  };

  const options = getImageOptions();

  return (
    <div className="card-tile">
      <img src={selectedSource} key={selectedSource} alt={card.name} className="card-image" />
      <Button onClick={() => setDialogOpen(true)}>Select Image</Button>
      <ImageSelectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        options={options}
        selectedSource={selectedSource}
        onSelectImage={handleSourceChange}
      />
    </div>
  );
};

export default CardTile;