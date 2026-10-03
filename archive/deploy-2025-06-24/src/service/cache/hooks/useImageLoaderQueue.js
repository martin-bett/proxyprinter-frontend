import { useEffect, useState } from "react";
import { imageLoaderService } from "../ImageLoaderService.js";

export function useImageLoaderQueue() {
  const [queue, setQueue] = useState(imageLoaderService.getQueueSnapshot());
  console.log('Called GetSnapshot');
  useEffect(() => {
    const update = () => {
      console.log('Updating image loader queue snapshot');
      const next = imageLoaderService.getQueueSnapshot();
      setQueue((prev) => {
        // Nur updaten, wenn sich wirklich etwas geändert hat
        if (JSON.stringify(next) !== JSON.stringify(prev)) {
          return next;
        }
        return prev;
      });
    };
    const unsub = imageLoaderService.subscribe(update);
    update();
    return unsub;
  }, []);

  return queue;
}