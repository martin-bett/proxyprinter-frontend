import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ChoiceButton from './ChoiceButton';
import { LONG_PRESS_MS } from './useLongPress';

// Kleine Filtergruppe wie in den echten Filtern: kurzer Klick toggelt, langer Klick wählt nur diesen
const Group: React.FC = () => {
  const [visible, setVisible] = useState(new Set(['a', 'b', 'c']));
  const toggle = (key: string) => setVisible(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return (
    <>
      {['a', 'b', 'c'].map(key => (
        <ChoiceButton
          key={key}
          id={key}
          label={key}
          checked={visible.has(key)}
          onChange={() => toggle(key)}
          onLongPress={() => setVisible(new Set([key]))}
        />
      ))}
    </>
  );
};

const box = (key: string) => screen.getByLabelText(key) as HTMLInputElement;
const tile = (key: string) => box(key).closest('label') as HTMLLabelElement;
const checked = () => ['a', 'b', 'c'].filter(key => box(key).checked).join('');

describe('ChoiceButton long press', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('short click toggles as before', () => {
    render(<Group />);
    fireEvent.pointerDown(tile('b'));
    fireEvent.pointerUp(tile('b'));
    fireEvent.click(tile('b'));
    expect(checked()).toBe('ac');
  });

  it('holding for 2 s selects only this entry and swallows the following click', () => {
    render(<Group />);
    fireEvent.pointerDown(tile('b'));
    act(() => { jest.advanceTimersByTime(LONG_PRESS_MS - 1); });
    expect(checked()).toBe('abc');
    expect(tile('b')).toHaveClass('is-pressing');
    act(() => { jest.advanceTimersByTime(1); });
    expect(checked()).toBe('b');
    fireEvent.pointerUp(tile('b'));
    fireEvent.click(tile('b'));
    expect(checked()).toBe('b');
    // danach wieder normaler Klick
    fireEvent.pointerDown(tile('a'));
    fireEvent.pointerUp(tile('a'));
    fireEvent.click(tile('a'));
    expect(checked()).toBe('ab');
  });

  it('works on an unchecked entry too', () => {
    render(<Group />);
    fireEvent.click(tile('c'));
    expect(checked()).toBe('ab');
    fireEvent.pointerDown(tile('c'));
    act(() => { jest.advanceTimersByTime(LONG_PRESS_MS); });
    fireEvent.pointerUp(tile('c'));
    fireEvent.click(tile('c'));
    expect(checked()).toBe('c');
  });

  it('leaving or cancelling (scroll on touch) aborts the press', () => {
    render(<Group />);
    fireEvent.pointerDown(tile('a'));
    fireEvent.pointerLeave(tile('a'));
    fireEvent.pointerDown(tile('b'));
    fireEvent.pointerCancel(tile('b'));
    act(() => { jest.advanceTimersByTime(LONG_PRESS_MS * 2); });
    expect(checked()).toBe('abc');
  });
});
