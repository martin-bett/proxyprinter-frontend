import i18n from '../../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RestoredState, Snapshot, WorkState, createSnapshot, customUploadIds, isEmptySnapshot, isEmptyState, overwriteSnapshot, restoreSnapshot, snapshotLabel,
} from '../../service/snapshot/snapshot';
import {
  deleteAllSnapshots, deleteSnapshot, getSnapshot, listSnapshots, putGenerateSnapshot, putSnapshot, snapshotsSize,
} from '../../service/snapshot/SnapshotStore';
import { PdfInfo, fetchPdfInfo, touchUploads } from '../../service/snapshot/snapshotBackend';
import { SnapshotSectionProps } from './SnapshotSection';

/** „Letzte Sitzung“ wird höchstens so oft geschrieben, und nur wenn sich etwas geändert hat. */
export const AUTOSAVE_INTERVAL_MS = 30 * 1000;
/** Ein frisch gestartetes PDF ist noch nicht fertig; 404 heißt dann nicht „gelöscht“. */
const PDF_PENDING_MS = 10 * 60 * 1000;
/** Merkt den aktiven Snapshot über das Neuladen hinweg, damit „Letzte Sitzung“ ihn anbietet */
const ACTIVE_KEY = 'snapshots.activeId';

const readActiveId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};

const storeActiveId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Ohne localStorage gilt der aktive Snapshot nur bis zum Neuladen
  }
};

interface Options {
  state: WorkState;
  /** Während einer Suche wird nicht gespeichert, sonst landet ein halber Stand in der Sitzung */
  isBusy: boolean;
  apply: (state: RestoredState) => void;
}

/**
 * Snapshots für den Viewer: automatische „Letzte Sitzung“ (alle 30 s und beim
 * Verlassen der Seite, nur bei Änderungen), Snapshot bei jedem Generate,
 * manuelles Speichern, Laden, Umbenennen, Löschen.
 *
 * Wurde ein Snapshot geladen oder gespeichert, ist er aktiv: Das automatische
 * Speichern überschreibt dann genau diesen Snapshot statt der „Letzten Sitzung“.
 * Neue Suche, Deck-Import und Zurücksetzen lösen ihn wieder (release).
 */
