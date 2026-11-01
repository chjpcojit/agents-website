import { useSyncExternalStore } from 'react';
import { store } from './sim/store';
import type { OfficeState } from './sim/types';

/** Subscribe a component to the office store. / Cho component subscribe vào office store. */
export function useOffice(): OfficeState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Short relative time, e.g. "12s", "4m". / Thời gian tương đối ngắn, vd "12s", "4m". */
export function ago(now: number, ts: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
