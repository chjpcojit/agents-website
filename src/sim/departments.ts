// Office floor plan: departments (zones/rooms) and their footprint on the floor.
// Mặt bằng văn phòng: các phòng ban (khu/phòng) và vị trí của chúng trên sàn.

export type DeptId = 'backend' | 'product' | 'qa' | 'platform' | 'lead' | 'meeting' | 'server' | 'pantry' | 'lounge';

export interface Department {
  id: DeptId;
  name: string;
  icon: string;
  /** Floor rectangle [x0, z0, x1, z1] in world units. / Hình chữ nhật trên sàn [x0, z0, x1, z1]. */
  rect: [number, number, number, number];
  /** Accent colour for carpet and sign. / Màu nhấn cho thảm và biển tên. */
  accent: string;
  /** Enclosed glass room vs open-plan zone. / Phòng kính kín hay khu open-plan. */
  enclosed: boolean;
  /** Whether agents sit here (shown in roster). / Có agent ngồi ở đây không (hiện trong roster). */
  hasTeam: boolean;
}

/** Floor spans x ∈ [-15, 15], z ∈ [-11, 11]. / Sàn trải x ∈ [-15, 15], z ∈ [-11, 11]. */
export const FLOOR = { x0: -15, x1: 15, z0: -11, z1: 11 } as const;

export const DEPARTMENTS: Department[] = [
  { id: 'meeting', name: 'Phòng họp · Office bus', icon: '📮', rect: [-15, -11, -8, -4], accent: '#f4b26b', enclosed: true, hasTeam: false },
  { id: 'backend', name: 'Backend', icon: '🛠️', rect: [-8, -11, 3, -4], accent: '#8fd3a8', enclosed: false, hasTeam: true },
  { id: 'lead', name: 'Tech Lead', icon: '🧭', rect: [3, -11, 9, -4], accent: '#f6b48c', enclosed: true, hasTeam: true },
  { id: 'server', name: 'Server room', icon: '🖥️', rect: [9, -11, 15, -4], accent: '#9aa6c7', enclosed: true, hasTeam: false },
  { id: 'qa', name: 'QA', icon: '🧪', rect: [-15, -3, -8, 4], accent: '#f5a3b8', enclosed: false, hasTeam: true },
  { id: 'product', name: 'Frontend & Mobile', icon: '📱', rect: [-8, -3, 5, 4], accent: '#9cc3f5', enclosed: false, hasTeam: true },
  { id: 'platform', name: 'Platform · DevOps', icon: '☁️', rect: [5, -3, 15, 4], accent: '#c3aef0', enclosed: false, hasTeam: true },
  { id: 'pantry', name: 'Pantry', icon: '☕', rect: [-15, 5, -5, 11], accent: '#e9cfa8', enclosed: false, hasTeam: false },
  { id: 'lounge', name: 'Lounge', icon: '🛋️', rect: [-5, 5, 15, 11], accent: '#bfe3d6', enclosed: false, hasTeam: false },
];

export const DEPT_BY_ID: Record<DeptId, Department> = Object.fromEntries(DEPARTMENTS.map((d) => [d.id, d])) as Record<DeptId, Department>;
