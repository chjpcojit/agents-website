import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DEPARTMENTS, DEPT_BY_ID, FLOOR, type Department } from '../sim/departments';
import { EMPTY_SEATS } from '../sim/mockData';
import type { Agent, AgentStatus, OfficeState, TaskStatus } from '../sim/types';
import { ACTIVITY_PROP, angleDelta, chairOf, corridorRoute, homeApproach, visitApproach, CORRIDOR_BOTTOM, type Spot, type V2 } from './walkers';

// Modern open-plan office (glass rooms, departments) built with plain three.js.
// Each agent is a chibi character sitting at a desk in its department.
// Văn phòng open-plan hiện đại (phòng kính, nhiều phòng ban) dựng bằng three.js thuần.
// Mỗi agent là một nhân vật chibi ngồi ở bàn trong phòng ban của mình.

export const STATUS_COLOR: Record<AgentStatus, string> = {
  working: '#5cc98a',
  idle: '#b9b2c8',
  waiting: '#f5b544',
  error: '#ef6b73',
  paused: '#7aa7e8',
};

const SCREEN_COLOR: Record<AgentStatus, string> = {
  working: '#8fdcff',
  idle: '#3b4660',
  waiting: '#ffd98a',
  error: '#ff8a8f',
  paused: '#9bb4d6',
};

const STATUS_EMOJI: Record<AgentStatus, string> = {
  working: '⌨️',
  idle: '☕',
  waiting: '✋',
  error: '💥',
  paused: '⏸️',
};

// Palette for the modern look. / Bảng màu cho phong cách hiện đại.
const C = {
  floor: '#e9eaee',
  wall: '#f7f7f8',
  frame: '#3b404c',
  deskTop: '#fbfbfa',
  wood: '#d9b48a',
  woodDark: '#b88c62',
  metal: '#2f333d',
  chair: '#40444f',
  glass: '#cfe6ff',
  sky: '#bfe3ff',
} as const;

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Shared flat-shaded material per colour. / Material flat-shaded dùng chung theo màu. */
function mat(color: string, rough = 0.8): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough, metalness: 0 });
    matCache.set(key, m);
  }
  return m;
}

const glassMat = new THREE.MeshStandardMaterial({ color: C.glass, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false });

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, rough = 0.8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, color: string, seg = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Tall modern planter (white pot, layered leaves). / Chậu cây hiện đại (chậu trắng, lá nhiều tầng). */
function plant(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const pot = cyl(0.36, 0.3, 0.7, '#f2f2f0', 12);
  pot.position.y = 0.35;
  g.add(pot);
  const greens = ['#5fb36b', '#73c27c', '#4fa25c'];
  const layers: [number, number, number, number][] = [[0, 1.1, 0, 0.55], [0.2, 1.55, 0.1, 0.42], [-0.15, 1.85, -0.05, 0.32]];
  layers.forEach(([px, py, pz, r], i) => {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(greens[i % 3] ?? '#5fb36b'));
    leaf.position.set(px, py, pz);
    leaf.castShadow = true;
    g.add(leaf);
  });
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

/** Office chair (dark mesh, 5-star base). / Ghế văn phòng (lưới tối, chân sao 5 cánh). */
function officeChair(color: string = C.chair): THREE.Group {
  const chair = new THREE.Group();
  chair.add(box(0.95, 0.16, 0.9, color, 0, 0.95, 0));
  chair.add(box(0.95, 1.05, 0.12, color, 0, 1.6, -0.45));
  const stem = cyl(0.06, 0.06, 0.8, C.metal, 6);
  stem.position.y = 0.45;
  chair.add(stem);
  for (let i = 0; i < 5; i++) {
    const leg = box(0.5, 0.06, 0.08, C.metal, 0, 0.08, 0);
    leg.rotation.y = (i / 5) * Math.PI * 2;
    leg.translateX(0.22);
    chair.add(leg);
  }
  return chair;
}

/** Modern desk: white top, black frame legs, monitor + keyboard. / Bàn hiện đại: mặt trắng, chân khung đen, màn hình + bàn phím. */
function modernDesk(): { group: THREE.Group; screen: THREE.Mesh; screenMat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  g.add(box(2.8, 0.1, 1.4, C.deskTop, 0, 1.45, 0, 0.5));
  for (const lx of [-1.3, 1.3]) {
    g.add(box(0.07, 1.4, 0.07, C.metal, lx, 0.7, -0.6));
    g.add(box(0.07, 1.4, 0.07, C.metal, lx, 0.7, 0.6));
    g.add(box(0.07, 0.07, 1.25, C.metal, lx, 0.15, 0));
  }
  g.add(box(2.6, 0.05, 0.05, C.metal, 0, 1.35, 0.6)); // modesty bar / thanh chắn

  // Monitor sits on the left corner, angled towards the character, so the face stays visible from the camera.
  // Màn hình đặt ở góc trái, xoay chéo về phía nhân vật, để camera vẫn thấy mặt nhân vật.
  const mon = new THREE.Group();
  mon.position.set(-0.75, 0, 0.25);
  mon.rotation.y = -0.55;
  mon.add(box(0.07, 0.36, 0.07, C.metal, 0, 1.68, 0.05));
  mon.add(box(0.36, 0.03, 0.26, C.metal, 0, 1.51, 0.05));
  mon.add(box(1.05, 0.62, 0.06, '#1f222a', 0, 2.1, 0));
  const screenMat = new THREE.MeshStandardMaterial({ color: '#111111', emissive: new THREE.Color('#8fdcff'), emissiveIntensity: 0.9 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.52), screenMat);
  screen.position.set(0, 2.1, -0.035);
  screen.rotation.y = Math.PI;
  mon.add(screen);
  g.add(mon);
  g.add(box(0.9, 0.04, 0.3, '#e4e6ec', 0.1, 1.52, -0.2)); // keyboard / bàn phím
  g.add(box(0.14, 0.04, 0.2, '#e4e6ec', 0.65, 1.52, -0.15)); // mouse / chuột
  return { group: g, screen, screenMat };
}

interface CharacterRig {
  agentId: string;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  legs: THREE.Group[];
  props: Record<'mug' | 'phone' | 'paddle', THREE.Object3D>;
  screenMat: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  label: HTMLDivElement;
  anchor: THREE.Vector3;
  phase: number;
}

