import { useEffect, useState } from "react";
import { imageLoaderService } from "../ImageLoaderService";

// Fragt die gebündelte Download-Rate (Bytes/s) jede Sekunde ab, nur solange `enabled` gesetzt ist
export function useDownloadRate(enabled: boolean): number {
  const [rate, setRate] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setRate(0);
      return;
    }
    const read = () => setRate(Math.round(imageLoaderService.getDownloadRate() / 1024) * 1024);
    read();
    const interval = setInterval(read, 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return rate;
}

/** "1.2 MB/s" oder "340 KB/s" */
export function formatRate(bytesPerSecond: number): string {
  return bytesPerSecond >= 1024 * 1024
    ? `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    : `${Math.round(bytesPerSecond / 1024)} KB/s`;
}
