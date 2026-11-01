import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Agent, AgentStatus, OfficeState, TaskStatus } from '../sim/types';

// Low-poly isometric office built with plain three.js. Each agent is a chibi character at a desk.
// Văn phòng isometric low-poly dựng bằng three.js thuần. Mỗi agent là một nhân vật chibi ngồi ở bàn.

export const STATUS_COLOR: Record<AgentStatus, string> = {
  working: '#5cc98a',
  idle: '#b9b2c8',
  waiting: '#f5b544',
  error: '#ef6b73',
  paused: '#7aa7e8',
};

const SCREEN_COLOR: Record<AgentStatus, string> = {
  working: '#9fe7ff',
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

/** Desk anchor positions (x, z). / Toạ độ đặt bàn (x, z). */
const DESKS: [number, number][] = [
  [-5.4, -3.0], [-0.4, -3.0], [4.6, -3.0],
  [-5.4, 2.4], [-0.4, 2.4], [4.6, 2.4],
];

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Shared flat-shaded material per colour. / Material flat-shaded dùng chung theo màu. */
function mat(color: string, opts: { emissive?: string; rough?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.emissive ?? ''}|${opts.rough ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.rough ?? 0.85, metalness: 0 });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = 0.9;
    }
    matCache.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, color: string, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function plant(x: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const pot = cyl(0.35, 0.28, 0.5, '#e98b6d', 8);
  pot.position.y = 0.25;
  g.add(pot);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat('#6fbf73'));
  leaves.position.y = 0.95;
  leaves.castShadow = true;
  g.add(leaves);
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat('#86d38a'));
  top.position.set(0.15, 1.35, 0.05);
  top.castShadow = true;
  g.add(top);
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

interface CharacterRig {
  agentId: string;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  screen: THREE.Mesh;
  screenMat: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  label: HTMLDivElement;
  anchor: THREE.Vector3;
  phase: number;
}

/** Build desk + chair + chibi character for one agent. / Dựng bàn + ghế + nhân vật chibi cho một agent. */
function buildWorkstation(agent: Agent): Omit<CharacterRig, 'label'> {
  const [x, z] = DESKS[agent.desk] ?? [0, 0];
  const root = new THREE.Group();
  root.position.set(x, 0, z);

  // Rug + status ring on the floor. / Thảm + vòng trạng thái dưới sàn.
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.04, 28), mat('#efe1cf'));
  rug.position.set(0, 0.02, -0.4);
  rug.receiveShadow = true;
  root.add(rug);
  const ringMat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR[agent.status], transparent: true, opacity: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 6, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.07, -0.9);
  root.add(ring);

  // Desk (in front, towards camera) / Bàn (phía trước, hướng camera).
  root.add(box(2.8, 0.16, 1.4, '#e8c39e', 0, 1.42, 0));
  for (const [lx, lz] of [[-1.25, -0.55], [1.25, -0.55], [-1.25, 0.55], [1.25, 0.55]] as const) {
    root.add(box(0.12, 1.34, 0.12, '#c99d75', lx, 0.67, lz));
  }
  root.add(box(0.9, 0.7, 1.2, '#d9ae86', 1.0, 0.8, 0)); // drawer / tủ ngăn kéo

  // Laptop facing the character (back of lid faces camera). / Laptop hướng về nhân vật (mặt lưng hướng camera).
  root.add(box(1.0, 0.05, 0.65, '#cfd4e0', -0.1, 1.53, -0.15));
  const lid = new THREE.Group();
  lid.position.set(-0.1, 1.55, 0.15);
  lid.rotation.x = 0.28;
  lid.add(box(1.0, 0.68, 0.05, '#aeb6c8', 0, 0.34, 0));
  const screenMat = new THREE.MeshStandardMaterial({ color: '#202533', emissive: new THREE.Color(SCREEN_COLOR[agent.status]), emissiveIntensity: 0.9, flatShading: true });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.56), screenMat);
  screen.position.set(0, 0.34, -0.03);
  screen.rotation.y = Math.PI;
  lid.add(screen);
  // Apple-ish sticker in agent colour on the lid back. / Sticker màu agent ở lưng laptop.
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), mat(agent.color));
  sticker.position.set(0, 0.36, 0.03);
  lid.add(sticker);
  root.add(lid);

  // Mug + mini plant + nameplate. / Cốc + chậu cây mini + bảng tên.
  const mug = cyl(0.12, 0.11, 0.24, '#ffffff', 10);
  mug.position.set(0.95, 1.62, 0.25);
  root.add(mug);
  const mini = plant(-1.1, 0.3, 0.35);
  mini.position.y = 1.5;
  root.add(mini);
  root.add(box(0.7, 0.18, 0.06, agent.color, 0.3, 1.58, 0.62));

  // Chair behind the desk. / Ghế phía sau bàn.
  const chair = new THREE.Group();
  chair.position.set(0, 0, -1.05);
  const seat = cyl(0.62, 0.62, 0.2, '#6c6a86', 14);
  seat.position.y = 0.95;
  chair.add(seat);
  const stem = cyl(0.08, 0.08, 0.8, '#4b4a5e', 6);
  stem.position.y = 0.45;
  chair.add(stem);
  const baseC = cyl(0.5, 0.55, 0.08, '#4b4a5e', 5);
  baseC.position.y = 0.06;
  chair.add(baseC);
  chair.add(box(1.1, 1.0, 0.18, '#6c6a86', 0, 1.6, -0.5));
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
  body.add(head);
  root.add(body);

  // Tag meshes so a raycast hit maps back to the agent. / Gắn tag để raycast trỏ ngược về agent.
  root.traverse((o) => (o.userData.agentId = agent.id));

  return {
    agentId: agent.id, root, body, head, armL, armR, screen, screenMat, ring, ringMat,
    anchor: new THREE.Vector3(x, 3.75, z - 1.05), phase: Math.random() * Math.PI * 2,
  };
}

