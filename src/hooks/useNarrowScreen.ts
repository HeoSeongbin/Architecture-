import { useSyncExternalStore } from 'react';
const query = '(max-width: 900px)';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia?.(query);
  media?.addEventListener('change', callback);
  return () => media?.removeEventListener('change', callback);
};
export function useNarrowScreen() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  );
}
