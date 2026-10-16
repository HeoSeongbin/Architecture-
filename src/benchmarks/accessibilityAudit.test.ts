import { expect, it } from 'vitest';
import { accessibleName, contrastRatio } from './accessibilityAudit';

it('accepts minified theme colors and computes WCAG contrast', () => {
  expect(contrastRatio('#000', '#fff')).toBe(21);
  expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  expect(contrastRatio('#52627a', '#fff')).toBeGreaterThan(4.5);
  expect(() => contrastRatio('invalid', '#fff')).toThrow();
});
it('resolves labelled controls and reports missing icon button names', () => {
  const root = document.createElement('div');
  root.innerHTML =
    '<label for="audit-name">노드 이름</label><input id="audit-name"><button aria-label="확대"><svg></svg></button><button><svg></svg></button>';
  document.body.append(root);
  expect(accessibleName(root.querySelector('input')!)).toBe('노드 이름');
  expect(accessibleName(root.querySelectorAll('button')[0])).toBe('확대');
  expect(accessibleName(root.querySelectorAll('button')[1])).toBe('');
  root.remove();
});