/** Build desk + chair + chibi character for one agent. / Dựng bàn + ghế + nhân vật chibi cho một agent. */
function buildWorkstation(agent: Agent): Omit<CharacterRig, 'label'> {
  const [x, z] = agent.seat;
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  // Status ring on the floor under the chair. / Vòng trạng thái dưới chân ghế.
  const ringMat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR[agent.status], transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.06, -1.05);
  root.add(ring);

  const { group: desk, screenMat } = modernDesk();
  root.add(desk);
  const mug = cyl(0.11, 0.1, 0.22, agent.color, 10);
  mug.position.set(0.55, 1.61, 0.3);
  root.add(mug);
  const mini = plant(1.0, 0.35, 0.3);
  mini.position.y = 1.5;
  root.add(mini);

  const chair = officeChair();
  chair.position.set(0, 0, -1.05);
  root.add(chair);

  // Character (chibi: big head, small body). / Nhân vật chibi: đầu to, thân nhỏ.
  const body = new THREE.Group();
  body.position.set(0, 1.05, -1.05);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.35, 4, 10), mat(agent.color));
  torso.position.y = 0.55;
  torso.castShadow = true;
  body.add(torso);

  const armGeo = new THREE.CapsuleGeometry(0.12, 0.42, 3, 6);
  const armL = new THREE.Mesh(armGeo, mat(agent.color));
  armL.position.set(-0.45, 0.7, 0.2);
  armL.rotation.x = -1.1;
  armL.castShadow = true;
  const armR = armL.clone();
  armR.position.x = 0.45;
  body.add(armL, armR);

  // Legs pivot at the hip: forward when seated, swinging when walking. / Chân xoay quanh hông: duỗi trước khi ngồi, đung đưa khi đi.
  const legGeo = new THREE.CapsuleGeometry(0.13, 0.32, 3, 6);
  const legs = [-0.2, 0.2].map((lx) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.15, 0);
    const leg = new THREE.Mesh(legGeo, mat('#3d4252'));
    leg.position.y = -0.3;
    leg.castShadow = true;
    pivot.add(leg);
    body.add(pivot);
    return pivot;
  });

  // Hand-held props, shown per activity. / Đồ cầm tay, hiện theo hoạt động.
  const mugProp = cyl(0.1, 0.09, 0.2, '#ffffff', 10);
  mugProp.position.set(0, -0.4, 0.08);
  const phoneProp = box(0.2, 0.04, 0.3, '#22252f', 0, -0.42, 0.12);
  const paddleProp = new THREE.Group();
  const blade = cyl(0.2, 0.2, 0.04, '#ef6b73', 14);
  blade.rotation.z = Math.PI / 2;
  blade.position.y = -0.62;
  paddleProp.add(blade, box(0.05, 0.2, 0.05, C.woodDark, 0, -0.42, 0));
  for (const prop of [mugProp, phoneProp, paddleProp]) {
    prop.visible = false;
    armR.add(prop);
  }

  const head = new THREE.Group();
  head.position.y = 1.45;
  const skin = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), mat('#ffe0c7'));
  skin.castShadow = true;
  head.add(skin);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.585, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mat(agent.hair));
  hair.rotation.x = -0.35;
  hair.castShadow = true;
  head.add(hair);
  const eyeGeo = new THREE.SphereGeometry(0.065, 8, 6);
  for (const ex of [-0.19, 0.19]) {
    const eye = new THREE.Mesh(eyeGeo, mat('#2b2333'));
    eye.position.set(ex, -0.02, 0.51);
    eye.scale.set(1, 1.3, 0.6);
    head.add(eye);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: '#ff9fae', transparent: true, opacity: 0.7 }));
    blush.position.set(ex * 1.55, -0.16, 0.5);
    blush.rotation.y = ex * 0.6;
    head.add(blush);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 10, Math.PI), mat('#8a3d4a'));
  mouth.position.set(0, -0.17, 0.53);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  // Headphones for a modern dev vibe. / Tai nghe cho đúng chất dev hiện đại.
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 16, Math.PI), mat(C.metal));
  band.position.y = 0.05;
  head.add(band);
  for (const hx of [-0.6, 0.6]) head.add(box(0.12, 0.26, 0.26, C.metal, hx, 0.02, 0));
  body.add(head);
  root.add(body);

  // Tag meshes so a raycast hit maps back to the agent. / Gắn tag để raycast trỏ ngược về agent.
  root.traverse((o) => (o.userData.agentId = agent.id));

  return {
    agentId: agent.id, root, body, head, armL, armR, legs, props: { mug: mugProp, phone: phoneProp, paddle: paddleProp }, screenMat, ring, ringMat,
    anchor: new THREE.Vector3(x, 3.75, z - 1.05), phase: Math.random() * Math.PI * 2,
  };
}

/** Axis-aligned glass partition, with an optional door gap at offset `door`. / Vách kính song song trục, có thể chừa cửa tại vị trí `door`. */
function glassWall(scene: THREE.Scene, x0: number, z0: number, x1: number, z1: number, door?: number): void {
  const H = 3.0;
  const alongX = Math.abs(z1 - z0) < 1e-6;
  const len = alongX ? x1 - x0 : z1 - z0;
  const segments: [number, number][] = door === undefined ? [[0, len]] : [[0, door - 0.9], [door + 0.9, len]];
  for (const [a, b] of segments) {
    const w = b - a;
    if (w < 0.05) continue;
    const mid = (a + b) / 2;
    const cx = alongX ? x0 + mid : x0;
    const cz = alongX ? z0 : z0 + mid;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : 0.06, H, alongX ? 0.06 : w), glassMat);
    pane.position.set(cx, H / 2, cz);
    scene.add(pane);
    // Thin aluminium frame: top rail, bottom rail, posts. / Khung nhôm mảnh: ray trên, ray dưới, trụ.
    scene.add(box(alongX ? w : 0.09, 0.09, alongX ? 0.09 : w, C.frame, cx, H, cz));
    scene.add(box(alongX ? w : 0.09, 0.09, alongX ? 0.09 : w, C.frame, cx, 0.05, cz));
    const posts = Math.max(1, Math.round(w / 2.2));
    for (let i = 0; i <= posts; i++) {
      const t = a + (w * i) / posts;
      scene.add(box(0.08, H, 0.08, C.frame, alongX ? x0 + t : x0, H / 2, alongX ? z0 : z0 + t));
    }
  }
}

