import React, { useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { JsonView, allExpanded, collapseAllNested, defaultStyles } from 'react-json-view-lite';
import './RawDataDialog.css';

// Eigene Klassen statt der Bibliotheks-CSS, damit die Farben dem Theme folgen.
const jsonStyles: typeof defaultStyles = {
  container: 'json-view',
  basicChildStyle: 'json-view-child',
  label: 'json-view-label',
  clickableLabel: 'json-view-label json-view-clickable',
  nullValue: 'json-view-null',
  undefinedValue: 'json-view-null',
  numberValue: 'json-view-number',
  stringValue: 'json-view-string',
  booleanValue: 'json-view-boolean',
  otherValue: 'json-view-other',
  punctuation: 'json-view-punctuation',
  expandIcon: 'json-view-icon json-view-expand',
  collapseIcon: 'json-view-icon json-view-collapse',
  collapsedContent: 'json-view-collapsed',
  noQuotesForStringValues: false,
};

type ParsedRaw = { kind: 'json'; data: object } | { kind: 'text'; text: string };

// Bei mehrseitigen Suchen sind die Antworten mit '\n' aneinandergehängt,
// manche Quellen liefern HTML statt JSON. Beides darf den Dialog nicht crashen.
export function parseRawResponse(raw: string): ParsedRaw {
  const asObject = (value: unknown): object | null =>
    value !== null && typeof value === 'object' ? (value as object) : null;
  try {
    const data = asObject(JSON.parse(raw));
    if (data) {
      return { kind: 'json', data };
    }
  } catch {
    // weiter mit seitenweisem Parsen
  }
  const lines = raw.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 1) {
    try {
      const pages = lines.map(line => JSON.parse(line));
      return { kind: 'json', data: pages };
    } catch {
      // kein JSON pro Zeile
    }
  }
  return { kind: 'text', text: raw };
}

interface RawDataDialogProps {
  rawData: string | null;
  onClose: () => void;
}

const RawDataDialog: React.FC<RawDataDialogProps> = ({ rawData, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const parsed = useMemo(() => (rawData ? parseRawResponse(rawData) : null), [rawData]);

  const handleCopy = async () => {
    if (!rawData) return;
    try {
      await navigator.clipboard.writeText(rawData);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Zwischenablage nicht verfügbar
    }
  };

  return (
    <Dialog
      open={rawData !== null}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      className="raw-data-dialog"
      TransitionProps={{ onExited: () => { setCopied(false); setExpandAll(false); } }}
    >
      <DialogTitle>
        Raw API Response
        <IconButton aria-label="Close" onClick={onClose} className="dialog-close-button">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {parsed?.kind === 'json' && (
          <JsonView
            key={expandAll ? 'expanded' : 'collapsed'}
            data={parsed.data}
            style={jsonStyles}
            shouldExpandNode={expandAll ? allExpanded : collapseAllNested}
          />
        )}
        {parsed?.kind === 'text' && <pre className="raw-data-text">{parsed.text}</pre>}
      </DialogContent>
      <DialogActions>
        {parsed?.kind === 'json' && (
          <button className="button" onClick={() => setExpandAll(prev => !prev)}>
            {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
        )}
        <button className="button" onClick={handleCopy}>
          {copied ? 'Copied ✓' : 'Copy to Clipboard'}
        </button>
        <button className="button" onClick={onClose}>Close</button>
      </DialogActions>
    </Dialog>
  );
};

export default RawDataDialog;
