import React from 'react';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import AddLinkIcon from '@mui/icons-material/AddLink';

const AddCardButton: React.FC = () => {
  // Kartenabmessungen
  const cardWidth = 94.5; // 63 * 1.5 (50% größer)
  const cardHeight = 132; // 88 * 1.5 (50% größer)

  return (
    <>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${cardWidth} ${cardHeight}`}
      width={cardWidth}
      height={cardHeight}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Karte (Rahmen) */}
      <rect
        x="2.5"
        y="2.5"
        width={cardWidth - 5}
        height={cardHeight - 5}
        rx="5"
        ry="5"
        fill="none" // Transparenter Hintergrund
        stroke="currentColor" // Rand in Textfarbe des Themes
        strokeWidth="5"
      />
      {/* Plus-Symbol */}
      <line
        x1={cardWidth / 2}
        y1={cardHeight * 0.35} // Start etwas über der Mitte
        x2={cardWidth / 2}
        y2={cardHeight * 0.65} // Ende etwas unter der Mitte
        stroke="currentColor" // Farbe des Plus
        strokeWidth="10" // Dicke der Striche
        strokeLinecap="round" // Abgerundete Enden
      />
      <line
        x1={cardWidth * 0.35}
        y1={cardHeight / 2}
        x2={cardWidth * 0.65}
        y2={cardHeight / 2}
        stroke="currentColor" // Farbe des Plus
        strokeWidth="10" // Dicke der Striche
        strokeLinecap="round" // Abgerundete Enden
      />
    </svg>
   <div className="card-name">
    <SearchIcon/>
    <AddLinkIcon/>
    <FileUploadIcon/>
   </div>
   </>
  );
};

export default AddCardButton;
