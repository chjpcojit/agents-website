import { readable } from 'svelte/store';
import { store } from '../sim/store';
import type { OfficeState } from '../sim/types';

/** Svelte store view over the mock orchestrator. / Svelte store bọc orchestrator giả lập. */
export const office = readable<OfficeState>(store.getState(), (set) => store.subscribe(() => set(store.getState())));

/** Short relative time, e.g. "12s", "4m". / Thời gian tương đối ngắn, vd "12s", "4m". */
export function ago(now: number, ts: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
