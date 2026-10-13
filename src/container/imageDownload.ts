import { CardResult } from "../api/types/types";

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

/** Endung aus dem Mime-Typ, sonst aus der URL, sonst jpg. */
const extensionOf = (mimeType: string | undefined, imageUrl: string | undefined): string => {
  const fromMime = mimeType && EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()];
  if (fromMime) return fromMime;
  const fromUrl = imageUrl?.split(/[?#]/)[0].match(/\.([a-z0-9]{3,4})$/i)?.[1]?.toLowerCase();
  if (fromUrl && Object.values(EXTENSIONS).concat('jpeg').includes(fromUrl)) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  return 'jpg';
};

/**
 * Dateiname für ein heruntergeladenes Kartenbild: "Name [SET 123, Quelle, de].jpg" ohne unerlaubte Zeichen.
 * Eckige Klammern kommen in Kartennamen nicht vor, so findet cardNameFromFileName den Namen beim Hochladen wieder.
 */
export const downloadFileName = (card: Pick<CardResult, 'name' | 'set' | 'setNumber' | 'apiName' | 'languageCode' | 'imageUrl'>, mimeType?: string): string => {
  const setPart = [card.set, card.setNumber].filter(Boolean).join(' ');
  const details = [setPart, card.apiName, card.languageCode].filter(Boolean).join(', ');
  const base = `${card.name || 'card'}${details ? ` [${details}]` : ''}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
  return `${base}.${extensionOf(mimeType, card.imageUrl)}`;
};

/** Kartenname aus einem hochgeladenen Dateinamen: ohne Endung und ohne den "[…]"-Zusatz aus downloadFileName. */
export const cardNameFromFileName = (fileName: string): string => {
  const name = fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/\s*\[[^\]]*\]$/, '').trim();
  return name || fileName;
};

/** Startet den Download einer Datei im Browser. */
export const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
