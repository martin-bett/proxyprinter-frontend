import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SnapshotSection, { SnapshotSectionProps } from './SnapshotSection';
import { Snapshot, SNAPSHOT_FORMAT, SNAPSHOT_VERSION } from '../../service/snapshot/snapshot';

const snap = (n: number): Snapshot => ({
  format: SNAPSHOT_FORMAT,
  version: SNAPSHOT_VERSION,
  id: `s${n}`,
  kind: 'manual',
  createdAt: 0,
  label: { cardCount: 1, firstCard: 'Card', custom: `Deck ${n}` },
  contentHash: `h${n}`,
  search: { decklist: '', enabledApis: [], filters: { languages: [], apis: [] }, uniquePrints: false, entries: [] },
  pdf: { settings: {} as Snapshot['pdf']['settings'] },
});

const sectionProps = (count: number, props: Partial<SnapshotSectionProps> = {}): SnapshotSectionProps => ({
  snapshots: Array.from({ length: count }, (_, i) => snap(i + 1)),
  activeId: null, session: null, pdfInfos: {}, notice: null, canSave: true, totalBytes: 0,
  onSave: jest.fn(), onLoad: jest.fn(), onOverwrite: jest.fn(), onRename: jest.fn(), onDelete: jest.fn(), onDeleteAll: jest.fn(),
  ...props,
});

const renderSection = (count: number, props: Partial<SnapshotSectionProps> = {}) =>
  render(<SnapshotSection {...sectionProps(count, props)} />);

const visible = () => screen.queryAllByText(/^Deck \d+$/).map(e => e.textContent);
const up = () => screen.queryByRole('button', { name: 'Show previous snapshot' });
const down = () => screen.queryByRole('button', { name: 'Show next snapshot' });

describe('SnapshotSection paging', () => {
  it('shows all entries without paging buttons up to four', () => {
    renderSection(4);
    expect(visible()).toEqual(['Deck 1', 'Deck 2', 'Deck 3', 'Deck 4']);
    expect(up()).toBeNull();
    expect(down()).toBeNull();
  });

  it('pages one entry at a time and only offers directions with more entries', () => {
    renderSection(6);
    expect(visible()).toEqual(['Deck 1', 'Deck 2', 'Deck 3', 'Deck 4']);
    expect(up()).toBeNull();

    fireEvent.click(down()!);
    expect(visible()).toEqual(['Deck 2', 'Deck 3', 'Deck 4', 'Deck 5']);
    expect(up()).not.toBeNull();

    fireEvent.click(down()!);
    expect(visible()).toEqual(['Deck 3', 'Deck 4', 'Deck 5', 'Deck 6']);
    expect(down()).toBeNull();

    fireEvent.click(up()!);
    expect(visible()).toEqual(['Deck 2', 'Deck 3', 'Deck 4', 'Deck 5']);
  });

  it('stays in range when entries are removed', () => {
    const { rerender } = renderSection(6);
    fireEvent.click(down()!);
    fireEvent.click(down()!);
    rerender(<SnapshotSection {...sectionProps(5)} />);
    expect(visible()).toEqual(['Deck 2', 'Deck 3', 'Deck 4', 'Deck 5']);
    expect(down()).toBeNull();
  });

  it('brings the active snapshot into view', () => {
    renderSection(8, { activeId: 's7' });
    expect(visible()).toEqual(['Deck 4', 'Deck 5', 'Deck 6', 'Deck 7']);
  });
});