function carpet(scene: THREE.Scene, d: Department, inset: number): void {
  const [x0, z0, x1, z1] = d.rect;
  const c = new THREE.Color(d.accent).lerp(new THREE.Color('#ffffff'), 0.45);
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - inset * 2, 0.04, z1 - z0 - inset * 2), new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
  m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
  m.receiveShadow = true;
  scene.add(m);
}

/** Static floor plan: shell, departments, furniture. / Mặt bằng tĩnh: vỏ toà nhà, phòng ban, nội thất. */
function buildOffice(scene: THREE.Scene): { leds: THREE.Mesh[]; notes: THREE.Mesh[]; hub: THREE.Vector3; tv: THREE.MeshBasicMaterial; spots: Spot[] } {
  const spots: Spot[] = [];
  const { x0, x1, z0, z1 } = FLOOR;
  const W = x1 - x0;
  const D = z1 - z0;

  // Polished concrete floor + slab edge. / Sàn bê tông mài + viền sàn.
  scene.add(box(W, 0.5, D, C.floor, 0, -0.25, 0, 0.6));
  scene.add(box(W + 0.3, 0.2, D + 0.3, '#cfd2d9', 0, -0.55, 0));

  // Outer walls with floor-to-ceiling windows. / Tường ngoài với cửa kính kịch trần.
  const WH = 5.2;
  scene.add(box(W, WH, 0.3, C.wall, 0, WH / 2, z0 - 0.15));
  scene.add(box(0.3, WH, D, C.wall, x0 - 0.15, WH / 2, 0));
  const skyMat = new THREE.MeshBasicMaterial({ color: C.sky });
  for (let wx = x0 + 9; wx < x1 - 2; wx += 3) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), skyMat);
    sky.position.set(wx + 1.5, 2.5, z0 + 0.01);
    scene.add(sky);
    scene.add(box(0.12, 3.9, 0.1, C.frame, wx, 2.5, z0 + 0.05));
  }
  for (let wz = z0 + 15; wz < z1 - 2; wz += 3) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), skyMat);
    sky.rotation.y = Math.PI / 2;
    sky.position.set(x0 + 0.01, 2.5, wz + 1.5);
    scene.add(sky);
    scene.add(box(0.1, 3.9, 0.12, C.frame, x0 + 0.05, 2.5, wz));
  }

  // Department floors: carpet for open-plan, glass for enclosed rooms. / Sàn phòng ban: thảm cho open-plan, kính cho phòng kín.
  for (const d of DEPARTMENTS) {
    const [rx0, rz0, rx1, rz1] = d.rect;
    if (d.id === 'pantry' || d.id === 'lounge') {
      // Warm wood floor for social areas. / Sàn gỗ ấm cho khu sinh hoạt.
      const wood = box(rx1 - rx0 - 0.2, 0.04, rz1 - rz0 - 0.2, d.id === 'pantry' ? '#ead3b0' : '#e4d6c3', (rx0 + rx1) / 2, 0.02, (rz0 + rz1) / 2);
      wood.castShadow = false;
      scene.add(wood);
      continue;
    }
    carpet(scene, d, d.enclosed ? 0.1 : 0.4);
    if (d.enclosed) {
      // Front wall (towards camera) gets the door. / Vách trước (hướng camera) có cửa.
      glassWall(scene, rx0, rz1, rx1, rz1, (rx1 - rx0) / 2);
      if (rx1 < x1) glassWall(scene, rx1, rz0, rx1, rz1);
      if (rx0 > x0) glassWall(scene, rx0, rz0, rx0, rz1);
    }
  }

  // --- Meeting room = office bus hub. / Phòng họp = trạm office bus. ---
  const meet = DEPT_BY_ID.meeting.rect;
  const mx = (meet[0] + meet[2]) / 2;
  const mz = (meet[1] + meet[3]) / 2 + 0.3;
  scene.add(box(4.2, 0.12, 1.7, C.wood, mx, 1.35, mz, 0.5));
  scene.add(box(0.15, 1.3, 1.2, C.metal, mx - 1.6, 0.65, mz));
  scene.add(box(0.15, 1.3, 1.2, C.metal, mx + 1.6, 0.65, mz));
  for (const cx of [-1.3, 0, 1.3]) {
    for (const side of [-1, 1]) {
      const ch = officeChair('#f4b26b');
      ch.position.set(mx + cx, 0, mz + side * 1.35);
      ch.rotation.y = side > 0 ? Math.PI : 0;
      ch.scale.setScalar(0.8);
      scene.add(ch);
    }
  }
  // Wall TV showing the bus. / TV treo tường hiển thị office bus.
  scene.add(box(3.4, 1.9, 0.1, '#16181f', mx, 3.1, meet[1] + 0.12));
  const tv = new THREE.MeshBasicMaterial({ color: '#7cc4ff' });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.7), tv);
  tvScreen.position.set(mx, 3.1, meet[1] + 0.18);
  scene.add(tvScreen);
  const mailbox = new THREE.Group();
  mailbox.position.set(mx, 1.41, mz);
  mailbox.add(box(0.6, 0.45, 0.42, '#ef6b73', 0, 0.23, 0));
  mailbox.add(box(0.05, 0.36, 0.05, '#f6c453', 0.36, 0.45, 0));
  scene.add(mailbox);
  scene.add(plant(meet[2] - 0.7, meet[1] + 0.7, 1.0));

  // --- Tech Lead office: bookshelf, armchair, plant. / Phòng Tech Lead: kệ sách, ghế bành, cây. ---
  const lead = DEPT_BY_ID.lead.rect;
  scene.add(box(2.4, 2.8, 0.5, C.woodDark, lead[0] + 1.6, 1.4, lead[1] + 0.35));
  const bookColors = ['#ef6b73', '#7aa7e8', '#f6c453', '#5cc98a', '#b59ae8'];
  for (let shelf = 0; shelf < 3; shelf++) {
    for (let b = 0; b < 6; b++) {
      scene.add(box(0.22, 0.55, 0.3, bookColors[(b + shelf) % bookColors.length] ?? '#cccccc', lead[0] + 0.8 + b * 0.32, 0.5 + shelf * 0.85, lead[1] + 0.55));
    }
  }
  scene.add(box(1.2, 0.6, 1.1, '#6c6a86', lead[2] - 1.2, 0.5, lead[1] + 1.2));
  scene.add(box(1.2, 1.0, 0.25, '#5b5975', lead[2] - 1.2, 1.0, lead[1] + 0.7));
  scene.add(plant(lead[2] - 0.6, lead[3] - 0.7, 0.9));

  // --- Server room: racks with blinking LEDs. / Server room: tủ rack với LED nhấp nháy. ---
  const srv = DEPT_BY_ID.server.rect;
  const leds: THREE.Mesh[] = [];
  const ledGeo = new THREE.BoxGeometry(0.12, 0.07, 0.02);
  for (let r = 0; r < 3; r++) {
    const rx = srv[0] + 1.3 + r * 1.7;
    const rz = srv[1] + 2.0;
    scene.add(box(1.2, 3.4, 1.0, '#2c2f3a', rx, 1.7, rz, 0.4));
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 3; j++) {
        const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: '#5cc98a' }));
        led.position.set(rx - 0.3 + j * 0.3, 0.6 + i * 0.4, rz + 0.51);
        scene.add(led);
        leds.push(led);
      }
    }
  }
  scene.add(box(5.2, 0.5, 0.6, '#9aa6c7', (srv[0] + srv[2]) / 2, 4.2, srv[1] + 0.4)); // cooling unit / máy lạnh

  // --- Task board on the QA wall (sticky notes mirror task status). / Bảng task trên tường QA (giấy note phản ánh trạng thái task). ---
  const qa = DEPT_BY_ID.qa.rect;
  const bz = (qa[1] + qa[3]) / 2;
  scene.add(box(0.1, 2.4, 5.0, '#ffffff', x0 + 0.06, 2.8, bz));
  scene.add(box(0.06, 2.6, 5.2, C.frame, x0 + 0.02, 2.8, bz));
  const notes: THREE.Mesh[] = [];
  const noteGeo = new THREE.PlaneGeometry(0.6, 0.52);
  for (let i = 0; i < 18; i++) {
    const n = new THREE.Mesh(noteGeo, new THREE.MeshStandardMaterial({ color: '#ffe680', roughness: 1 }));
    const col = Math.floor(i / 6);
    const row = i % 6;
    n.position.set(x0 + 0.13, 3.7 - (row % 3) * 0.66, bz - 2.1 + col * 1.5 + (row >= 3 ? 0.7 : 0));
    n.rotation.y = Math.PI / 2;
    n.rotation.z = (Math.random() - 0.5) * 0.15;
    scene.add(n);
    notes.push(n);
  }

  // --- Pantry: kitchen counter, fridge, coffee, high table. / Pantry: quầy bếp, tủ lạnh, cà phê, bàn cao. ---
  const pan = DEPT_BY_ID.pantry.rect;
  scene.add(box(0.9, 1.4, 4.6, '#ffffff', x0 + 0.5, 0.7, pan[1] + 3.2));
  scene.add(box(1.0, 0.08, 4.7, C.frame, x0 + 0.5, 1.44, pan[1] + 3.2));
  scene.add(box(1.0, 3.0, 1.0, '#dfe3ea', x0 + 0.55, 1.5, pan[1] + 0.6));
  scene.add(box(0.6, 0.75, 0.55, C.metal, x0 + 0.55, 1.85, pan[1] + 2.4));
  scene.add(box(0.3, 0.1, 0.2, '#ef6b73', x0 + 0.9, 2.1, pan[1] + 2.4));
  const bowl = cyl(0.35, 0.25, 0.18, '#f2f2f0');
  bowl.position.set(x0 + 0.5, 1.58, pan[1] + 4.2);
  scene.add(bowl);
  for (const [i, cz] of [7.4, 9.0].entries()) {
    spots.push({ id: `coffee${i}`, path: [{ x: x0 + 1.5, z: CORRIDOR_BOTTOM }, { x: x0 + 1.5, z: cz }], face: -Math.PI / 2, seatY: null, activity: 'sip', emoji: '☕' });
  }
  const htx = (pan[0] + pan[2]) / 2 + 1.2;
  const htz = (pan[1] + pan[3]) / 2;
  const top = cyl(1.0, 1.0, 0.1, C.wood, 20);
  top.position.set(htx, 1.6, htz);
  scene.add(top);
  const stem = cyl(0.08, 0.3, 1.55, C.metal, 8);
  stem.position.set(htx, 0.78, htz);
  scene.add(stem);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const sx = htx + Math.cos(a) * 1.35;
    const sz = htz + Math.sin(a) * 1.35;
    // Front stools (reachable straight from the corridor) become snack spots. / Ghế phía trước (đi thẳng từ hành lang) thành chỗ ăn vặt.
    if (sz < htz) spots.push({ id: `stool${i}`, path: [{ x: sx, z: CORRIDOR_BOTTOM }, { x: sx, z: sz }], face: Math.atan2(htx - sx, htz - sz), seatY: 1.17, activity: 'snack', emoji: '🍪' });
    const stool = cyl(0.3, 0.3, 0.1, '#f4b26b');
    stool.position.set(sx, 1.1, sz);
    scene.add(stool);
    const leg = cyl(0.04, 0.04, 1.05, C.metal, 6);
    leg.position.set(sx, 0.53, sz);
    scene.add(leg);
  }

  // --- Lounge: sofa, coffee table, beanbags, ping-pong table. / Lounge: sofa, bàn trà, ghế lười, bàn bóng bàn. ---
  const lou = DEPT_BY_ID.lounge.rect;
  // Sofa faces the camera (+z) with a coffee table and beanbags in front. / Sofa quay về camera (+z), bàn trà và ghế lười phía trước.
  const sx = lou[0] + 4;
  const sz = lou[1] + 1.6;
  scene.add(box(4.0, 0.6, 1.2, '#7fb7a6', sx, 0.4, sz));
  scene.add(box(4.0, 1.0, 0.3, '#6aa392', sx, 0.95, sz - 0.5));
  scene.add(box(0.3, 0.8, 1.2, '#6aa392', sx - 2.0, 0.6, sz));
  scene.add(box(0.3, 0.8, 1.2, '#6aa392', sx + 2.0, 0.6, sz));
  const rug = cyl(2.6, 2.6, 0.03, '#f3ead9', 28);
  rug.position.set(sx, 0.05, sz + 2.2);
  scene.add(rug);
  scene.add(box(1.8, 0.45, 1.0, C.wood, sx, 0.35, sz + 2.0));
  for (const [i, dx] of [-1.2, 0, 1.2].entries()) {
    spots.push({
      id: `sofa${i}`,
      path: [{ x: sx + 2.6, z: CORRIDOR_BOTTOM }, { x: sx + 2.6, z: sz + 0.9 }, { x: sx + dx, z: sz + 0.9 }, { x: sx + dx, z: sz }],
      face: 0, seatY: 0.72, activity: i === 1 ? 'chill' : 'game', emoji: i === 1 ? '😌' : '🎮',
    });
  }
  const beans: [number, string][] = [[-1.7, '#f6c453'], [1.7, '#ef8f9f']];
  for (const [dx, col] of beans) {
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), mat(col));
    bean.scale.set(1, 0.6, 1);
    bean.position.set(sx + dx, 0.4, sz + 3.8);
    bean.castShadow = true;
    scene.add(bean);
    const side = dx < 0 ? sx - 2.7 : sx + 2.7;
    spots.push({
      id: `bean${dx}`,
      path: [{ x: side, z: CORRIDOR_BOTTOM }, { x: side, z: sz + 3.8 }, { x: sx + dx, z: sz + 3.8 }],
      face: Math.PI, seatY: 0.68, activity: dx < 0 ? 'game' : 'chill', emoji: dx < 0 ? '🎮' : '📖',
    });
  }
  const ppx = lou[2] - 4.5;
  const ppz = (lou[1] + lou[3]) / 2;
  scene.add(box(4.2, 0.1, 2.3, '#3d8f6e', ppx, 1.2, ppz, 0.5));
  scene.add(box(0.04, 0.12, 2.3, '#ffffff', ppx, 1.27, ppz));
  scene.add(box(0.05, 0.3, 2.5, C.metal, ppx, 1.38, ppz));
  for (const lx of [-1.8, 1.8]) for (const lz of [-0.9, 0.9]) scene.add(box(0.1, 1.15, 0.1, C.metal, ppx + lx, 0.58, ppz + lz));
  for (const side of [-1, 1]) {
    const px = ppx + side * 2.8;
    spots.push({ id: `pong${side}`, path: [{ x: px, z: CORRIDOR_BOTTOM }, { x: px, z: ppz }], face: side < 0 ? Math.PI / 2 : -Math.PI / 2, seatY: null, activity: 'pingpong', emoji: '🏓' });
  }

  // Plants along the windows and aisles. / Cây xanh dọc cửa kính và lối đi.
  // Kept off the corridors so walkers don't clip them. / Đặt ngoài hành lang để nhân vật không đi xuyên.
  scene.add(plant(x0 + 0.8, 3.3, 1.1), plant(14.3, -2.6, 1.1), plant(14.3, 10.3, 1.3), plant(-4.4, 10.3, 1.2), plant(2.6, -10.3, 1.0));

  return { leds, notes, hub: new THREE.Vector3(mx, 2.2, mz), tv, spots };
}

