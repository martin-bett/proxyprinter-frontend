import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { Button, Divider, TextField } from '@mui/material';
import { Box } from '@mui/material';
import { CropSettings } from '../../service/ApiFactory';
import { CardResultsMap } from '../../api/types/types';
import CropMask from './crop/CropMask';
import { loadViaProxy } from './crop/loadViaProxy';

/** crops: fertige Zuschnitte aus der Maske, je Zuschnitt eine Karte. Ohne crops wird das ganze Bild genommen. */
export type SaveCustomCardFn = (
  cardName: string,
  imageUrl: string | null,
  file: string | null,
  crops?: CropSettings[]
) => void;

type MaskSource =
  | { kind: 'url'; src: string; url: string }
  | { kind: 'file'; src: string; file: File };

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: SaveCustomCardFn;
  /** Sucht die Karte über die aktiven APIs; ins Deck kommt sie erst mit "Add to deck". */
  searchCard: (cardName: string) => Promise<CardResultsMap>;
  onAddSearched: (results: CardResultsMap) => void;
  /** Gesetzt, wenn der Dialog einen Eintrag ohne Fund ersetzt: Name zum Vorbelegen und für den Titel. */
  replaceName?: string;
  /** Seitenverhältnis einer Karte (Breite / Höhe) aus den PDF-Einstellungen. */
  cardAspect?: number;
  /** Meldet, ob gerade die Zuschnitt-Maske offen ist (dann braucht der Dialog mehr Breite). */
  onMaskOpenChange?: (open: boolean) => void;
}

