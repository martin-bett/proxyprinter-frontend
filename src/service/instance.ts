export type InstanceInfo = {
  kind: 'prod' | 'test' | 'pr' | 'local';
  /** Prefix for the tab title, e.g. "[PR 153d5e]"; empty for prod */
  label: string;
  /** File name of the favicon in public/; null keeps the default */
  favicon: string | null;
};

const TEST_DOMAIN = 'test.proxyprinter.eu';

/**
 * Detects which instance is running from the hostname:
 * test.proxyprinter.eu = develop test, <slug>.test.proxyprinter.eu = PR environment,
 * localhost = local dev, everything else (production) unchanged.
 */
export function detectInstance(hostname: string): InstanceInfo {
  const host = hostname.toLowerCase();
  if (host === TEST_DOMAIN) {
    return { kind: 'test', label: '[TEST]', favicon: 'proxyprinter-favicon-test.svg' };
  }
  if (host.endsWith(`.${TEST_DOMAIN}`)) {
    const slug = host.slice(0, -(TEST_DOMAIN.length + 1));
    return { kind: 'pr', label: `[PR ${slug}]`, favicon: 'proxyprinter-favicon-pr.svg' };
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return { kind: 'local', label: '[LOCAL]', favicon: 'proxyprinter-favicon-local.svg' };
  }
  return { kind: 'prod', label: '', favicon: null };
}
