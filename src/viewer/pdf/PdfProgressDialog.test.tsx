import React from 'react';
import { act, render, screen } from '@testing-library/react';
import PdfProgressDialog, { ProgressDto } from './PdfProgressDialog';

const dto = (partial: Partial<ProgressDto>): ProgressDto => ({
  progressId: 'abc',
  category: 'queued',
  message: '',
  current: 0,
  total: 0,
  pageCount: null,
  fileSize: 0,
  error: false,
  ...partial,
});

describe('PdfProgressDialog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the latest message and build progress', () => {
    render(
      <PdfProgressDialog
        open
        progressDtos={[
          dto({ category: 'queued', current: 1, total: 1 }),
          dto({ category: 'download', current: 3, total: 3, fileSize: 2048 }),
          dto({ category: 'build', message: 'Placing card 2 of 3', current: 2, total: 3, pageCount: 1 }),
        ]}
        onFinish={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Placing card 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('1 page')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('calls onFinish once when the pdf is ready', () => {
    const onFinish = jest.fn();
    const finished = [dto({ category: 'finishing', message: 'done', current: 1, total: 1, fileSize: 10 })];
    const { rerender } = render(<PdfProgressDialog open progressDtos={finished} onFinish={onFinish} onClose={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(1000); });
    rerender(<PdfProgressDialog open progressDtos={[...finished]} onFinish={onFinish} onClose={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith('abc');
  });

  it('shows backend errors with a close button and does not download', () => {
    const onFinish = jest.fn();
    const onClose = jest.fn();
    render(
      <PdfProgressDialog
        open
        progressDtos={[dto({ category: 'finishing', message: 'Error: boom', error: true })]}
        onFinish={onFinish}
        onClose={onClose}
      />
    );
    expect(screen.getByText('Error: boom')).toBeInTheDocument();
    act(() => { screen.getByText('Close').click(); jest.advanceTimersByTime(1000); });
    expect(onClose).toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
