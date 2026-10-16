import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toCanvas, toSvg } from 'html-to-image';
import { checkExportSize, DEFAULT_EXPORT, exportDiagram, getExportBounds } from './exportDiagram';
import { createImagePdf } from './imagePdf';

vi.mock('html-to-image', () => ({ toCanvas: vi.fn(), toSvg: vi.fn() }));
const rect = (x: number, y: number, width: number, height: number) => ({
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
  width,
  height,
  x,
  y,
  toJSON: () => ({}),
});
function canvasFixture() {
  const shell = document.createElement('div');
  shell.className = 'editor-shell';
  shell.innerHTML =
    '<div class="react-flow"><div class="react-flow__viewport" style="transform:matrix(0.5,0,0,0.5,100,50)"><div class="react-flow__node selected"><div class="architecture-node architecture-node-selected">한글 &amp; icon</div><div class="react-flow__handle"></div></div><svg class="react-flow__edge"><defs><marker id="arrow"></marker></defs><path marker-end="url(#arrow)" /></svg><div class="architecture-edge-label">화면 밖 라벨</div></div><div class="react-flow__panel">Controls</div><svg class="react-flow__background"></svg></div>';
  document.body.append(shell);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('react-flow')) return rect(10, 20, 500, 400);
    if (this.classList.contains('react-flow__node')) return rect(60, 70, 100, 60);
    if (this.classList.contains('architecture-edge-label')) return rect(-90, 10, 80, 40);
    return rect(0, 0, 0, 0);
  });
  const root = shell.querySelector<HTMLElement>('.react-flow')!;
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(50, 60, 150, 100));
  return { shell, root };
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('measures negative positions, edges and offset labels independently of zoom', () => {
  const { root } = canvasFixture();
  expect(getExportBounds(root, 'all')).toEqual({ x: -464, y: -184, width: 708, height: 428 });
  expect(getExportBounds(root, 'viewport')).toEqual({ x: 0, y: 0, width: 500, height: 400 });
});
it.each([
  [8193, 1, 1],
  [4097, 4096, 1],
  [3000, 3000, 2],
  [Infinity, 1, 1],
  [1, 1, 0],
  [0, 1, 1],
])('rejects unsafe output %j × %j @ %j before allocation', (w, h, scale) => {
  expect(() => checkExportSize(w, h, scale)).toThrow();
});
it('accepts the boundary and rejects empty full exports', () => {
  expect(checkExportSize(4096, 4096, 1)).toEqual({ pixelWidth: 4096, pixelHeight: 4096 });
  const { root } = canvasFixture();
  root.querySelector('.react-flow__node')!.remove();
  expect(() => getExportBounds(root, 'all')).toThrow('노드가 없습니다');
});
it('exports a clone with markers and labels, hides editor chrome and preserves the live DOM', async () => {
  const { root } = canvasFixture();
  const original = root.outerHTML;
  vi.mocked(toCanvas).mockImplementation(async (clone, options) => {
    expect(clone).not.toBe(root);
    expect(clone.querySelector('.react-flow__viewport')?.getAttribute('style')).toContain('translate(464px, 184px) scale(1)');
    expect(clone.querySelector('.architecture-edge-label')?.textContent).toBe('화면 밖 라벨');
    expect(clone.querySelector('marker')?.id).toBe('arrow');
    expect(clone.querySelector('.selected, .react-flow__handle, .react-flow__panel, .react-flow__background')).toBeNull();
    expect(options?.backgroundColor).toBeUndefined();
    expect(options?.includeStyleProperties).toEqual(
      expect.arrayContaining(['place-items', 'justify-items', 'marker-end', 'stroke', 'font-family']),
    );
    return {
      width: 1416,
      height: 856,
      toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })),
    } as HTMLCanvasElement;
  });
  const output = await exportDiagram(root, { ...DEFAULT_EXPORT, background: 'transparent' }, 'dark');
  expect(output.blob.type).toBe('image/png');
  expect(root.outerHTML).toBe(original);
  expect(document.querySelector('.diagram-export-host')).toBeNull();
});
it('keeps the current viewport transform and cleans up a failed render', async () => {
  const { root } = canvasFixture();
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('react-flow')) return rect(10, 20, 500, 400);
    if (this.classList.contains('architecture-edge-label')) return rect(-300, 10, 80, 40);
    return rect(60, 70, 100, 60);
  });
  vi.mocked(toCanvas).mockImplementation(async (clone) => {
    expect(clone.querySelector('.react-flow__viewport')?.getAttribute('style')).toContain('matrix(0.5');
    expect(clone.querySelector('.architecture-edge-label')).toBeNull();
    expect(clone.querySelector('marker')?.id).toBe('arrow');
    expect(clone.querySelector('.react-flow__edge')).not.toBeNull();
    throw new Error('render failed');
  });
  await expect(exportDiagram(root, { ...DEFAULT_EXPORT, scope: 'viewport' }, 'light')).rejects.toThrow('render failed');
  expect(document.querySelector('.diagram-export-host')).toBeNull();
  expect(root.querySelector('.selected')).not.toBeNull();
});
it('rejects canvas auto-scaling or null PNG results instead of silently returning a blank file', async () => {
  const { root } = canvasFixture();
  vi.mocked(toCanvas).mockResolvedValue({ width: 0, height: 0 } as HTMLCanvasElement);
  await expect(exportDiagram(root, DEFAULT_EXPORT, 'light')).rejects.toThrow('요청한 출력 크기');
  vi.mocked(toCanvas).mockResolvedValue({
    width: 1416,
    height: 856,
    toBlob: (callback: BlobCallback) => callback(null),
  } as HTMLCanvasElement);
  await expect(exportDiagram(root, DEFAULT_EXPORT, 'light')).rejects.toThrow('PNG 생성');
});
it('returns a UTF-8 SVG blob and does not invoke a raster canvas', async () => {
  const { root } = canvasFixture();
  vi.mocked(toSvg).mockResolvedValue(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>한글</text></svg>'),
  );
  const output = await exportDiagram(root, { ...DEFAULT_EXPORT, format: 'svg', scale: 1 }, 'light');
  expect(await output.blob.text()).toContain('<text>한글</text>');
  expect(toCanvas).not.toHaveBeenCalled();
});
it('creates a structurally valid PDF with byte-accurate xref and JPEG streams', async () => {
  // The image bytes are only a stream fixture; browser QA validates actual JPEG rendering.
  const blob = createImagePdf('data:image/jpeg;base64,/9j/2Q==', 100, 50, 200, 100);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder('latin1').decode(bytes);
  expect(blob.type).toBe('application/pdf');
  expect(text).toContain('/MediaBox [0 0 150 75]');
  const start = Number(text.match(/startxref\n(\d+)/)![1]);
  expect(new TextDecoder().decode(bytes.slice(start, start + 4))).toBe('xref');
  const offsets = text.slice(start).match(/\d{10} 00000 n /g)!;
  offsets.forEach((line, index) => {
    const position = Number(line.slice(0, 10));
    expect(new TextDecoder().decode(bytes.slice(position, position + 7))).toBe(`${index + 1} 0 obj`);
  });
  expect(() => createImagePdf('data:invalid', 100, 100, 100, 100)).toThrow();
});
it('flattens PDF transparency to white and preserves configured pixel density', async () => {
  const { root } = canvasFixture();
  vi.mocked(toCanvas).mockImplementation(async (_root, options) => {
    expect(options?.backgroundColor).toBe('#ffffff');
    return { width: 1416, height: 856, toDataURL: () => 'data:image/jpeg;base64,/9j/2Q==' } as unknown as HTMLCanvasElement;
  });
  const result = await exportDiagram(root, { ...DEFAULT_EXPORT, format: 'pdf', background: 'transparent' }, 'dark');
  expect(result.blob.type).toBe('application/pdf');
});