const AddCardDialog: React.FC<AddCardDialogProps> = ({ open, onClose, onSave, searchCard, onAddSearched, replaceName, cardAspect = 63 / 88, onMaskOpenChange }) => {
  const { t } = useTranslation();
  const [maskSource, setMaskSource] = useState<MaskSource | null>(null);
  const [cardName, setCardName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  // Ergebnis der letzten Namenssuche, wartet auf "Add to deck"
  const [searched, setSearched] = useState<{ name: string; results: CardResultsMap } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Beim Öffnen: Name des zu ersetzenden Eintrags vorbelegen, altes Suchergebnis verwerfen
  useEffect(() => {
    if (!open) return;
    setCardName(replaceName ?? '');
    setSearched(null);
  }, [open, replaceName]);

  // Object-URLs der Vorschau wieder freigeben
  useEffect(() => {
    const src = maskSource?.src;
    return () => {
      if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
    };
  }, [maskSource]);

  const maskOpen = maskSource !== null;
  useEffect(() => {
    onMaskOpenChange?.(maskOpen);
    return () => onMaskOpenChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskOpen]);

  if (!open) return null;

  const openUrlMask = () => {
    const url = imageUrl.trim();
    if (!url) return;
    setUploadError('');
    setMaskSource({ kind: 'url', src: url, url });
  };

  const openFileMask = () => {
    if (!file) return;
    setUploadError('');
    setMaskSource({ kind: 'file', src: URL.createObjectURL(file), file });
  };

  const uploadFile = async (fileToUpload: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.success) {
        return data.generatedId;
      }
      setUploadError(data.message || t('addCard.uploadError'));
      return null;
    } catch (error) {
      setUploadError(t('addCard.uploadFileError'));
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleConfirmCrop = async (crops: CropSettings[]) => {
    if (!maskSource) return;
    if (maskSource.kind === 'url') {
      onSave(maskSource.url.split('/').pop() || 'custom-card', maskSource.url, null, crops);
      setImageUrl('');
      setMaskSource(null);
      return;
    }
    setIsUploading(true);
    setUploadError('');
    const generatedId = await uploadFile(maskSource.file);
    setIsUploading(false);
    if (generatedId) {
      onSave(maskSource.file.name, null, generatedId, crops);
      setFile(null);
      setMaskSource(null);
    }
  };

  const handleNameSearch = async () => {
    const name = cardName.trim();
    if (!name) return;
    setIsSearching(true);
    try {
      setSearched({ name, results: await searchCard(name) });
    } finally {
      setIsSearching(false);
    }
  };

  const foundArts = searched ? Object.values(searched.results).reduce((sum, group) => sum + group.results.length, 0) : 0;
  // Ergebnis gilt nur für den gesuchten Namen; nach einer Änderung muss neu gesucht werden
  const searchCurrent = searched !== null && searched.name === cardName.trim();

  const handleAddSearched = () => {
    if (!searched || foundArts === 0) return;
    onAddSearched(searched.results);
    setSearched(null);
    setCardName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  if (maskSource) {
    return (
      <>
        <header className="modal-card-head">
          <p className="modal-card-title">{t('crop.title')}</p>
        </header>
        <section className="modal-card-body">
          <CropMask
            imageSrc={maskSource.src}
            cardAspect={cardAspect}
            loadFallback={maskSource.kind === 'url' ? () => loadViaProxy(maskSource.url) : undefined}
            busy={isUploading}
            error={uploadError}
            onBack={() => { setMaskSource(null); setUploadError(''); }}
            onConfirm={handleConfirmCrop}
          />
        </section>
      </>
    );
  }

  return (
    <>

      <header className="modal-card-head">
        <p className="modal-card-title">{replaceName !== undefined ? t('addCard.titleReplace', { name: replaceName }) : t('addCard.title')}</p>
      </header>
      <Box
        sx={{
          display: 'flex', // Verwende Flexbox
          justifyContent: 'space-between', // Abstand zwischen den divs
          alignItems: 'center', // Zentriere vertikal
          gap: 2 // Abstand zwischen den divs
        }}
      >
          <section className="modal-card-body">
            {/* Name Search Section */}
            <div className="box">
              <h3 className="title is-5">{t('addCard.searchApis')}</h3>
              <div className="field">
                <TextField
                  fullWidth
                  label={t('addCard.cardName')}
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNameSearch(); } }}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <Button
                variant={searchCurrent ? 'outlined' : 'contained'}
                color="primary"
                onClick={handleNameSearch}
                disabled={isSearching || !cardName.trim()}
                fullWidth
              >
                {isSearching ? t('addCard.searching') : searched ? t('addCard.searchAgain') : t('common.search')}
              </Button>
              {searched && (
                <div className="add-single-found" role="status">
                  <p className={foundArts === 0 ? 'has-text-danger' : undefined}>
                    {foundArts === 0
                      ? t('addCard.foundNone', { name: searched.name })
                      : t('addCard.found', { count: foundArts, name: searched.name })}
                  </p>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAddSearched}
                    disabled={foundArts === 0 || isSearching}
                    fullWidth
                  >
                    {replaceName !== undefined ? t('addCard.replaceInDeck') : t('addCard.addToDeck')}
                  </Button>
                </div>
              )}
            </div>

            <Divider className="my-4" />

            {/* External URL Section */}
            <div className="box">
              <h3 className="title is-5">{t('addCard.insertImageUrl')}</h3>
              <div className="field">
                <TextField
                  fullWidth
                  label={t('addCard.imageUrl')}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  variant="outlined"
                  size="small"
                  className="mb-3"
                />
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={openUrlMask}
                disabled={!imageUrl.trim()}
                fullWidth
              >
                {t('addCard.nextCrop')}
              </Button>
            </div>


            <Divider className="my-4" />

            {/* File Upload Section */}
            <div className="box">
              <h3 className="title is-5">{t('addCard.uploadFile')}</h3>
              <div className="field">
                <div className="file has-name is-fullwidth">
                  <label className="file-label">
                    <input
                      className="file-input"
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*"
                    />
                    <span className="file-cta">
                      <span className="file-label">{t('addCard.chooseFile')}</span>
                    </span>
                    <span className="file-name">
                      {file ? file.name : t('addCard.noFileChosen')}
                    </span>
                  </label>
                </div>
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={openFileMask}
                disabled={!file}
                fullWidth
              >
                {t('addCard.nextCrop')}
              </Button>
            </div>

          </section>
      </Box>
      {/* <footer className="modal-card-foot is-justify-content-flex-end">
        <Button
          variant="outlined"
          onClick={onClose}
        >
          close
        </Button>
      </footer> */}
    </>
  );
};

export default AddCardDialog;