export function useSnapshots({ state, isBusy, apply }: Options) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restorable, setRestorable] = useState<Snapshot | null>(null);
  const [pdfInfos, setPdfInfos] = useState<Record<string, PdfInfo | null>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;
  const lastSessionHash = useRef<string | null>(null);
  const snapshotsRef = useRef<Snapshot[]>([]);
  snapshotsRef.current = snapshots;
  const activeIdRef = useRef<string | null>(null);
  // Inhalt des aktiven Snapshots, wie er zuletzt gespeichert wurde
  const activeHash = useRef<string | null>(null);
  // Nach dem Laden zählt der Stand, wie er im Viewer ankommt (APIs, eigene Karten können fehlen)
  const baselinePending = useRef(false);

  const setActive = useCallback((snapshot: Snapshot | null) => {
    activeIdRef.current = snapshot?.id ?? null;
    activeHash.current = snapshot?.contentHash ?? null;
    baselinePending.current = false;
    setActiveIdState(activeIdRef.current);
    storeActiveId(activeIdRef.current);
  }, []);

  useEffect(() => {
    if (!baselinePending.current) return;
    baselinePending.current = false;
    if (activeIdRef.current) activeHash.current = createSnapshot(state, 'manual').contentHash;
  }, [state]);

  const refreshList = useCallback(async () => {
    try {
      const all = await listSnapshots();
      setSnapshots(all);
      setTotalBytes(await snapshotsSize());
      return all;
    } catch (error) {
      console.error('Could not read snapshots', error);
      return [];
    }
  }, []);

  const refreshPdfInfos = useCallback(async (list: Snapshot[]) => {
    const withPdf = list.filter(s => s.pdf.generated);
    const entries = await Promise.all(withPdf.map(async s => {
      try {
        const info = await fetchPdfInfo(s.pdf.generated!.progressId);
        if (info === null && Date.now() - s.pdf.generated!.createdAt < PDF_PENDING_MS) return null;
        return [s.id, info] as const;
      } catch {
        return null;
      }
    }));
    const infos: Record<string, PdfInfo | null> = {};
    entries.forEach(entry => { if (entry) infos[entry[0]] = entry[1]; });
    setPdfInfos(infos);
  }, []);

  // Beim Start: Liste laden und die letzte Sitzung zum Wiederherstellen anbieten.
  // War zuletzt ein Snapshot aktiv, ist er die letzte Sitzung.
  useEffect(() => {
    refreshList().then(all => {
      refreshPdfInfos(all);
      const storedId = readActiveId();
      const last = all.find(s => s.id === storedId && s.kind !== 'session') ?? all.find(s => s.kind === 'session');
      if (last && !isEmptySnapshot(last) && isEmptyState(stateRef.current)) {
        setRestorable(last);
      }
    });
  }, [refreshList, refreshPdfInfos]);

  /** Aktiven Snapshot mit dem aktuellen Stand überschreiben, nur bei Änderungen */
  const saveActive = useCallback(async () => {
    const current = stateRef.current;
    const target = snapshotsRef.current.find(s => s.id === activeIdRef.current);
    if (!target || isEmptyState(current)) return;
    const updated = overwriteSnapshot(target, current);
    if (updated.contentHash === activeHash.current) return;
    activeHash.current = updated.contentHash;
    try {
      await putSnapshot(updated);
      setRestorable(null);
      const ids = customUploadIds(updated);
      if (ids.length > 0) touchUploads(ids);
      setSnapshots(list => list.map(s => (s.id === updated.id ? updated : s)).sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      activeHash.current = null;
      console.error('Could not save active snapshot', error);
    }
  }, []);

  const saveSession = useCallback(async () => {
    const current = stateRef.current;
    if (busyRef.current || isEmptyState(current)) return;
    if (activeIdRef.current) {
      await saveActive();
      return;
    }
    const snapshot = createSnapshot(current, 'session');
    if (snapshot.contentHash === lastSessionHash.current) return;
    lastSessionHash.current = snapshot.contentHash;
    try {
      await putSnapshot(snapshot);
      // Die alte Sitzung ist jetzt überschrieben, auch ein zuvor aktiver Snapshot ist nicht mehr die letzte
      setRestorable(null);
      storeActiveId(null);
      const ids = customUploadIds(snapshot);
      if (ids.length > 0) touchUploads(ids);
    } catch (error) {
      lastSessionHash.current = null;
      console.error('Could not save session snapshot', error);
    }
  }, [saveActive]);

  useEffect(() => {
    const timer = setInterval(saveSession, AUTOSAVE_INTERVAL_MS);
    // Beim Verlassen: visibilitychange kommt zuverlässiger als unload, auch auf Handys
    const onHidden = () => {
      if (document.visibilityState === 'hidden') saveSession();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', saveSession);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', saveSession);
    };
  }, [saveSession]);

  const save = useCallback(async () => {
    if (isEmptyState(stateRef.current)) return;
    const snapshot = createSnapshot(stateRef.current, 'manual');
    try {
      await putSnapshot(snapshot);
      setActive(snapshot);
      const ids = customUploadIds(snapshot);
      if (ids.length > 0) touchUploads(ids);
      setNotice(null);
      await refreshList();
    } catch (error) {
      console.error('Could not save snapshot', error);
      setNotice(i18n.t('snapshot.saveFailed'));
    }
  }, [refreshList, setActive]);

  /** Nach jedem Generate: Snapshot mit Verweis auf das PDF. Gibt den Namen für den Download zurück. */
  const saveGenerate = useCallback(async (progressId: string): Promise<string | null> => {
    if (isEmptyState(stateRef.current)) return null;
    const now = Date.now();
    const snapshot = createSnapshot(stateRef.current, 'generate', now);
    snapshot.pdf.generated = { progressId, createdAt: now };
    try {
      const saved = await putGenerateSnapshot(snapshot);
      const ids = customUploadIds(saved);
      if (ids.length > 0) touchUploads(ids);
      await refreshList();
      return snapshotLabel(saved);
    } catch (error) {
      console.error('Could not save generate snapshot', error);
      return snapshotLabel(snapshot);
    }
  }, [refreshList]);

  const load = useCallback(async (snapshot: Snapshot) => {
    // Den aktuellen Stand vorher sichern, damit Laden nichts verliert
    if (snapshot.kind !== 'session' || activeIdRef.current) await saveSession();
    const fresh = (await getSnapshot(snapshot.id).catch(() => undefined)) ?? snapshot;
    const ids = customUploadIds(fresh);
    const missing = ids.length > 0 ? await touchUploads(ids) : [];
    const { state: restored, droppedCustomCards } = restoreSnapshot(fresh, missing);
    apply(restored);
    // Die Sitzung ist kein eigener Platz; jeder andere Snapshot wird beim Weiterarbeiten überschrieben
    setActive(fresh.kind === 'session' ? null : fresh);
    baselinePending.current = activeIdRef.current !== null;
    lastSessionHash.current = null;
    setRestorable(null);
    setNotice(droppedCustomCards > 0
      ? i18n.t('snapshot.customCardsGone', { count: droppedCustomCards })
      : null);
    const all = await refreshList();
    refreshPdfInfos(all);
  }, [apply, saveSession, setActive, refreshList, refreshPdfInfos]);

  /** Ersetzt den Inhalt eines Snapshots durch den aktuellen Stand, Name bleibt */
  const overwrite = useCallback(async (snapshot: Snapshot) => {
    if (isEmptyState(stateRef.current)) return;
    const pdfNote = snapshot.pdf.generated ? '\n' + i18n.t('snapshot.pdfLinkRemoved') : '';
    if (!window.confirm(i18n.t('snapshot.confirmOverwrite', { label: snapshotLabel(snapshot) }) + pdfNote)) return;
    const updated = overwriteSnapshot(snapshot, stateRef.current);
    try {
      await putSnapshot(updated);
      setActive(updated);
      const ids = customUploadIds(updated);
      if (ids.length > 0) touchUploads(ids);
      setNotice(null);
      const all = await refreshList();
      refreshPdfInfos(all);
    } catch (error) {
      console.error('Could not overwrite snapshot', error);
      setNotice(i18n.t('snapshot.saveFailed'));
    }
  }, [refreshList, refreshPdfInfos, setActive]);

  const rename = useCallback(async (snapshot: Snapshot) => {
    const name = window.prompt(i18n.t('snapshot.namePrompt'), snapshotLabel(snapshot));
    if (name === null) return;
    const custom = name.trim();
    await putSnapshot({ ...snapshot, label: { ...snapshot.label, custom: custom || undefined } });
    await refreshList();
  }, [refreshList]);

  const remove = useCallback(async (snapshot: Snapshot) => {
    if (!window.confirm(i18n.t('snapshot.confirmDelete', { label: snapshotLabel(snapshot) }))) return;
    await deleteSnapshot(snapshot.id);
    if (snapshot.id === activeIdRef.current) setActive(null);
    await refreshList();
  }, [refreshList, setActive]);

  const removeAll = useCallback(async () => {
    if (!window.confirm(i18n.t('snapshot.confirmDeleteAll'))) return;
    await deleteAllSnapshots();
    setActive(null);
    lastSessionHash.current = null;
    setRestorable(null);
    await refreshList();
  }, [refreshList, setActive]);

  /** Neues Deck: Der aktive Snapshot wird nicht mehr überschrieben */
  const release = useCallback(() => {
    if (activeIdRef.current) setActive(null);
  }, [setActive]);

  /**
   * Vor dem Ersetzen des Decks (Zurücksetzen, Deck-Import): Stand sichern, danach ist kein Snapshot mehr aktiv.
   * Mit aktivem Snapshot landet der Stand dort, sonst in einem neuen Snapshot.
   */
  const saveAndRelease = useCallback(async () => {
    if (activeIdRef.current) {
      await saveActive();
      setNotice(null);
    } else {
      await save();
    }
    release();
  }, [saveActive, save, release]);

  const sectionProps: SnapshotSectionProps = {
    snapshots,
    activeId,
    session: restorable,
    pdfInfos,
    notice,
    canSave: !isEmptyState(state),
    totalBytes,
    onSave: save,
    onLoad: load,
    onOverwrite: overwrite,
    onRename: rename,
    onDelete: remove,
    onDeleteAll: removeAll,
  };

  return {
    sectionProps,
    saveAndRelease,
    release,
    saveGenerate,
    /** Nach einem fertigen PDF die Ablaufdaten neu holen */
    refreshPdfInfos: useCallback(() => { refreshPdfInfos(snapshotsRef.current); }, [refreshPdfInfos]),
  };
}
