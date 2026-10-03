import React from 'react';

const EyeTriangle: React.FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 160"
      className="w-full h-full"
    >
      {/* Umgedrehtes Dreieck */}
      <path
        d="M20 20 L180 20 L100 140 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Äußerer Augenring */}
      <ellipse
        cx="100"
        cy="65"
        rx="35"
        ry="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />

      {/* Pupille */}
      <circle
        cx="100"
        cy="65"
        r="8"
        fill="currentColor"
      />

      {/* Oberes Augenlid */}
      <path
        d="M65 65 Q100 35 135 65"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* Unteres Augenlid */}
      <path
        d="M65 65 Q100 95 135 65"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default EyeTriangle;
