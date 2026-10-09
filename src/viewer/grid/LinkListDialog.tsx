import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ActionButton from '../../container/inputs/ActionButton';

/** Bildadressen aus eingefügtem Text, getrennt durch Komma, Semikolon, Leerzeichen oder Zeilenumbruch. */
export function parseLinkList(text: string): string[] {
  const links = text
    .split(/[\s,;]+/)
    .map(link => link.trim())
    .filter(link => /^https?:\/\/\S+$/i.test(link));
  return Array.from(new Set(links));
}

/** Kartenname aus dem Dateinamen der Adresse, ohne Endung und Parameter. */
export function nameFromLink(link: string): string {
  const file = link.split(/[?#]/)[0].split('/').pop() || '';
  return decodeURIComponent(file).replace(/\.[a-z0-9]+$/i, '') || 'custom-card';
}

interface LinkListDialogProps {
  onSubmit: (links: string[]) => void;
}

const LinkListDialog: React.FC<LinkListDialogProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const links = parseLinkList(text);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (links.length === 0) return;
    onSubmit(links);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="title is-5">{t('grid.linkList.title')}</h3>
      <TextField
        fullWidth
        multiline
        minRows={6}
        label={t('grid.linkList.label')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        variant="outlined"
        size="small"
        className="mb-3"
      />
      <ActionButton type="submit" className="is-primary" icon={<AddIcon />} disabled={links.length === 0}>
        {t('grid.linkList.add', { count: links.length })}
      </ActionButton>
    </form>
  );
};

export default LinkListDialog;
