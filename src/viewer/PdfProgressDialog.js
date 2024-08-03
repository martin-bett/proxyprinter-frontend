const PdfProgressDialog = ({ open, progress, message }) => {
    if (!open) return null;
  
    return (
      <div className="dialog-overlay">
        <div className="dialog-content">
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