/** Static room: floor, walls, windows, coffee corner, server rack, meeting table, task whiteboard. / Phòng tĩnh: sàn, tường, cửa sổ, góc cà phê, tủ server, bàn họp, bảng task. */
function buildRoom(scene: THREE.Scene): { leds: THREE.Mesh[]; notes: THREE.Mesh[]; hub: THREE.Group } {
  const W = 22;
  const D = 16;
  const floor = box(W, 0.4, D, '#f6eadb', 0, -0.2, 0);
  scene.add(floor);
  // Checker tiles for a cozy feel. / Gạch caro cho cảm giác ấm cúng.
  const tileGeo = new THREE.PlaneGeometry(1.98, 1.98);
  const tileMat = new THREE.MeshStandardMaterial({ color: '#efdcc6', roughness: 1 });
  for (let i = 0; i < W / 2; i++) {
    for (let j = 0; j < D / 2; j++) {
      if ((i + j) % 2) continue;
      const t = new THREE.Mesh(tileGeo, tileMat);
      t.rotation.x = -Math.PI / 2;
      t.position.set(-W / 2 + 1 + i * 2, 0.005, -D / 2 + 1 + j * 2);
      t.receiveShadow = true;
      scene.add(t);
    }
  }

  const back = box(W, 5.2, 0.4, '#fde4cf', 0, 2.6, -D / 2 - 0.2);
  const left = box(0.4, 5.2, D, '#fbd6c0', -W / 2 - 0.2, 2.6, 0);
  scene.add(back, left);
  scene.add(box(W, 0.35, 0.5, '#f2c6a8', 0, 0.17, -D / 2 + 0.05)); // baseboard / chân tường
  scene.add(box(0.5, 0.35, D, '#eebba0', -W / 2 + 0.05, 0.17, 0));

  // Windows with sky. / Cửa sổ nhìn ra trời.
  for (const wx of [-4, 2.5, 8]) {
    scene.add(box(3.2, 2.4, 0.15, '#ffffff', wx, 3.0, -D / 2 + 0.02));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.1), new THREE.MeshBasicMaterial({ color: '#bfe6ff' }));
    sky.position.set(wx, 3.0, -D / 2 + 0.11);
    scene.add(sky);
    const cloud = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    cloud.position.set(wx - 0.5, 3.4, -D / 2 + 0.12);
    cloud.scale.set(1.8, 1, 1);
    scene.add(cloud);
    scene.add(box(0.08, 2.1, 0.06, '#ffffff', wx, 3.0, -D / 2 + 0.14));
  }

  // Task board on the left wall — sticky notes reflect task status. / Bảng task trên tường trái — giấy note phản ánh trạng thái task.
  scene.add(box(0.12, 2.6, 5.2, '#ffffff', -W / 2 + 0.08, 2.9, -2));
  scene.add(box(0.14, 2.8, 5.4, '#c8b49e', -W / 2 + 0.04, 2.9, -2));
  const notes: THREE.Mesh[] = [];
  const noteGeo = new THREE.PlaneGeometry(0.62, 0.55);
  for (let i = 0; i < 18; i++) {
    const n = new THREE.Mesh(noteGeo, new THREE.MeshStandardMaterial({ color: '#ffe680', roughness: 1 }));
    const col = Math.floor(i / 6);
    const row = i % 6;
    n.position.set(-W / 2 + 0.16, 3.85 - (row % 3) * 0.7, -4.1 + col * 1.55 + (row >= 3 ? 0.72 : 0));
    n.rotation.y = Math.PI / 2;
    n.rotation.z = (Math.random() - 0.5) * 0.15;
    scene.add(n);
    notes.push(n);
  }

  // Coffee corner. / Góc cà phê.
  scene.add(box(3.4, 1.5, 1.2, '#9ad0c2', -9.1, 0.75, -6.9));
  scene.add(box(3.5, 0.1, 1.3, '#ffffff', -9.1, 1.55, -6.9));
  scene.add(box(0.8, 1.0, 0.7, '#5b5f73', -9.8, 2.1, -7.0));
  scene.add(box(0.5, 0.2, 0.2, '#ef6b73', -9.8, 2.45, -6.62));
  const kettle = cyl(0.22, 0.28, 0.5, '#f6c453', 10);
  kettle.position.set(-8.5, 1.85, -6.9);
  scene.add(kettle);

  // Server rack with blinking LEDs (orchestrator box). / Tủ server với đèn LED nhấp nháy (máy chạy orchestrator).
  scene.add(box(1.4, 3.4, 1.1, '#3d3f52', 9.6, 1.7, -7.0));
  const leds: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: '#5cc98a' }));
      led.position.set(9.25 + j * 0.3, 0.7 + i * 0.45, -6.43);
      scene.add(led);
      leds.push(led);
    }
  }

  // Meeting table = office bus hub (envelopes pass by here). / Bàn họp = trạm office bus (phong thư bay qua đây).
  const hub = new THREE.Group();
  hub.position.set(8.4, 0, 5.4);
  const top = cyl(1.5, 1.5, 0.16, '#f3d2a2', 20);
  top.position.y = 1.35;
  hub.add(top);
  const leg = cyl(0.18, 0.4, 1.3, '#c99d75', 8);
  leg.position.y = 0.65;
  hub.add(leg);
  const mailbox = new THREE.Group();
  mailbox.position.y = 1.43;
  mailbox.add(box(0.7, 0.55, 0.5, '#ef6b73', 0, 0.3, 0));
  const flag = box(0.06, 0.4, 0.06, '#f6c453', 0.42, 0.55, 0);
  mailbox.add(flag);
  hub.add(mailbox);
  for (const [sx, sz] of [[-1.9, 0], [1.9, 0], [0, 1.9], [0, -1.9]] as const) {
    const stool = cyl(0.4, 0.4, 0.7, '#9ad0c2', 10);
    stool.position.set(sx, 0.35, sz);
    hub.add(stool);
  }
  scene.add(hub);

  // Sofa + plants. / Sofa + cây xanh.
  // Sofa against the left wall, facing into the room. / Sofa sát tường trái, quay vào phòng.
  scene.add(box(1.2, 0.7, 3.2, '#b59ae8', -9.9, 0.45, 5.4));
  scene.add(box(0.35, 1.0, 3.2, '#a185da', -10.55, 1.0, 5.4));
  scene.add(box(1.2, 0.9, 0.35, '#a185da', -9.9, 0.65, 3.9));
  scene.add(box(1.2, 0.9, 0.35, '#a185da', -9.9, 0.65, 6.9));
  scene.add(plant(-10.1, 7.4, 1.2), plant(10.2, -4.2, 1.2), plant(-10.1, 2.6, 1.0), plant(5.6, -7.1, 1.0), plant(4.2, 7.3, 1.1));

  return { leds, notes, hub };
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
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  camera.position.set(22, 20, 22);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#fff6ea', '#d8c7ff', 1.6));
  const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 4;
  scene.add(sun);

  const { leds, notes, hub } = buildRoom(scene);

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
  const envMat = mat('#ffffff');
  const sealMat = new THREE.MeshBasicMaterial({ color: '#ef6b73' });
  const envelopes = new Map<string, THREE.Group>();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minZoom = 0.6;
  controls.maxZoom = 2.4;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = 1.15;
  controls.minAzimuthAngle = 0.15;
  controls.maxAzimuthAngle = 1.4;
  controls.target.set(0, 0.5, 0);

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    const aspect = w / h;
    // Fit the room both ways: min half-height 10.5, min half-width 15. / Vừa khít phòng cả hai chiều: nửa cao tối thiểu 10.5, nửa rộng tối thiểu 15.
    const size = Math.max(10.5, 15 / aspect);
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

  const deskWorld = (agentId: string) => rigs.get(agentId)?.anchor.clone().setY(3.6) ?? new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let raf = 0;

  const syncLabels = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    for (const a of state.agents) {
      const rig = rigs.get(a.id);
      if (!rig) continue;
      tmp.copy(rig.anchor).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * w;
      const sy = (-tmp.y * 0.5 + 0.5) * h;
      rig.label.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
  };

  const renderLabel = (a: Agent, rig: CharacterRig) => {
    const selected = state.selectedAgentId === a.id;
    const key = `${a.name}|${a.status}|${selected}|${Math.round(a.context * 100)}`;
    if (rig.label.dataset.key === key) return;
    rig.label.dataset.key = key;
    rig.label.className = `agent-label status-${a.status}${selected ? ' selected' : ''}`;
    rig.label.innerHTML = `<span class="bubble">${STATUS_EMOJI[a.status]}</span><span class="name">${a.name}</span><span class="ctx"><i style="width:${Math.round(a.context * 100)}%"></i></span>`;
  };

  const animate = () => {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    controls.update();

    for (const a of state.agents) {
      const rig = rigs.get(a.id);
      if (!rig) continue;
      const p = t + rig.phase;
      rig.ringMat.color.set(STATUS_COLOR[a.status]);
      rig.screenMat.emissive.set(SCREEN_COLOR[a.status]);
      const selected = state.selectedAgentId === a.id;
      rig.ring.scale.setScalar(selected ? 1.12 + Math.sin(t * 4) * 0.05 : 1);
      rig.ringMat.opacity = selected ? 1 : 0.7;

      // Reset pose each frame then apply the status animation. / Reset tư thế mỗi frame rồi áp animation theo trạng thái.
      rig.body.position.y = 1.05;
      rig.body.position.x = 0;
      rig.body.rotation.set(0, 0, 0);
      rig.head.rotation.set(0, 0, 0);
      rig.armL.rotation.x = -1.1;
      rig.armR.rotation.x = -1.1;
      switch (a.status) {
        case 'working':
          rig.armL.rotation.x = -1.2 + Math.sin(p * 18) * 0.18;
          rig.armR.rotation.x = -1.2 + Math.sin(p * 18 + 1.7) * 0.18;
          rig.head.rotation.x = 0.12 + Math.sin(p * 2) * 0.03;
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
      renderLabel(a, rig);
    }

    // Blink server LEDs proportional to running agents. / LED server nháy theo số agent đang chạy.
    const busy = state.agents.filter((a) => a.status === 'working').length;
    leds.forEach((led, i) => {
      const on = Math.sin(t * (3 + (i % 5)) + i * 1.7) > 0.4 - busy * 0.15;
      (led.material as THREE.MeshBasicMaterial).color.set(on ? (i % 7 === 0 ? '#f5b544' : '#5cc98a') : '#2a2c3a');
    });

    // Sticky notes on the task board. / Giấy note trên bảng task.
    const recent = state.tasks.slice(-notes.length);
    notes.forEach((n, i) => {
      const task = recent[i];
      n.visible = !!task && task.status !== 'cancelled';
      if (task) (n.material as THREE.MeshStandardMaterial).color.set(NOTE_COLOR[task.status] ?? '#ffe680');
    });

    // Envelopes fly desk → hub → desk along an arc. / Phong thư bay bàn → trạm → bàn theo đường cong.
    const now = Date.now();
    const live = new Set<string>();
    for (const f of state.flights) {
      live.add(f.id);
      let env = envelopes.get(f.id);
      if (!env) {
        env = new THREE.Group();
        const paper = new THREE.Mesh(envGeo, envMat);
        const seal = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), sealMat);
        seal.position.z = 0.035;
        env.add(paper, seal);
        scene.add(env);
        envelopes.set(f.id, env);
      }
      const k = Math.min(1, (now - f.startedAt) / 1800);
      const a = deskWorld(f.from);
      const b = deskWorld(f.to);
      const mid = hub.position.clone().setY(5.5).lerp(a.clone().lerp(b, 0.5), 0.5);
      // Quadratic Bézier. / Đường Bézier bậc hai.
      const u = 1 - k;
      env.position.set(
        u * u * a.x + 2 * u * k * mid.x + k * k * b.x,
        u * u * a.y + 2 * u * k * mid.y + k * k * b.y + Math.sin(k * Math.PI) * 1.2,
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
