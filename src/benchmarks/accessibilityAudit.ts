export function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    if (/^#[\da-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map((channel) => channel + channel).join('');
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('Expected six-digit theme color');
    const channels = [1, 3, 5]
      .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function accessibleName(element: Element) {
  const labelled = element
    .getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim();
  if (labelled) return labelled;
  const aria = element.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const label = [...(element.labels ?? [])]
      .map((item) => item.textContent)
      .join(' ')
      .trim();
    if (label) return label;
  }
  return element.getAttribute('title')?.trim() || element.textContent?.trim() || '';
}
export function auditEditor(root: HTMLElement) {
  const controls = [...root.querySelectorAll('button,a,input,select,textarea,[tabindex="0"]')].filter(
    (element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden',
  );
  const unnamed = controls
    .filter((element) => !accessibleName(element))
    .map((element) => ({ tag: element.tagName, role: element.getAttribute('role'), className: element.getAttribute('class') }));
  const style = getComputedStyle(root);
  const color = (key: string) => style.getPropertyValue(`--editor-${key}`).trim();
  const contrast = [
    ['text', 'surface'],
    ['secondary', 'surface'],
    ['accent', 'surface'],
    ['text', 'muted'],
  ].map(([foreground, background]) => {
    const ratio = contrastRatio(color(foreground), color(background));
    return { foreground, background, ratio: Number(ratio.toFixed(2)), passesNormalText: ratio >= 4.5 };
  });
  return {
    timestamp: new Date().toISOString(),
    theme: root.dataset.theme,
    visibleControls: controls.length,
    unnamed,
    contrast,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    note: 'Focused name/theme contrast audit, not a complete WCAG or screen-reader certification.',
  };
}
