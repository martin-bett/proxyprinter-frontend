import React from 'react';

interface PdfProgressDialogProps {
  open: boolean;
  progress: number;
  message: string;
}

const PdfProgressDialog: React.FC<PdfProgressDialogProps> = ({ open, progress, message }) => {
  if (!open) return null;

  return (
    <div className="dialog-overlay">
      <div className="">
        <h3>Generating PDF</h3>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progress}%` }}></div>
        </div>
        <p>{progress}%</p>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default PdfProgressDialog;
