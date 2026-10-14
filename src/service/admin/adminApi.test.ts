import { formatBytes, isAdminPath } from './adminApi';

describe('adminApi helpers', () => {
  it('recognises the admin path only', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/administrator')).toBe(false);
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});
