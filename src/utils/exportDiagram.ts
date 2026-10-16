import { toCanvas, toSvg } from 'html-to-image';
import { createImagePdf } from './imagePdf';

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  scope: 'viewport' | 'all';
  scale: number;
  background: 'theme' | 'white' | 'dark' | 'transparent';
}
export const DEFAULT_EXPORT: ExportOptions = { format: 'png', scope: 'all', scale: 2, background: 'theme' };
export const EXPORT_LIMITS = { side: 8192, pixels: 16 * 1024 * 1024 };
// Copy the properties used by our node/edge templates, rather than hundreds of
// unrelated computed CSS properties for every descendant (measured bottleneck).
export const EXPORT_STYLE_PROPERTIES =
  `box-sizing display visibility position top right bottom left z-index width height min-width min-height max-width max-height
margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left
border border-width border-style border-color border-radius border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius
background background-color background-image background-size background-position background-repeat background-clip background-origin
color font font-family font-size font-weight font-style font-variant font-stretch line-height letter-spacing text-align text-transform text-decoration white-space text-overflow overflow overflow-x overflow-y overflow-wrap word-break vertical-align
flex flex-direction flex-wrap flex-grow flex-shrink flex-basis align-items align-self align-content justify-content justify-items justify-self place-items place-content place-self gap row-gap column-gap grid-template-columns grid-template-rows grid-column grid-row
transform transform-origin opacity box-shadow filter clip-path -webkit-line-clamp -webkit-box-orient
fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit vector-effect paint-order marker-start marker-mid marker-end d`.split(
    /\s+/,
  );
export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function checkExportSize(width: number, height: number, scale: number) {
  if (![1, 2, 3, 4].includes(scale) || ![width, height].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('출력 크기와 배율이 올바르지 않습니다.');
  const pixelWidth = Math.ceil(width * scale),
    pixelHeight = Math.ceil(height * scale);
  if (pixelWidth > EXPORT_LIMITS.side || pixelHeight > EXPORT_LIMITS.side || pixelWidth * pixelHeight > EXPORT_LIMITS.pixels)
    throw new Error('출력 한도(한 변 8,192px, 16메가픽셀)를 초과했습니다. 배율을 줄이거나 현재 화면으로 내보내세요.');
  return { pixelWidth, pixelHeight };
}
export function getExportBounds(root: HTMLElement, scope: ExportOptions['scope']): ExportBounds {
  const frame = root.getBoundingClientRect();
  if (scope === 'viewport') return { x: 0, y: 0, width: Math.ceil(frame.width), height: Math.ceil(frame.height) };
  const viewport = root.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || !root.querySelector('.react-flow__node')) throw new Error('내보낼 노드가 없습니다. 자산을 추가하세요.');
  const transform = getComputedStyle(viewport).transform;
  const matrix =
    transform === 'none' || !transform
      ? [1, 0, 0, 1, 0, 0]
      : transform
          .match(/^matrix\(([^)]+)\)$/)?.[1]
          .split(',')
          .map(Number);
  if (!matrix || matrix.length !== 6 || !matrix.every(Number.isFinite) || matrix[0] <= 0 || matrix[1] !== 0 || matrix[2] !== 0)
    throw new Error('캔버스 배율을 측정하지 못했습니다. 다시 시도하세요.');
  const zoom = matrix[0];
  // Include rendered edge paths and offset/rotated HTML labels, not just node positions.
  const boxes = [...root.querySelectorAll<HTMLElement>('.react-flow__node, .react-flow__edge, .architecture-edge-label')]
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.width > 0 || box.height > 0);
  if (!boxes.length) throw new Error('다이어그램 크기를 측정하지 못했습니다.');
  const left = Math.min(...boxes.map((box) => (box.left - frame.left - matrix[4]) / zoom));
  const top = Math.min(...boxes.map((box) => (box.top - frame.top - matrix[5]) / zoom));
  const right = Math.max(...boxes.map((box) => (box.right - frame.left - matrix[4]) / zoom));
  const bottom = Math.max(...boxes.map((box) => (box.bottom - frame.top - matrix[5]) / zoom));
  const padding = 64;
  return {
    x: Math.floor(left - padding),
    y: Math.floor(top - padding),
    width: Math.ceil(right - left + 2 * padding),
    height: Math.ceil(bottom - top + 2 * padding),
  };
}

