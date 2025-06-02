import { useEffect, useState } from "react";
import { imageLoaderService } from "../ImageLoaderService.js";

export function useImageLoaderQueue() {
  const [queue, setQueue] = useState(imageLoaderService.getQueueSnapshot());

  useEffect(() => {
    const update = () => setQueue(imageLoaderService.getQueueSnapshot());
    const unsub = imageLoaderService.subscribe(update);
    update();
    return unsub;
  }, []);

  return queue;
}