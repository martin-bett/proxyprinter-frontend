import { useEffect, useState } from "react";
import { imageLoaderService, QueueSnapshotEntry } from "../ImageLoaderService";

export function useImageLoaderQueue(): QueueSnapshotEntry[] {
  const [queue, setQueue] = useState<QueueSnapshotEntry[]>(imageLoaderService.getQueueSnapshot());

  useEffect(() => {
    const update = () => setQueue(imageLoaderService.getQueueSnapshot());
    const unsub = imageLoaderService.subscribe(update);
    update();
    return unsub;
  }, []);

  return queue;
}
