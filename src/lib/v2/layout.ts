import { DEPARTMENTS, type DeptId } from '../sim/departments';
import type { Agent } from '../sim/types';

// Constellation layout: the orchestrator core sits in the centre, agents orbit it grouped by department.
// Bố cục chòm sao: core orchestrator ở giữa, các agent xoay quanh, nhóm theo phòng ban.

export const VIEW = { w: 1000, h: 760 } as const;
export const CORE = { x: 500, y: 380, r: 58 } as const;
export const RX = 300;
export const RY = 285;

export interface Point {
  x: number;
  y: number;
}

/** Which side of the orb the label goes on, so labels never stack on the orb below. / Nhãn nằm bên nào của orb, để không đè lên orb bên dưới. */
export type LabelSide = 'left' | 'right' | 'below';

export interface Constellation {
  nodes: Map<string, Point & { side: LabelSide }>;
  depts: { id: DeptId; name: string; accent: string; at: Point; anchor: 'start' | 'middle' | 'end' }[];
}

/** Place agents on an ellipse, leaving a gap between departments. / Đặt agent trên elip, chừa khoảng trống giữa các phòng ban. */
export function layoutConstellation(agents: Agent[]): Constellation {
  const teams = DEPARTMENTS.filter((d) => d.hasTeam && agents.some((a) => a.dept === d.id));
  const slots = agents.length + teams.length;
  const nodes = new Map<string, Point & { side: LabelSide }>();
  const depts: Constellation['depts'] = [];
  let i = 0;
  for (const d of teams) {
    const members = agents.filter((a) => a.dept === d.id);
    const angles: number[] = [];
    for (const a of members) {
      const ang = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / slots;
      angles.push(ang);
      const c = Math.cos(ang);
      nodes.set(a.id, { x: CORE.x + c * RX, y: CORE.y + Math.sin(ang) * RY, side: c > 0.3 ? 'right' : c < -0.3 ? 'left' : 'below' });
      i++;
    }
    i++; // gap between departments / khoảng trống giữa các phòng ban
    const mid = angles.reduce((s, v) => s + v, 0) / angles.length;
    // Department names sit inside the ring, between the core and their agents. / Tên phòng ban nằm trong vòng, giữa core và các agent.
    depts.push({
      id: d.id,
      name: d.name,
      accent: d.accent,
      at: { x: CORE.x + Math.cos(mid) * RX * 0.6, y: CORE.y + Math.sin(mid) * RY * 0.6 },
      anchor: 'middle',
    });
  }
  return { nodes, depts };
}

/** Quadratic curve from a to b bending towards the core. / Đường cong bậc hai từ a tới b, uốn về phía core. */
export function curveThroughCore(a: Point, b: Point, pull = 0.55): { c: Point; d: string } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const c = { x: mx + (CORE.x - mx) * pull, y: my + (CORE.y - my) * pull };
  return { c, d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}` };
}

export function pointOnQuad(a: Point, c: Point, b: Point, k: number): Point {
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}

// Data stores the agents touch, pinned to the four corners of the stage.
// Các kho dữ liệu mà agent truy xuất, ghim ở bốn góc của stage.
export type StoreId = 'repo' | 'github' | 'transcript' | 'db';

export interface DataStore extends Point {
  id: StoreId;
  name: string;
  path: string;
}

export const STORES: DataStore[] = [
  { id: 'repo', name: 'Git worktrees', path: '~/work/*/wt', x: 70, y: 64 },
  { id: 'github', name: 'GitHub', path: 'origin · PR', x: 930, y: 64 },
  { id: 'transcript', name: 'Transcripts', path: '~/.claude/projects', x: 70, y: 660 },
  { id: 'db', name: 'Orchestrator DB', path: 'SQLite · data.db', x: 930, y: 660 },
];

/** Direction of a data access: read flows store → agent, write flows agent → store. / Chiều truy xuất: read đi kho → agent, write đi agent → kho. */
export type AccessOp = 'read' | 'write';

/**
 * Map one stream event to the store it touches, mirroring what Claude Code really does on disk.
 * Ánh xạ một stream event sang kho nó chạm tới, bám theo những gì Claude Code thực sự làm trên đĩa.
 */
export function storeAccess(kind: string, text: string): { store: StoreId; op: AccessOp } | null {
  if (kind === 'tool_call') {
    if (/^(Read|Grep|Glob)\b/.test(text)) return { store: 'repo', op: 'read' };
    if (/^(Edit|Write)\b/.test(text)) return { store: 'repo', op: 'write' };
    if (/^Bash\b.*\b(git push|gh )/.test(text)) return { store: 'github', op: 'write' };
    if (/^Bash\b.*\b(git (fetch|pull)|gh pr view)/.test(text)) return { store: 'github', op: 'read' };
    if (/^Bash\b/.test(text)) return { store: 'repo', op: 'read' };
    return null;
  }
  // Session resume / compact read the transcript; every assistant turn is appended to it.
  // Resume / compact đọc transcript; mỗi lượt assistant được ghi nối vào transcript.
  if (kind === 'system' && /resum|compact/.test(text)) return { store: 'transcript', op: 'read' };
  if (kind === 'assistant') return { store: 'transcript', op: 'write' };
  return null;
}

/** Curve between two points that bows away from the core, so beams don't all cross the centre. / Đường cong giữa hai điểm, phình ra xa core để các tia không cùng cắt qua tâm. */
export function curveAwayFromCore(a: Point, b: Point, push = 0.35): { c: Point; d: string } {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const c = { x: mx + (mx - CORE.x) * push, y: my + (my - CORE.y) * push };
  return { c, d: `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}` };
}
