import React from 'react';
import CardTile from './CardTile';

const CardGrid = ({ cards }) => {
  return (
    <div className="card-grid">
      {cards.map((card, index) => (
        <CardTile key={`${card.name}-${index}`} card={card} />
      ))}
    </div>
  );
};

export default CardGrid;