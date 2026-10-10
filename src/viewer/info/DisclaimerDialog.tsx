import React from 'react';
import ClosableDialog from '../../container/ClosableDialog';
import { useTranslation } from 'react-i18next';

interface DisclaimerDialogProps {
  open: boolean;
  onClose: () => void;
  onOptOut?: () => void;
}

const DisclaimerDialog: React.FC<DisclaimerDialogProps> = ({ open, onClose, onOptOut }) => {
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
      <p style={{ marginBottom: 8 }}>
        {t('info.disclaimer.accept')}
      </p>
      {onOptOut && (
        <p>
          {t('info.disclaimer.operators')}{' '}
          <button type="button" className="button is-ghost is-small p-0" style={{ verticalAlign: 'baseline', height: 'auto' }}
            onClick={onOptOut}>{t('optOut.open')}</button>
        </p>
      )}
    </div>
    <div style={{ textAlign: 'right', marginTop: 16 }}>
      <button className="button" onClick={onClose}>{t('info.disclaimer.understand')}</button>
    </div>
  </ClosableDialog>
  );
};

export default DisclaimerDialog;
