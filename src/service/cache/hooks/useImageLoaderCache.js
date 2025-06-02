import { useEffect, useState } from "react";
import { imageLoaderService } from "../ImageLoaderService.js";

export function useImageLoaderCache() {
  const [snapshot, setSnapshot] = useState({
    byApi: {},
    byCard: {},
    totalSize: 0,
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