const NOTE_COLOR: Partial<Record<TaskStatus, string>> = {
  queued: '#ffe680',
  running: '#9fe0b5',
  review: '#a9c8ff',
  done: '#e7dcf7',
  failed: '#ffb3b8',
};

export interface OfficeSceneHandle {
  dispose: () => void;
  update: (state: OfficeState) => void;
}

/** Mount the scene in a container; returns update/dispose. / Gắn scene vào container; trả về update/dispose. */
export function createOfficeScene(container: HTMLElement, initial: OfficeState, onSelect: (agentId: string | null) => void): OfficeSceneHandle {
  let state = initial;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const labelLayer = document.createElement('div');
  labelLayer.className = 'scene-labels';
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
  camera.position.set(30, 27, 30);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#ffffff', '#dfe3f0', 1.7));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.1);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const { leds, notes, hub, tv, spots } = buildOffice(scene);

  // Empty desks = room to "hire" more agents (screens off). / Bàn trống = chỗ cho agent mới (màn hình tắt).
  for (const [ex, ez] of EMPTY_SEATS) {
    const { group, screen } = modernDesk();
    screen.material = mat('#2a2d36');
    group.position.set(ex, 0, ez);
    scene.add(group);
    const ch = officeChair();
    ch.position.set(ex, 0, ez - 1.05);
    scene.add(ch);
  }

  // Department signs (DOM overlay, crisp text). / Biển tên phòng ban (DOM overlay, chữ sắc nét).
  const deptLabels = DEPARTMENTS.map((d) => {
    const el = document.createElement('div');
    el.className = 'dept-label';
    el.style.setProperty('--accent', d.accent);
    el.innerHTML = `<span>${d.icon}</span>${d.name}<b></b>`;
    labelLayer.appendChild(el);
    const [rx0, rz0, rx1, rz1] = d.rect;
    const count = el.querySelector('b') as HTMLElement;
    // Zones against the back wall get a wall sign; others sit on the floor near their front edge.
    // Khu sát tường sau thì treo biển trên tường; khu khác đặt biển trên sàn sát mép trước.
    const onWall = d.enclosed || rz0 <= FLOOR.z0;
    const pos = onWall ? new THREE.Vector3((rx0 + rx1) / 2, 3.6, rz0 + 0.3) : new THREE.Vector3((rx0 + rx1) / 2, 0.1, rz1 - 0.3);
    return { d, el, count, pos };
  });

  const rigs = new Map<string, CharacterRig>();
  for (const a of state.agents) {
    const rig = buildWorkstation(a);
    scene.add(rig.root);
    const label = document.createElement('div');
    label.className = 'agent-label';
    label.addEventListener('click', () => onSelect(a.id));
    labelLayer.appendChild(label);
    rigs.set(a.id, { ...rig, label });
  }

  // Envelope meshes for bus messages in flight. / Mesh phong thư cho tin nhắn đang bay.
  const envGeo = new THREE.BoxGeometry(0.55, 0.36, 0.06);
  const sealMat = new THREE.MeshBasicMaterial({ color: '#ef6b73' });
  const envelopes = new Map<string, THREE.Group>();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minZoom = 0.7;
  controls.maxZoom = 3;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.15;
  controls.minAzimuthAngle = 0.15;
  controls.maxAzimuthAngle = 1.4;
  controls.target.set(0, 0.5, 0);

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = w / h;
    // Fit the floor both ways; portrait screens crop the far corners to keep characters readable.
    // Vừa khít mặt sàn; màn hình dọc cắt bớt góc xa để nhân vật vẫn đủ to.
    const size = Math.max(12, (aspect < 1 ? 14.5 : 18.5) / aspect);
    camera.left = -size * aspect;
    camera.right = size * aspect;
    camera.top = size;
    camera.bottom = -size;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Click selection via raycast. / Chọn nhân vật bằng raycast.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt = { x: 0, y: 0 };
  const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // was a drag / là thao tác kéo
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...rigs.values()].map((r) => r.root), true)[0];
    onSelect((hit?.object.userData.agentId as string | undefined) ?? null);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  const deskWorld = (agentId: string) => rigs.get(agentId)?.anchor.clone().setY(3.4) ?? hub.clone();
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let t = 0;
  let raf = 0;

  // ---- Walkers: per-agent movement state (visual only, driven by agent status + bus flights). ----
  // ---- Walker: trạng thái di chuyển của từng agent (chỉ là hình ảnh, dựa trên status + tin nhắn bus). ----
  type Place = { kind: 'home' } | { kind: 'spot'; spot: Spot } | { kind: 'visit'; target: string };
  interface Walker {
    pos: V2;
    facing: number;
    place: Place;
    dest: Place | null;
    path: V2[];
    speed: number;
    until: number;
    nextWander: number;
    visitQueue: string[];
  }
  const HOME: Place = { kind: 'home' };
  const agentById = () => new Map(state.agents.map((a) => [a.id, a]));
  const walkers = new Map<string, Walker>();
  for (const a of state.agents) {
    walkers.set(a.id, { pos: chairOf(a), facing: 0, place: HOME, dest: null, path: [], speed: 3, until: 0, nextWander: 1 + Math.random() * 3, visitQueue: [] });
  }

  /** Path from the corridor into a place. / Đường từ hành lang vào một chỗ. */
  const approach = (agent: Agent, place: Place, byId: Map<string, Agent>): V2[] => {
    if (place.kind === 'home') return homeApproach(agent);
    if (place.kind === 'spot') return place.spot.path;
    const target = byId.get(place.target);
    return target ? visitApproach(target) : homeApproach(agent);
  };

  /** Plan a walk: leave the current place to its corridor, route through aisles, enter the destination. / Lập đường: ra hành lang, đi qua lối dọc, vào đích. */
  const go = (agent: Agent, w: Walker, dest: Place, byId: Map<string, Agent>, speed = 3) => {
    const out = [...approach(agent, w.place, byId)].reverse().slice(1);
    const inn = approach(agent, dest, byId);
    const from = out[out.length - 1] ?? w.pos;
    const first = inn[0] ?? from;
    w.path = [...out, ...corridorRoute(from, first), ...inn.slice(1)];
    w.dest = dest;
    w.speed = speed;
  };

  const takenSpots = () => {
    const ids = new Set<string>();
    for (const w of walkers.values()) {
      if (w.place.kind === 'spot') ids.add(w.place.spot.id);
      if (w.dest?.kind === 'spot') ids.add(w.dest.spot.id);
    }
    return ids;
  };
  const freeSpot = (exclude?: string): Spot | undefined => {
    const taken = takenSpots();
    const free = spots.filter((sp) => !taken.has(sp.id) && sp.id !== exclude);
    return free[Math.floor(Math.random() * free.length)];
  };

  const place = (el: HTMLElement, p: THREE.Vector3, w: number, h: number) => {
    tmp.copy(p).project(camera);
    el.style.transform = `translate(-50%, -100%) translate(${((tmp.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
  };

  const syncLabels = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const rig of rigs.values()) {
      // Label follows the character, wherever it walks. / Label đi theo nhân vật dù đi đâu.
      rig.anchor.set(rig.root.position.x + rig.body.position.x, rig.body.position.y + 2.7, rig.root.position.z + rig.body.position.z);
      place(rig.label, rig.anchor, w, h);
    }
    for (const dl of deptLabels) place(dl.el, dl.pos, w, h);
  };

  const renderLabel = (a: Agent, rig: CharacterRig, emoji: string) => {
    const selected = state.selectedAgentId === a.id;
    const key = `${a.name}|${a.status}|${selected}|${Math.round(a.context * 100)}|${emoji}`;
    if (rig.label.dataset.key === key) return;
    rig.label.dataset.key = key;
    rig.label.className = `agent-label status-${a.status}${selected ? ' selected' : ''}`;
    rig.label.innerHTML = `<span class="bubble">${emoji}</span><span class="name">${a.name}</span><span class="ctx"><i style="width:${Math.round(a.context * 100)}%"></i></span>`;
  };

  // Turn new agent→agent bus messages into desk visits when the sender is free to walk.
  // Chuyển tin nhắn agent→agent mới thành chuyến đi tới bàn nếu người gửi đang ở bàn.
  const seenFlights = new Set<string>();
  const walkedFlights = new Set<string>();
  const absorbFlights = () => {
    const live = new Set(state.flights.map((f) => f.id));
    for (const id of seenFlights) if (!live.has(id)) seenFlights.delete(id);
    for (const id of walkedFlights) if (!live.has(id)) walkedFlights.delete(id);
    for (const f of state.flights) {
      if (seenFlights.has(f.id)) continue;
      seenFlights.add(f.id);
      const w = walkers.get(f.from);
      if (w && f.to !== f.from && walkers.has(f.to) && w.place.kind === 'home' && w.path.length === 0 && w.visitQueue.length === 0) {
        w.visitQueue.push(f.to);
        walkedFlights.add(f.id);
      }
    }
  };

  const animate = () => {
    raf = requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;
    controls.update();
    absorbFlights();
    const byId = agentById();

    // Who is currently chatting at whose desk. / Ai đang đứng nói chuyện ở bàn ai.
    const visitorOf = new Map<string, string>();
    for (const [id, w] of walkers) if (w.place.kind === 'visit' && w.path.length === 0) visitorOf.set(w.place.target, id);

    for (const a of state.agents) {
      const rig = rigs.get(a.id);
      const w = walkers.get(a.id);
      if (!rig || !w) continue;
      const p = t + rig.phase;
      const idle = a.status === 'idle';

      // 1) Decide what to do next when not walking. / 1) Quyết định việc tiếp theo khi đang đứng yên.
      if (w.path.length === 0) {
        if (w.place.kind === 'home') {
          const target = w.visitQueue.shift();
          if (target) go(a, w, { kind: 'visit', target }, byId);
          else if (idle && t > w.nextWander) {
            const spot = freeSpot();
            if (spot) go(a, w, { kind: 'spot', spot }, byId);
            else w.nextWander = t + 4;
          }
        } else if (w.place.kind === 'spot') {
          if (!idle) go(a, w, HOME, byId, 4.5); // got work → hurry back / có việc → về bàn nhanh
          else if (t > w.until) {
            const next = Math.random() < 0.4 ? freeSpot(w.place.spot.id) : undefined;
            go(a, w, next ? { kind: 'spot', spot: next } : HOME, byId);
          }
        } else if (t > w.until) {
          go(a, w, HOME, byId);
        }
      }

      // 2) Move along the path. / 2) Di chuyển theo đường.
      const walking = w.path.length > 0;
      if (walking) {
        const target = w.path[0] as V2;
        const dx = target.x - w.pos.x;
        const dz = target.z - w.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = w.speed * dt;
        if (dist > 1e-4) w.facing += angleDelta(w.facing, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
        if (dist <= step) {
          w.pos = { ...target };
          w.path.shift();
          if (w.path.length === 0 && w.dest) {
            // Arrived. / Đã tới nơi.
            w.place = w.dest;
            w.dest = null;
            if (w.place.kind === 'spot') w.until = t + 8 + Math.random() * 10;
            if (w.place.kind === 'visit') w.until = t + 3.2;
            if (w.place.kind === 'home') w.nextWander = t + 6 + Math.random() * 8;
          }
        } else {
          w.pos = { x: w.pos.x + (dx / dist) * step, z: w.pos.z + (dz / dist) * step };
        }
      }

      // 3) Pose. / 3) Tư thế.
      rig.ringMat.color.set(STATUS_COLOR[a.status]);
      rig.screenMat.emissive.set(SCREEN_COLOR[a.status]);
      const selected = state.selectedAgentId === a.id;
      rig.ring.scale.setScalar(selected ? 1.15 + Math.sin(t * 4) * 0.05 : 1);
      rig.ringMat.opacity = selected ? 1 : 0.7;

      rig.body.rotation.set(0, 0, 0);
      rig.head.rotation.set(0, 0, 0);
      rig.armL.rotation.set(-1.1, 0, 0);
      rig.armR.rotation.set(-1.1, 0, 0);
      rig.armL.position.z = 0.2;
      rig.armR.position.z = 0.2;
      for (const leg of rig.legs) leg.rotation.x = -Math.PI / 2;
      const activity = w.place.kind === 'spot' && !walking ? w.place.spot.activity : null;
      for (const [name, prop] of Object.entries(rig.props)) prop.visible = !!activity && ACTIVITY_PROP[activity] === name;
      const [sx, sz] = a.seat;
      let emoji = STATUS_EMOJI[a.status];

      if (w.place.kind === 'home' && !walking) {
        // Seated at the desk: status animation. / Ngồi ở bàn: animation theo trạng thái.
        rig.body.position.set(0, 1.05, -1.05);
        const visitor = visitorOf.get(a.id);
        switch (a.status) {
          case 'working':
            rig.armL.rotation.x = -1.2 + Math.sin(p * 18) * 0.18;
            rig.armR.rotation.x = -1.2 + Math.sin(p * 18 + 1.7) * 0.18;
            rig.head.rotation.x = 0.1 + Math.sin(p * 2) * 0.03;
            rig.screenMat.emissiveIntensity = 0.8 + Math.sin(p * 9) * 0.15;
            break;
          case 'idle':
            rig.body.position.y = 1.05 + Math.sin(p * 1.5) * 0.03;
            rig.head.rotation.z = Math.sin(p * 0.8) * 0.12;
            rig.armL.rotation.x = -0.3;
            rig.armR.rotation.x = -0.3;
            rig.screenMat.emissiveIntensity = 0.35;
            break;
          case 'waiting':
            rig.body.position.y = 1.05 + Math.abs(Math.sin(p * 4)) * 0.18;
            rig.armR.rotation.x = -2.9 + Math.sin(p * 6) * 0.15; // raised hand / giơ tay
            rig.head.rotation.y = Math.sin(p * 1.2) * 0.35;
            rig.screenMat.emissiveIntensity = 0.7 + Math.sin(p * 5) * 0.3;
            break;
          case 'error':
            rig.body.position.x = Math.sin(p * 40) * 0.03;
            rig.head.rotation.z = 0.25;
            rig.head.rotation.x = 0.3;
            rig.screenMat.emissiveIntensity = Math.sin(p * 8) > 0 ? 1.2 : 0.4;
            break;
          case 'paused':
            rig.head.rotation.x = 0.45; // dozing / ngủ gật
            rig.body.position.y = 1.0;
            rig.screenMat.emissiveIntensity = 0.25;
            break;
        }
        if (visitor) {
          // Turn to face the colleague who came over. / Quay sang người đồng nghiệp vừa tới.
          const vw = walkers.get(visitor);
          if (vw) rig.head.rotation.y = THREE.MathUtils.clamp(Math.atan2(vw.pos.x - w.pos.x, vw.pos.z - w.pos.z), -1.3, 1.3);
          emoji = '💬';
        }
      } else {
        // Away from the desk: walking, hanging out, or chatting. / Rời bàn: đang đi, đang chơi, hoặc đang nói chuyện.
        rig.screenMat.emissiveIntensity = 0.3;
        rig.armL.position.z = 0;
        rig.armR.position.z = 0;
        let y = 0.48;
        let facing = w.facing;
        if (walking) {
          const swing = Math.sin(t * 11 + rig.phase);
          y += Math.abs(swing) * 0.06;
          (rig.legs[0] as THREE.Group).rotation.x = swing * 0.6;
          (rig.legs[1] as THREE.Group).rotation.x = -swing * 0.6;
          rig.armL.rotation.x = -swing * 0.5;
          rig.armR.rotation.x = swing * 0.5;
          emoji = w.speed > 3 ? '🏃' : '🚶';
        } else if (w.place.kind === 'spot') {
          const spot = w.place.spot;
          facing = spot.face;
          emoji = spot.emoji;
          if (spot.seatY !== null) y = spot.seatY;
          else for (const leg of rig.legs) leg.rotation.x = 0;
          switch (spot.activity) {
            case 'sip': {
              // Lift the mug every few seconds. / Nâng cốc lên uống mỗi vài giây.
              const lift = Math.max(0, Math.sin(p * 1.3) - 0.3) / 0.7;
              rig.armR.rotation.x = -0.4 - lift * 2.0;
              rig.armL.rotation.x = 0.1;
              rig.head.rotation.x = -lift * 0.2;
              break;
            }
            case 'game':
              rig.armL.rotation.x = -1.0 + Math.sin(p * 14) * 0.05;
              rig.armR.rotation.x = -1.0 + Math.sin(p * 13) * 0.05;
              rig.armL.rotation.z = -0.35;
              rig.armR.rotation.z = 0.35;
              rig.head.rotation.x = 0.35;
              break;
            case 'pingpong':
              rig.armR.rotation.x = -1.3 + Math.sin(p * 5) * 0.8;
              rig.armR.rotation.z = Math.sin(p * 5) * 0.4;
              rig.armL.rotation.x = -0.4;
              y += Math.abs(Math.sin(p * 5)) * 0.08;
              break;
            case 'chill':
              rig.armL.rotation.x = -0.5;
              rig.armR.rotation.x = -0.5;
              rig.head.rotation.z = Math.sin(p * 0.7) * 0.15;
              y += Math.sin(p * 1.2) * 0.02;
              break;
            case 'snack':
              rig.armL.rotation.x = -1.2;
              rig.armR.rotation.x = -1.2 - Math.max(0, Math.sin(p * 2)) * 0.8;
              rig.head.rotation.x = 0.15 * Math.sin(p * 2);
              break;
          }
        } else if (w.place.kind === 'visit') {
          // Chatting beside a colleague's chair. / Đứng nói chuyện cạnh ghế đồng nghiệp.
          const target = byId.get(w.place.target);
          if (target) {
            const c = chairOf(target);
            facing = Math.atan2(c.x - w.pos.x, c.z - w.pos.z);
          }
          for (const leg of rig.legs) leg.rotation.x = 0;
          rig.armR.rotation.x = -0.9 + Math.sin(p * 4) * 0.4;
          rig.armL.rotation.x = -0.2;
          rig.head.rotation.x = Math.sin(p * 3) * 0.08;
          emoji = '💬';
        }
        w.facing += angleDelta(w.facing, facing) * Math.min(1, dt * 8);
        rig.body.position.set(w.pos.x - sx, y, w.pos.z - sz);
        rig.body.rotation.y = w.facing;
      }
      renderLabel(a, rig, emoji);
    }

    // Department sign counters: working / total. / Bộ đếm trên biển phòng ban: đang làm / tổng.
    for (const dl of deptLabels) {
      if (!dl.d.hasTeam) continue;
      const team = state.agents.filter((a) => a.dept === dl.d.id);
      const txt = `${team.filter((a) => a.status === 'working').length}/${team.length}`;
      if (dl.count.textContent !== txt) dl.count.textContent = txt;
    }

    // Server LEDs blink harder with more running agents. / LED server nháy mạnh hơn khi nhiều agent chạy.
    const busy = state.agents.filter((a) => a.status === 'working').length;
    leds.forEach((led, i) => {
      const on = Math.sin(t * (3 + (i % 5)) + i * 1.7) > 0.5 - busy * 0.1;
      (led.material as THREE.MeshBasicMaterial).color.set(on ? (i % 7 === 0 ? '#f5b544' : '#5cc98a') : '#22252f');
    });
    // Meeting-room TV pulses while envelopes are in flight. / TV phòng họp nháy khi có phong thư đang bay.
    tv.color.set(state.flights.length && Math.sin(t * 6) > 0 ? '#ffd27a' : '#7cc4ff');

    // Sticky notes on the task board. / Giấy note trên bảng task.
    const recent = state.tasks.slice(-notes.length);
    notes.forEach((n, i) => {
      const task = recent[i];
      n.visible = !!task && task.status !== 'cancelled';
      if (task) (n.material as THREE.MeshStandardMaterial).color.set(NOTE_COLOR[task.status] ?? '#ffe680');
    });

    // Envelope fallback when the sender can't walk over. / Phong thư bay khi người gửi không đi bộ được.
    const now = Date.now();
    const live = new Set<string>();
    for (const f of state.flights) {
      if (walkedFlights.has(f.id)) continue; // delivered on foot / đã đi bộ tới đưa tin
      live.add(f.id);
      let env = envelopes.get(f.id);
      if (!env) {
        env = new THREE.Group();
        const paper = new THREE.Mesh(envGeo, mat('#ffffff'));
        const seal = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), sealMat);
        seal.position.z = 0.035;
        env.add(paper, seal);
        scene.add(env);
        envelopes.set(f.id, env);
      }
      const k = Math.min(1, (now - f.startedAt) / 1800);
      const a = deskWorld(f.from);
      const b = deskWorld(f.to);
      const mid = hub.clone().setY(6.5).lerp(a.clone().lerp(b, 0.5), 0.35);
      // Quadratic Bézier through the bus hub. / Bézier bậc hai đi qua trạm bus.
      const u = 1 - k;
      env.position.set(
        u * u * a.x + 2 * u * k * mid.x + k * k * b.x,
        u * u * a.y + 2 * u * k * mid.y + k * k * b.y,
        u * u * a.z + 2 * u * k * mid.z + k * k * b.z,
      );
      env.rotation.set(Math.sin(t * 6) * 0.3, t * 3, 0);
      env.scale.setScalar(k < 0.1 ? k * 10 : k > 0.9 ? (1 - k) * 10 : 1);
    }
    for (const [id, env] of envelopes) {
      if (!live.has(id)) {
        scene.remove(env);
        envelopes.delete(id);
      }
    }

    renderer.render(scene, camera);
    syncLabels();
  };
  animate();

  return {
    update: (next) => {
      state = next;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
