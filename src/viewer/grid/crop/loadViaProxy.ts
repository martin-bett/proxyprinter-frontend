/** Lädt ein Bild über den Backend-Proxy, falls die Seite das direkte Einbinden blockiert. */
export const loadViaProxy = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch('/api/proxy/image', { headers: { 'X-Target-URL': url } });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  } catch {
    return null;
  }
};
