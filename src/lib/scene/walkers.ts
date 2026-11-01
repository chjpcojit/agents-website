import { DEPT_BY_ID } from '../sim/departments';
import type { Agent } from '../sim/types';

// Walking navigation: characters move along two horizontal corridors joined by two vertical aisles,
// so routes never cut through desks or glass rooms.
// Điều hướng đi bộ: nhân vật đi theo hai hành lang ngang nối bằng hai lối đi dọc,
// nên đường đi không xuyên qua bàn hay phòng kính.

export interface V2 {
  x: number;
  z: number;
}

/** Corridor between the back row and the middle row. / Hành lang giữa dãy sau và dãy giữa. */
export const CORRIDOR_TOP = -3.5;
/** Corridor between the middle row and pantry/lounge. / Hành lang giữa dãy giữa và pantry/lounge. */
export const CORRIDOR_BOTTOM = 4.5;
/** Vertical aisles linking both corridors. / Lối đi dọc nối hai hành lang. */
const AISLES = [-8, 5];

/** Points (after `a`) to walk from corridor point `a` to corridor point `b`. / Các điểm (sau `a`) để đi từ điểm hành lang `a` tới `b`. */
export function corridorRoute(a: V2, b: V2): V2[] {
  if (Math.abs(a.z - b.z) < 1e-6) return [b];
  const cost = (x: number) => Math.abs(a.x - x) + Math.abs(b.x - x);
  const aisle = AISLES.reduce((best, x) => (cost(x) < cost(best) ? x : best));
  return [{ x: aisle, z: a.z }, { x: aisle, z: b.z }, b];
}

export type Activity = 'sip' | 'game' | 'pingpong' | 'chill' | 'snack';

/** A place an idle agent can hang out. / Một chỗ agent rảnh có thể ra chơi. */
export interface Spot {
  id: string;
  /** From a corridor point to the spot itself. / Từ một điểm hành lang tới chính chỗ đó. */
  path: V2[];
  /** Facing angle (rotation.y) while there. / Hướng mặt (rotation.y) khi ở đó. */
  face: number;
  /** Seat height when sitting, null when standing. / Độ cao chỗ ngồi, null nếu đứng. */
  seatY: number | null;
  activity: Activity;
  emoji: string;
}

export const ACTIVITY_PROP: Record<Activity, 'mug' | 'phone' | 'paddle' | null> = {
  sip: 'mug',
  game: 'phone',
  pingpong: 'paddle',
  chill: null,
  snack: null,
};

/** Chair position (where the character sits). / Vị trí ghế (chỗ nhân vật ngồi). */
export function chairOf(agent: Agent): V2 {
  return { x: agent.seat[0], z: agent.seat[1] - 1.05 };
}

/** Path from the chair (excluded) out to the top corridor. / Đường từ ghế (không tính) ra hành lang trên. */
export function homeExit(agent: Agent): V2[] {
  const [sx, sz] = agent.seat;
  const cz = sz - 1.05;
  if (agent.dept === 'lead') {
    // Leave the glass office through its front door. / Ra khỏi phòng kính qua cửa trước.
    const r = DEPT_BY_ID.lead.rect;
    const door = (r[0] + r[2]) / 2;
    const inside = r[3] - 1;
    return [{ x: sx + 1.4, z: cz }, { x: sx + 1.4, z: inside }, { x: door, z: inside }, { x: door, z: CORRIDOR_TOP }];
  }
  // Back row: step into the gap between desks, then walk out. / Dãy sau: bước vào khe giữa hai bàn rồi đi ra.
  if (sz < CORRIDOR_TOP) return [{ x: sx + 1.7, z: cz }, { x: sx + 1.7, z: CORRIDOR_TOP }];
  // Middle row: the corridor is right behind the chair. / Dãy giữa: hành lang ngay sau ghế.
  return [{ x: sx, z: CORRIDOR_TOP }];
}

/** From the top corridor to the chair. / Từ hành lang trên vào ghế. */
export function homeApproach(agent: Agent): V2[] {
  return [...homeExit(agent)].reverse().concat(chairOf(agent));
}

/** From the top corridor to a standing spot beside `agent`'s chair (for a chat). / Từ hành lang trên tới chỗ đứng cạnh ghế của `agent` (để nói chuyện). */
export function visitApproach(agent: Agent): V2[] {
  const [sx, sz] = agent.seat;
  if (sz < CORRIDOR_TOP) return [...homeExit(agent)].reverse();
  return [{ x: sx + 1.6, z: CORRIDOR_TOP }, { x: sx + 1.6, z: sz - 1.35 }];
}

/** Shortest signed angle difference. / Hiệu góc có dấu ngắn nhất. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
