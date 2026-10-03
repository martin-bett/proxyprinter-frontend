import { useEffect, useState } from "react";
import { imageLoaderService, QueueNumbers } from "../ImageLoaderService";

// Fragt die Queue-Zähler jede Sekunde ab und rendert nur bei echten Änderungen neu
export function useImageLoaderNumbers(): QueueNumbers {
  const [numbers, setNumbers] = useState<QueueNumbers>(imageLoaderService.getQueueNumbers());

  useEffect(() => {
    const interval = setInterval(() => {
      const next = imageLoaderService.getQueueNumbers();
      setNumbers(prev =>
        prev.queued === next.queued && prev.active === next.active && prev.cacheLoading === next.cacheLoading
          ? prev
          : next
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return numbers;
}
