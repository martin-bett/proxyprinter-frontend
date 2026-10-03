import React from 'react';
import ClosableDialog from '../../container/ClosableDialog';

interface DisclaimerDialogProps {
  open: boolean;
  onClose: () => void;
}

const DisclaimerDialog: React.FC<DisclaimerDialogProps> = ({ open, onClose }) => (
  <ClosableDialog open={open} onClose={onClose} maxWidth="xs">
    <div style={{ maxWidth: 500, padding: 8 }}>
      <h2 style={{ color: 'var(--accent)', marginBottom: 12, fontSize: '1.5rem', fontWeight: 600 }}>Disclaimer</h2>
      <p style={{ marginBottom: 8 }}>
        This website loads card images and information from public sources and third-party APIs. I am not responsible for the content provided by these sources. No copyright or ownership of the artwork is claimed, and all rights remain with their respective owners.
      </p>
      <p style={{ marginBottom: 8 }}>
        This project is non-commercial and intended for personal, educational, or research purposes only. No profit is made from the use of this site.
      </p>
      <p>
        By continuing, you acknowledge and accept this disclaimer.
      </p>
    </div>
    <div style={{ textAlign: 'right', marginTop: 16 }}>
      <button className="button" onClick={onClose}>I Understand</button>
    </div>
  </ClosableDialog>
);

export default DisclaimerDialog;