export async function exportDiagram(root: HTMLElement, options: ExportOptions, theme: 'light' | 'dark') {
  if (
    !['png', 'svg', 'pdf'].includes(options.format) ||
    !['viewport', 'all'].includes(options.scope) ||
    !['theme', 'white', 'dark', 'transparent'].includes(options.background)
  )
    throw new Error('지원하지 않는 출력 설정입니다.');
  await document.fonts?.ready;
  let bounds = getExportBounds(root, options.scope);
  const scale = options.format === 'svg' ? 1 : options.scale;
  let dimensions = checkExportSize(bounds.width, bounds.height, scale);
  const background =
    options.background === 'transparent' && options.format !== 'pdf'
      ? undefined
      : options.background === 'white' || options.background === 'transparent'
        ? '#ffffff'
        : options.background === 'dark' || (options.background === 'theme' && theme === 'dark')
          ? '#111827'
          : '#f8fafc';
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.className = 'diagram-export-host';
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    pointerEvents: 'none',
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  const clone = root.cloneNode(true) as HTMLElement;
  if (options.scope === 'viewport') {
    const frame = root.getBoundingClientRect();
    const originals = root.querySelectorAll('.react-flow__node, .react-flow__edge, .architecture-edge-label');
    const copies = clone.querySelectorAll('.react-flow__node, .react-flow__edge, .architecture-edge-label');
    originals.forEach((element, index) => {
      const box = element.getBoundingClientRect();
      // Conservative margin includes shadows; crossing edges and enclosing groups
      // remain even when both endpoints/the group origin are outside the viewport.
      if (box.right < frame.left - 32 || box.left > frame.right + 32 || box.bottom < frame.top - 32 || box.top > frame.bottom + 32)
        copies[index]?.remove();
    });
  }
  Object.assign(clone.style, {
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    minWidth: '0',
    minHeight: '0',
    background: background ?? 'transparent',
    overflow: 'hidden',
  });
  // Never modify the live canvas, viewport, selection or history.
  clone
    .querySelectorAll(
      '.react-flow__panel, .react-flow__attribution, .react-flow__background, .react-flow__handle, .react-flow__resize-control, .react-flow__selection, .react-flow__nodesselection',
    )
    .forEach((element) => element.remove());
  clone
    .querySelectorAll('.selected, .animated, .architecture-node-selected, .group-node-selected, .architecture-edge-label-selected')
    .forEach((element) =>
      element.classList.remove(
        'selected',
        'animated',
        'architecture-node-selected',
        'group-node-selected',
        'architecture-edge-label-selected',
      ),
    );
  clone.querySelectorAll<HTMLElement>('.architecture-edge-label').forEach((label) => {
    Object.assign(label.style, { width: 'max-content', maxWidth: '320px', padding: '5px 10px' });
    label
      .querySelectorAll<HTMLElement>('span')
      .forEach((line) =>
        Object.assign(line.style, { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', overflowWrap: 'anywhere' }),
      );
  });
  const style = document.createElement('style');
  style.textContent =
    '.diagram-export-host * { animation: none !important; transition: none !important; caret-color: transparent !important; }';
  host.append(style, clone);
  (root.closest('.editor-shell') ?? document.body).append(host);
  try {
    if (options.scope === 'all') {
      // Measure the clone again after expanding labels, before allocating pixels.
      bounds = getExportBounds(clone, 'all');
      dimensions = checkExportSize(bounds.width, bounds.height, scale);
      Object.assign(host.style, { width: `${bounds.width}px`, height: `${bounds.height}px` });
      Object.assign(clone.style, { width: `${bounds.width}px`, height: `${bounds.height}px` });
      clone.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`;
    }
    // A little extra room avoids fractional border/font rounding during SVG rasterization.
    clone.querySelectorAll<HTMLElement>('.architecture-edge-label').forEach((label) => {
      if (label.offsetWidth) label.style.width = `${Math.ceil(label.offsetWidth) + 2}px`;
      if (label.offsetHeight) label.style.height = `${Math.ceil(label.offsetHeight) + 2}px`;
    });
    const settings = {
      width: bounds.width,
      height: bounds.height,
      pixelRatio: scale,
      backgroundColor: background,
      skipAutoScale: true,
      cacheBust: false,
      includeStyleProperties: EXPORT_STYLE_PROPERTIES,
    };
    let blob: Blob;
    if (options.format === 'svg') {
      const url = await toSvg(clone, settings);
      const comma = url.indexOf(',');
      blob = new Blob([decodeURIComponent(url.slice(comma + 1))], { type: 'image/svg+xml;charset=utf-8' });
    } else {
      const canvas = await toCanvas(clone, settings);
      if (canvas.width !== dimensions.pixelWidth || canvas.height !== dimensions.pixelHeight)
        throw new Error('브라우저가 요청한 출력 크기를 생성하지 못했습니다. 배율을 줄이세요.');
      if (options.format === 'pdf')
        blob = createImagePdf(canvas.toDataURL('image/jpeg', 0.95), canvas.width, canvas.height, bounds.width, bounds.height);
      else
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('PNG 생성에 실패했습니다. 배율을 줄이세요.'))), 'image/png'),
        );
    }
    return { blob, ...dimensions, width: bounds.width, height: bounds.height };
  } finally {
    host.remove();
  }
}
