import React from 'react';
import ClosableDialog from '../../container/ClosableDialog';
import { useTranslation } from 'react-i18next';

interface DisclaimerDialogProps {
  open: boolean;
  onClose: () => void;
}

const DisclaimerDialog: React.FC<DisclaimerDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  return (
  <ClosableDialog open={open} onClose={onClose} maxWidth="xs">
    <div style={{ maxWidth: 500, padding: 8 }}>
      <h2 style={{ color: 'var(--accent)', marginBottom: 12, fontSize: '1.5rem', fontWeight: 600 }}>{t('info.disclaimer.title')}</h2>
      <p style={{ marginBottom: 8 }}>
        {t('info.disclaimer.sources')}
      </p>
      <p style={{ marginBottom: 8 }}>
        {t('info.disclaimer.noncommercial')}
      </p>
      <p>
        {t('info.disclaimer.accept')}
      </p>
    </div>
    <div style={{ textAlign: 'right', marginTop: 16 }}>
      <button className="button" onClick={onClose}>{t('info.disclaimer.understand')}</button>
    </div>
  </ClosableDialog>
  );
};

export default DisclaimerDialog;
