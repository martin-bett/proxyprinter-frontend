import React from 'react';
import ClosableDialog from '../../../container/ClosableDialog';
import { CropSettings } from '../../../service/ApiFactory';
import CropMask from './CropMask';
import { loadViaProxy } from './loadViaProxy';

interface RecropDialogProps {
  /** Bild-URL der Karte; null schließt den Dialog. */
  imageUrl: string | null;
  /** Aktueller Zuschnitt, mit dem die Maske startet. */
  cropSettings?: CropSettings;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect: number;
  onClose: () => void;
  /** Erster Zuschnitt ersetzt die Karte, weitere (Cut gallery) kommen als neue Karten dazu. */
  onApply: (crops: CropSettings[]) => void;
}

/** Zuschnitt einer eigenen Karte (Upload, Bild-URL, Galerie, Link-Liste) nachträglich ändern. */
const RecropDialog: React.FC<RecropDialogProps> = ({ imageUrl, cropSettings, cardAspect, onClose, onApply }) => (
  <ClosableDialog open={imageUrl !== null} onClose={onClose} maxWidth="lg">
    {imageUrl && (
      <>
        <header className="modal-card-head">
          <p className="modal-card-title">Crop Image</p>
        </header>
        <section className="modal-card-body">
          <CropMask
            imageSrc={imageUrl}
            cardAspect={cardAspect}
            initialCrop={cropSettings}
            loadFallback={imageUrl.startsWith('/') ? undefined : () => loadViaProxy(imageUrl)}
            backLabel="Cancel"
            onBack={onClose}
            confirmLabel={(count) => (count > 1 ? `Apply (${count} cards)` : 'Apply')}
            onConfirm={(crops) => {
              if (crops.length > 0) onApply(crops);
              onClose();
            }}
          />
        </section>
      </>
    )}
  </ClosableDialog>
);

export default RecropDialog;
