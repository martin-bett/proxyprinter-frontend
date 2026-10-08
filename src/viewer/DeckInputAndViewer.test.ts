import { adjustSelectionForCountChange } from './selectionUtils';

describe('adjustSelectionForCountChange', () => {
  it('returns empty array when given undefined and count is 0', () => {
    expect(adjustSelectionForCountChange(undefined, 0, 0)).toEqual([]);
  });

  it('returns empty array when decreasing to 0', () => {
    expect(adjustSelectionForCountChange(['a', 'b', 'c'], 3, 0)).toEqual([]);
  });

  it('returns original array when count stays the same', () => {
    const arr = ['a', 'b', 'c'];
    expect(adjustSelectionForCountChange(arr, 3, 3)).toEqual(arr);
  });

  it('inherits from first entry when increasing count', () => {
    expect(adjustSelectionForCountChange(['first'], 1, 3)).toEqual(['first', 'first', 'first']);
  });

  it('inherits from first entry even when undefined initially', () => {
    expect(adjustSelectionForCountChange(undefined, 0, 2)).toEqual([null, null]);
  });

  it('preserves existing entries when increasing count', () => {
    expect(adjustSelectionForCountChange(['a', 'b'], 2, 5)).toEqual(['a', 'b', 'a', 'a', 'a']);
  });

  it('removes entries from end when decreasing count', () => {
    expect(adjustSelectionForCountChange(['a', 'b', 'c', 'd'], 4, 2)).toEqual(['a', 'b']);
  });

  it('removes all entries when decreasing to 0', () => {
    expect(adjustSelectionForCountChange(['a', 'b', 'c'], 3, 0)).toEqual([]);
  });

  it('handles null entries correctly', () => {
    expect(adjustSelectionForCountChange([null, 'b', null], 3, 5)).toEqual([null, 'b', null, null, null]);
  });

  it('handles mixed null and non-null entries when inheriting', () => {
    expect(adjustSelectionForCountChange([null], 1, 3)).toEqual([null, null, null]);
  });

  it('works with object types', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    expect(adjustSelectionForCountChange([obj1, obj2], 2, 4)).toEqual([obj1, obj2, obj1, obj1]);
  });

  it('handles increasing from 0', () => {
    expect(adjustSelectionForCountChange([], 0, 3)).toEqual([null, null, null]);
  });

  it('handles large count increases', () => {
    const result = adjustSelectionForCountChange(['only'], 1, 10);
    expect(result).toHaveLength(10);
    expect(result.every(item => item === 'only')).toBe(true);
  });
});
