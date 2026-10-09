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
