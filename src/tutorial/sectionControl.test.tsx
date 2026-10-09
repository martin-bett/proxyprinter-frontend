import React from 'react';
import { act, render, screen } from '@testing-library/react';
import CollapsibleSection from '../container/inputs/CollapsibleSection';
import { isSectionOpen, setSectionOpen } from './sectionControl';

describe('sectionControl', () => {
  beforeEach(() => localStorage.clear());

  it('opens and closes a section by its storage key', () => {
    render(
      <>
        <CollapsibleSection storageKey="a" title="A" defaultOpen={false}><p>body a</p></CollapsibleSection>
        <CollapsibleSection storageKey="b" title="B" defaultOpen={false}><p>body b</p></CollapsibleSection>
      </>
    );
    expect(isSectionOpen('a')).toBe(false);

    act(() => setSectionOpen('a', true));
    expect(isSectionOpen('a')).toBe(true);
    expect(screen.getByText('body a')).toBeVisible();
    expect(isSectionOpen('b')).toBe(false);

    act(() => setSectionOpen('a', false));
    expect(isSectionOpen('a')).toBe(false);
  });

  it('reports unknown sections as undefined', () => {
    expect(isSectionOpen('missing')).toBeUndefined();
  });
});
