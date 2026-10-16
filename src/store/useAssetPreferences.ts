import { create } from 'zustand';
import { getAsset } from '../data/assets';
import type { ArchitectureNodeKind } from '../types/graph';

export const ASSET_PREFERENCES_KEY = 'architecture-editor-assets-v1';
const sanitize = (value: unknown, limit: number): ArchitectureNodeKind[] =>
  Array.isArray(value) ? [...new Set(value.filter((kind): kind is ArchitectureNodeKind => Boolean(getAsset(kind))))].slice(0, limit) : [];
interface Preferences {
  favorites: ArchitectureNodeKind[];
  recent: ArchitectureNodeKind[];
  storageUnavailable: boolean;
  load: () => void;
  toggle: (kind: ArchitectureNodeKind) => void;
  recordUse: (kind: ArchitectureNodeKind) => void;
}
const save = (value: { favorites: ArchitectureNodeKind[]; recent: ArchitectureNodeKind[] }) => {
  try {
    localStorage.setItem(ASSET_PREFERENCES_KEY, JSON.stringify(value));
    return false;
  } catch {
    return true;
  }
};
export const useAssetPreferences = create<Preferences>((set) => ({
  favorites: [],
  recent: [],
  storageUnavailable: false,
  load: () => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(ASSET_PREFERENCES_KEY) ?? '{}');
      const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
      set({ favorites: sanitize(data.favorites, 100), recent: sanitize(data.recent, 8), storageUnavailable: false });
    } catch {
      set({ storageUnavailable: true });
    }
  },
  toggle: (kind) =>
    set((state) => {
      if (!getAsset(kind)) return state;
      const favorites = state.favorites.includes(kind) ? state.favorites.filter((item) => item !== kind) : [...state.favorites, kind];
      return { favorites, storageUnavailable: save({ favorites, recent: state.recent }) };
    }),
  recordUse: (kind) =>
    set((state) => {
      if (!getAsset(kind)) return state;
      const recent = [kind, ...state.recent.filter((item) => item !== kind)].slice(0, 8);
      return { recent, storageUnavailable: save({ favorites: state.favorites, recent }) };
    }),
}));
