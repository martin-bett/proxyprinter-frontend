import { TUTORIALS } from './tutorials';

describe('TUTORIALS', () => {
  it('has unique ids', () => {
    const ids = TUTORIALS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every step a target, title and text', () => {
    TUTORIALS.forEach(t => {
      expect(t.steps.length).toBeGreaterThan(0);
      t.steps.forEach(step => {
        expect(typeof step.target).toBe('string');
        expect(step.title).toBeTruthy();
        expect(step.content).toBeTruthy();
      });
    });
  });
});
