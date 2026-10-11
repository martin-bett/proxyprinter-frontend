import i18n from './index';

/**
 * Text for an error body from the backend: {error, code?, params?}.
 * Known codes get the translated text, everything else shows the English fallback in `error`.
 */
export const backendErrorText = (body: unknown): string => {
  if (!body || typeof body !== 'object') return '';
  const { error, code, params } = body as { error?: unknown; code?: unknown; params?: Record<string, unknown> };
  if (typeof code === 'string') {
    const key = `backendErrors.${code}`;
    if (i18n.exists(key)) return String(i18n.t(key as never, { ...(params ?? {}) } as never));
  }
  return typeof error === 'string' ? error : '';
};

/** Text for a failed response: the backend's error body if it has one, else `fallback` (e.g. with the HTTP status). */
export const responseErrorText = async (response: Response, fallback: string): Promise<string> => {
  try {
    const text = backendErrorText(await response.json());
    if (text) return text;
  } catch {
    // kein JSON
  }
  return fallback;
};
