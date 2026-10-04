import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RestoredState, Snapshot, WorkState, createSnapshot, customUploadIds, isEmptySnapshot, isEmptyState, restoreSnapshot, snapshotLabel,
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
 */
export function useSnapshots({ state, isBusy, apply }: Options) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restorable, setRestorable] = useState<Snapshot | null>(null);
  const [pdfInfos, setPdfInfos] = useState<Record<string, PdfInfo | null>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;
  const lastSessionHash = useRef<string | null>(null);
  const snapshotsRef = useRef<Snapshot[]>([]);
  snapshotsRef.current = snapshots;

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

  // Beim Start: Liste laden und die letzte Sitzung zum Wiederherstellen anbieten
  useEffect(() => {
    refreshList().then(all => {
      refreshPdfInfos(all);
      const session = all.find(s => s.kind === 'session');
      if (session && !isEmptySnapshot(session) && isEmptyState(stateRef.current)) {
        setRestorable(session);
      }
    });
  }, [refreshList, refreshPdfInfos]);

  const saveSession = useCallback(async () => {
    const current = stateRef.current;
    if (busyRef.current || isEmptyState(current)) return;
    const snapshot = createSnapshot(current, 'session');
    if (snapshot.contentHash === lastSessionHash.current) return;
    lastSessionHash.current = snapshot.contentHash;
    try {
      await putSnapshot(snapshot);
      // Die alte Sitzung ist jetzt überschrieben
      setRestorable(null);
      const ids = customUploadIds(snapshot);
      if (ids.length > 0) touchUploads(ids);
    } catch (error) {
      lastSessionHash.current = null;
      console.error('Could not save session snapshot', error);
    }
  }, []);

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
      const ids = customUploadIds(snapshot);
      if (ids.length > 0) touchUploads(ids);
      setNotice(null);
      await refreshList();
    } catch (error) {
      console.error('Could not save snapshot', error);
      setNotice('The snapshot could not be saved.');
    }
  }, [refreshList]);

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
    if (snapshot.kind !== 'session') await saveSession();
    const fresh = (await getSnapshot(snapshot.id).catch(() => undefined)) ?? snapshot;
    const ids = customUploadIds(fresh);
    const missing = ids.length > 0 ? await touchUploads(ids) : [];
    const { state: restored, droppedCustomCards } = restoreSnapshot(fresh, missing);
    apply(restored);
    lastSessionHash.current = null;
    setRestorable(null);
    setNotice(droppedCustomCards > 0
      ? `${droppedCustomCards} custom ${droppedCustomCards === 1 ? 'card is' : 'cards are'} no longer available on the server, please upload again.`
      : null);
    const all = await refreshList();
    refreshPdfInfos(all);
  }, [apply, saveSession, refreshList, refreshPdfInfos]);

  const rename = useCallback(async (snapshot: Snapshot) => {
    const name = window.prompt('Snapshot name', snapshotLabel(snapshot));
    if (name === null) return;
    const custom = name.trim();
    await putSnapshot({ ...snapshot, label: { ...snapshot.label, custom: custom || undefined } });
    await refreshList();
  }, [refreshList]);

  const remove = useCallback(async (snapshot: Snapshot) => {
    if (!window.confirm(`Delete snapshot "${snapshotLabel(snapshot)}"?`)) return;
    await deleteSnapshot(snapshot.id);
    await refreshList();
  }, [refreshList]);

  const removeAll = useCallback(async () => {
    if (!window.confirm('Delete all snapshots stored in this browser?')) return;
    await deleteAllSnapshots();
    lastSessionHash.current = null;
    setRestorable(null);
    await refreshList();
  }, [refreshList]);

  const sectionProps: SnapshotSectionProps = {
    snapshots,
    session: restorable,
    pdfInfos,
    notice,
    canSave: !isEmptyState(state),
    totalBytes,
    onSave: save,
    onLoad: load,
    onRename: rename,
    onDelete: remove,
    onDeleteAll: removeAll,
  };

  return {
    sectionProps,
    saveGenerate,
    /** Nach einem fertigen PDF die Ablaufdaten neu holen */
    refreshPdfInfos: useCallback(() => { refreshPdfInfos(snapshotsRef.current); }, [refreshPdfInfos]),
  };
}
