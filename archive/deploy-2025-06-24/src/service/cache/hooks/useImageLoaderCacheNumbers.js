import { useEffect, useState } from "react";
import { imageLoaderService } from "../ImageLoaderService.js";

export function useImageLoaderCacheNumbers() {
  const [state, setState] = useState({
    imgCount: 0,
    current: 0,
    limit: imageLoaderService.cacheLimit,
  });

  useEffect(() => {
    let mounted = true;
    async function poll() {
      // Hole nur die Anzahl und Größe, nicht die ganzen Objekte!
      const entries = await imageLoaderService.getCacheGroupedByApiName();
      let imgCount = 0;
      for (const arr of Object.values(entries)) {
        imgCount += arr.length;
      }
      const current = await imageLoaderService.getTotalCacheSize();
      // Nur aktualisieren, wenn sich Werte wirklich ändern
      if (
        mounted &&
        (imgCount !== state.imgCount ||
          current !== state.current ||
          imageLoaderService.cacheLimit !== state.limit)
      ) {
        setState({ imgCount, current, limit: imageLoaderService.cacheLimit });
      }
    }
    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Keine Abhängigkeit von state, sonst Endlosschleife

  return state;
}