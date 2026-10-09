import { useEffect, useState } from "react";
import { imageLoaderService, CacheSnapshot } from "../ImageLoaderService";

export function useImageLoaderCache(): CacheSnapshot {
  const [snapshot, setSnapshot] = useState<CacheSnapshot>({
    byApi: {},
    byCard: {},
    totalSize: 0,
    lockedCount: 0,
  });

  useEffect(() => {
    let mounted = true;
    async function fetchSnapshot() {
      const snap = await imageLoaderService.getSnapshot();
      if (mounted) setSnapshot(snap);
    }
    fetchSnapshot();

    const unsub = imageLoaderService.subscribe(() => {
      fetchSnapshot();
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  return snapshot;
}
