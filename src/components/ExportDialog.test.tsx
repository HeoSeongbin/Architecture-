import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ExportDialog } from './ExportDialog';
import { exportDiagram } from '../utils/exportDiagram';
vi.mock('../utils/exportDiagram', async (original) => {
  const module = await original<typeof import('../utils/exportDiagram')>();
  return { ...module, exportDiagram: vi.fn() };
});
beforeEach(() => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test-output');
      static revokeObjectURL = vi.fn();
    },
  );
  const main = document.createElement('main');
  main.id = 'diagram-workspace';
  main.innerHTML = '<div class="react-flow"></div>';
  document.body.append(main);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.getElementById('diagram-workspace')?.remove();
});
it('generates configured output, exposes a download link and releases old URLs', async () => {
  vi.mocked(exportDiagram).mockResolvedValue({ blob: new Blob(['png']), pixelWidth: 1200, pixelHeight: 800, width: 600, height: 400 });
  const busy = vi.fn();
  const close = vi.fn();
  const view = render(<ExportDialog theme="dark" close={close} onBusy={busy} />);
  fireEvent.change(screen.getByLabelText('출력 범위'), { target: { value: 'viewport' } });
  fireEvent.change(screen.getByLabelText('출력 배경'), { target: { value: 'transparent' } });
  fireEvent.change(screen.getByLabelText('출력 배율'), { target: { value: '3' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '파일 만들기' })));
  expect(exportDiagram).toHaveBeenLastCalledWith(
    expect.any(HTMLElement),
    { format: 'png', scope: 'viewport', scale: 3, background: 'transparent' },
    'dark',
  );
  expect(screen.getByRole('link', { name: '파일 다운로드' })).toHaveAttribute('download', expect.stringMatching(/\.png$/));
  expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:test-output');
  expect(screen.getByRole('status')).toHaveTextContent('1,200 × 800px');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '파일 만들기' })));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-output');
  fireEvent.change(screen.getByLabelText('출력 형식'), { target: { value: 'pdf' } });
  expect(screen.queryByRole('link', { name: '파일 다운로드' })).toBeNull();
  view.unmount();
  expect(busy).toHaveBeenLastCalledWith(false);
});
it('reports failures, allows retry and disables raster scaling for SVG', async () => {
  vi.mocked(exportDiagram).mockRejectedValue(new Error('출력 한도 초과'));
  render(<ExportDialog theme="light" close={vi.fn()} onBusy={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('출력 형식'), { target: { value: 'svg' } });
  expect(screen.getByLabelText('출력 배율')).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '파일 만들기' })));
  expect(screen.getByRole('alert')).toHaveTextContent('현재 작업은 유지');
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.getByRole('button', { name: '파일 만들기' })).toBeEnabled();
});
it('does not leak an object URL if closed while output generation is pending', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof exportDiagram>>) => void;
  vi.mocked(exportDiagram).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const busy = vi.fn();
  const view = render(<ExportDialog theme="light" close={vi.fn()} onBusy={busy} />);
  fireEvent.click(screen.getByRole('button', { name: '파일 만들기' }));
  expect(screen.getByRole('button', { name: '파일 생성 중…' })).toBeDisabled();
  view.unmount();
  await act(async () => resolve({ blob: new Blob(['png']), pixelWidth: 10, pixelHeight: 10, width: 10, height: 10 }));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(busy).toHaveBeenLastCalledWith(false);
});
