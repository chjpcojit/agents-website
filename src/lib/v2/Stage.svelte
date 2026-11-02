<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../sim/store';
  import type { Agent, StreamEvent } from '../sim/types';
  import { office } from '../stores/office';
  import { CORE, RX, RY, STORES, VIEW, curveAwayFromCore, curveThroughCore, layoutConstellation, pointOnQuad, storeAccess, type AccessOp, type Point, type StoreId } from './layout';
  import { NEON, STATUS_TEXT } from './theme';

  // Agents never move between departments in the demo, so the layout is computed once.
  // Trong demo agent không đổi phòng ban, nên chỉ tính bố cục một lần.
  const { nodes, depts } = layoutConstellation(store.getState().agents);
  const R = 24;
  const CTX_R = 33;
  const CTX_LEN = 2 * Math.PI * CTX_R;

  // Animation clock for bus pulses. / Đồng hồ animation cho tia tin nhắn bus.
  let now = $state(Date.now());
  onMount(() => {
    let raf = requestAnimationFrame(function loop() {
      now = Date.now();
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  });

  const lastEvent = $derived.by(() => {
    const m = new Map<string, StreamEvent>();
    for (const e of $office.stream) m.set(e.agentId, e);
    return m;
  });
  const running = $derived($office.agents.filter((a) => a.status === 'working').length);
  const pending = $derived($office.approvals.filter((a) => a.status === 'pending').length);

  const pulses = $derived(
    $office.flights
      .map((f) => {
        const a = nodes.get(f.from);
        const b = nodes.get(f.to);
        if (!a || !b) return null;
        const k = (now - f.startedAt) / 1600;
        if (k < 0 || k >= 1) return null;
        const { c, d } = curveThroughCore(a, b);
        const p = pointOnQuad(a, c, b, k);
        return { id: f.id, d, p, k, color: '#ffffff' };
      })
      .filter((x) => x !== null),
  );

  // ---- Data-store traffic. / Lưu lượng tới kho dữ liệu. ----
  const BEAM_MS = 1300;
  const storeAt = new Map(STORES.map((s) => [s.id, s]));

  interface Access {
    id: string;
    store: StoreId;
    op: AccessOp;
    /** Agent id, or 'core' for orchestrator writes. / Id agent, hoặc 'core' khi orchestrator ghi. */
    from: string;
    label: string;
    ts: number;
  }

  // Accesses derived from the agent stream plus orchestrator audit writes to SQLite.
  // Các lượt truy xuất lấy từ stream của agent cộng với việc orchestrator ghi audit vào SQLite.
  const accesses = $derived.by(() => {
    const out: Access[] = [];
    for (const e of $office.stream) {
      const m = storeAccess(e.kind, e.text);
      if (m) out.push({ id: e.id, store: m.store, op: m.op, from: e.agentId, label: e.text, ts: e.ts });
    }
    for (const e of $office.audit) out.push({ id: e.id, store: 'db', op: 'write', from: 'core', label: e.action, ts: e.ts });
    for (const m of $office.bus) out.push({ id: m.id, store: 'db', op: 'write', from: 'core', label: `bus ${m.from} → ${m.to}`, ts: m.ts });
    return out;
  });

  // Running read/write counters; ids are remembered so trimmed history doesn't double count.
  // Bộ đếm read/write cộng dồn; nhớ id để lịch sử bị cắt bớt không bị đếm lại.
  const seen = new Set<string>();
  let counts = $state<Record<StoreId, { r: number; w: number; last: string; at: number }>>({
    repo: { r: 0, w: 0, last: '—', at: 0 },
    github: { r: 0, w: 0, last: '—', at: 0 },
    transcript: { r: 0, w: 0, last: '—', at: 0 },
    db: { r: 0, w: 0, last: '—', at: 0 },
  });
  $effect(() => {
    for (const a of accesses) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      const c = counts[a.store];
      if (a.op === 'read') c.r++;
      else c.w++;
      if (a.ts >= c.at) {
        c.at = a.ts;
        c.last = a.label.length > 22 ? `${a.label.slice(0, 21)}…` : a.label;
      }
    }
  });

  const beams = $derived(
    accesses
      .map((x) => {
        const k = (now - x.ts) / BEAM_MS;
        if (k < 0 || k >= 1) return null;
        const s = storeAt.get(x.store)!;
        const agentPt: Point | undefined = x.from === 'core' ? CORE : nodes.get(x.from);
        if (!agentPt) return null;
        // Reads travel store → agent, writes agent → store. / Read đi kho → agent, write đi agent → kho.
        const [a, b] = x.op === 'read' ? [s, agentPt] : [agentPt, s];
        const { c, d } = curveAwayFromCore(a, b);
        return { id: x.id, d, p: pointOnQuad(a, c, b, k), k, op: x.op };
      })
      .filter((x) => x !== null),
  );
  const hot = $derived(new Set(beams.map((b) => accesses.find((x) => x.id === b.id)?.store)));

  function activity(a: Agent): string {
    if (a.status === 'error') return trunc(a.lastError ?? 'error');
    const e = lastEvent.get(a.id);
    if (!e) return '—';
    return trunc(e.text);
  }

  function trunc(t: string): string {
    return t.length > 26 ? `${t.slice(0, 25)}…` : t;
  }
</script>

<svg class="stage" viewBox="0 0 {VIEW.w} {VIEW.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sơ đồ agent">
  <defs>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="6" result="b" />
      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="soft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14" /></filter>
    <radialGradient id="core-grad" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="45%" stop-color="#d9dce3" />
      <stop offset="100%" stop-color="#6b6f7a" />
    </radialGradient>
    <!-- One neutral glass gradient for every orb; status is shown by a thin ring only. / Một gradient kính trung tính cho mọi orb; trạng thái chỉ thể hiện qua vòng mảnh. -->
    <radialGradient id="orb" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#f4f5f7" />
      <stop offset="45%" stop-color="#8d929d" />
      <stop offset="100%" stop-color="#2b2e36" />
    </radialGradient>
  </defs>

  <!-- Orbit guides. / Quỹ đạo định hướng. -->
  <ellipse cx={CORE.x} cy={CORE.y} rx={RX} ry={RY} class="orbit" />
  <ellipse cx={CORE.x} cy={CORE.y} rx={RX * 0.6} ry={RY * 0.6} class="orbit faint" />

  <!-- Department labels. / Nhãn phòng ban. -->
  {#each depts as d (d.id)}
    <text x={d.at.x} y={d.at.y} text-anchor={d.anchor} class="dept">{d.name.toUpperCase()}</text>
  {/each}

  <!-- Data links core ↔ agent; flowing when the agent is busy. / Link dữ liệu core ↔ agent; chạy khi agent bận. -->
  {#each $office.agents as a (a.id)}
    {@const p = nodes.get(a.id)}
    {#if p}
      <line x1={CORE.x} y1={CORE.y} x2={p.x} y2={p.y} class="link" class:live={a.status === 'working'} class:dim={a.status === 'idle' || a.status === 'paused'} />
    {/if}
  {/each}

  <!-- Data-store beams: dashed path + travelling packet. / Tia tới kho dữ liệu: đường đứt + gói tin di chuyển. -->
  {#each beams as b (b.id)}
    <path d={b.d} class="beam" class:w={b.op === 'write'} style:opacity={Math.sin(b.k * Math.PI) * 0.6} />
    <rect x={b.p.x - 3} y={b.p.y - 3} width="6" height="6" rx="1.5" class="packet" class:w={b.op === 'write'} />
  {/each}

  <!-- Data stores. / Kho dữ liệu. -->
  {#each STORES as s (s.id)}
    {@const c = counts[s.id]}
    <g class="store" class:hot={hot.has(s.id)} transform="translate({s.x} {s.y})">
      <circle r="38" class="store-glow" filter="url(#soft)" />
      <!-- Cylinder glyph. / Biểu tượng hình trụ. -->
      <path d="M-18,-14 v28 a18,6 0 0 0 36,0 v-28" class="cyl" />
      <ellipse cx="0" cy="-14" rx="18" ry="6" class="cyl top" />
      <path d="M-18,-2 a18,6 0 0 0 36,0 M-18,8 a18,6 0 0 0 36,0" class="cyl-band" />
      <g transform="translate(0 40)">
        <text class="store-name" text-anchor="middle">{s.name}</text>
        <text y="13" class="store-path" text-anchor="middle">{s.path}</text>
        <text y="27" class="store-io" text-anchor="middle">R {c.r} · W {c.w}</text>
        <text y="40" class="store-last" text-anchor="middle">{c.last}</text>
      </g>
    </g>
  {/each}

  <!-- Bus message pulses travelling between agents via the core. / Tia tin nhắn bus đi giữa các agent qua core. -->
  {#each pulses as pl (pl.id)}
    <path d={pl.d} class="trail" stroke={pl.color} style:opacity={Math.sin(pl.k * Math.PI) * 0.7} />
    <circle cx={pl.p.x} cy={pl.p.y} r="8" fill={pl.color} opacity="0.25" filter="url(#soft)" />
    <circle cx={pl.p.x} cy={pl.p.y} r="2.5" fill="#fff" />
  {/each}

  <!-- Orchestrator core. / Core orchestrator. -->
  <g class="core" transform="translate({CORE.x} {CORE.y})">
    <circle r={CORE.r + 30} fill="#ffffff" opacity="0.06" filter="url(#soft)" class="breath" />
    <circle r={CORE.r + 22} class="ring r1" />
    <circle r={CORE.r + 12} class="ring r2" />
    <circle r={CORE.r} fill="url(#core-grad)" />
    <text y="-6" class="core-title">CORE</text>
    <text y="14" class="core-sub">{running} RUN · {pending} DUYỆT</text>
  </g>

  <!-- Agent orbs. / Các orb agent. -->
  {#each $office.agents as a (a.id)}
    {@const p = nodes.get(a.id)}
    {#if p}
      {@const sel = $office.selectedAgentId === a.id}
      {@const lx = p.side === 'right' ? 48 : p.side === 'left' ? -48 : 0}
      {@const ly = p.side === 'below' ? 62 : -8}
      {@const anchor = p.side === 'right' ? 'start' : p.side === 'left' ? 'end' : 'middle'}
      <g
        class="agent s-{a.status}"
        class:sel
        transform="translate({p.x} {p.y})"
        role="button"
        tabindex="0"
        aria-label="{a.name}: {STATUS_TEXT[a.status]}"
        onclick={() => store.select(sel ? null : a.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && store.select(a.id)}
      >
        <circle r="46" fill="#ffffff" opacity="0" filter="url(#soft)" class="halo" />
        {#if a.status === 'waiting' || a.status === 'error'}
          <circle r={CTX_R} class="ripple" stroke={NEON[a.status]} />
          <circle r={CTX_R} class="ripple d2" stroke={NEON[a.status]} />
        {/if}
        <!-- Context usage ring. / Vòng mức dùng context. -->
        <circle r={CTX_R} class="ctx-track" />
        <circle
          r={CTX_R}
          class="ctx"
          stroke={a.context >= 0.8 ? NEON.error : a.context >= 0.6 ? NEON.waiting : 'rgba(255,255,255,0.7)'}
          stroke-dasharray="{CTX_LEN * a.context} {CTX_LEN}"
          transform="rotate(-90)"
        />
        {#if a.status === 'working'}
          <circle r="40" class="spin" />
        {/if}
        <circle r={R} fill="url(#orb)" class="orb" />
        <text y="5" class="initial">{a.name.slice(0, 1)}</text>
        <text x={lx} y={ly} text-anchor={anchor} class="name">{a.name}</text>
        <text x={lx} y={ly + 16} text-anchor={anchor} class="status"><tspan fill={NEON[a.status]}>●</tspan> {STATUS_TEXT[a.status]}</text>
        <text x={lx} y={ly + 31} text-anchor={anchor} class="act">{activity(a)}</text>
      </g>
    {/if}
  {/each}
</svg>

<style>
  .stage { width: 100%; height: 100%; display: block; overflow: visible; }
  .orbit { fill: none; stroke: rgba(255, 255, 255, 0.07); stroke-dasharray: 1 7; }
  .orbit.faint { stroke: rgba(255, 255, 255, 0.04); }
  .dept { font: 600 11px 'JetBrains Mono', monospace; letter-spacing: 2.5px; fill: rgba(255, 255, 255, 0.28); }

  .link { stroke: #fff; stroke-width: 1; opacity: 0.1; stroke-dasharray: 3 7; }
  .link.live { opacity: 0.35; animation: flow 1.2s linear infinite; }
  .link.dim { opacity: 0.05; }
  @keyframes flow { to { stroke-dashoffset: -20; } }

  .trail { fill: none; stroke-width: 1; }

  .beam { fill: none; stroke: #fff; stroke-width: 1; stroke-dasharray: 2 4; }
  .beam.w { stroke: #9fd9c2; }
  .packet { fill: #fff; }
  .packet.w { fill: #9fd9c2; }
  .store .cyl { fill: rgba(255, 255, 255, 0.06); stroke: rgba(255, 255, 255, 0.35); stroke-width: 1; }
  .store .cyl.top { fill: rgba(255, 255, 255, 0.14); }
  .store .cyl-band { fill: none; stroke: rgba(255, 255, 255, 0.18); stroke-width: 1; }
  .store-glow { fill: #fff; opacity: 0; transition: opacity 0.35s; }
  .store.hot .store-glow { opacity: 0.1; }
  .store.hot .cyl { stroke: rgba(255, 255, 255, 0.8); }
  .store-name { fill: #f2f3f5; font: 600 12.5px 'Space Grotesk', sans-serif; }
  .store-path { fill: rgba(255, 255, 255, 0.45); font: 400 9px 'JetBrains Mono', monospace; }
  .store-io { fill: rgba(255, 255, 255, 0.7); font: 500 9px 'JetBrains Mono', monospace; letter-spacing: 1px; }
  .store-last { fill: rgba(255, 255, 255, 0.35); font: 400 8.5px 'JetBrains Mono', monospace; }

  .core-title { fill: #0b0c1d; font: 700 15px 'Space Grotesk', sans-serif; text-anchor: middle; letter-spacing: 4px; }
  .core-sub { fill: rgba(11, 12, 29, 0.75); font: 500 9px 'JetBrains Mono', monospace; text-anchor: middle; letter-spacing: 1px; }
  .ring { fill: none; stroke-width: 1; transform-box: fill-box; transform-origin: center; }
  .ring.r1 { stroke: rgba(255, 255, 255, 0.22); stroke-dasharray: 40 18 4 18; animation: rot 18s linear infinite; }
  .ring.r2 { stroke: rgba(255, 255, 255, 0.12); stroke-dasharray: 2 6; animation: rot 9s linear infinite reverse; }
  .breath { animation: breath 4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes rot { to { transform: rotate(360deg); } }
  @keyframes breath { 50% { transform: scale(1.12); opacity: 0.28; } }

  .agent { cursor: pointer; outline: none; }
  .agent .orb { transition: transform 0.25s; transform-box: fill-box; transform-origin: center; }
  .agent:hover .orb, .agent.sel .orb { transform: scale(1.12); }
  .agent:focus-visible .ctx-track { stroke: #fff; }
  .ctx-track { fill: none; stroke: rgba(255, 255, 255, 0.08); stroke-width: 3; }
  .ctx { fill: none; stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray 0.6s; }
  .spin { fill: none; stroke: rgba(255, 255, 255, 0.45); stroke-width: 1; stroke-dasharray: 18 10 2 10; opacity: 0.8; transform-box: fill-box; transform-origin: center; animation: rot 3s linear infinite; }
  .ripple { fill: none; stroke-width: 1.5; transform-box: fill-box; transform-origin: center; opacity: 0.5; animation: ripple 2.4s ease-out infinite; }
  .ripple.d2 { animation-delay: 0.9s; }
  @keyframes ripple { from { transform: scale(1); opacity: 0.5; } to { transform: scale(1.6); opacity: 0; } }
  .halo { transition: opacity 0.4s; }
  .agent.sel .halo { opacity: 0.12; }
  .s-idle .orb, .s-paused .orb { opacity: 0.4; }
  .s-error .orb { animation: glitch 2.4s steps(1) infinite; }
  @keyframes glitch { 0%, 92%, 100% { transform: translate(0, 0); } 94% { transform: translate(-2px, 1px); } 96% { transform: translate(2px, -1px); } }

  .initial { fill: rgba(5, 6, 12, 0.55); font: 700 15px 'Space Grotesk', sans-serif; text-anchor: middle; pointer-events: none; }
  .name { fill: #f2f3f5; font: 600 15px 'Space Grotesk', sans-serif; }
  .status { font: 600 9px 'JetBrains Mono', monospace; letter-spacing: 1.5px; fill: rgba(255, 255, 255, 0.5); }
  .act { fill: rgba(255, 255, 255, 0.32); font: 400 9.5px 'JetBrains Mono', monospace; }
  .agent.sel .name { fill: #fff; }
  .agent.sel .ctx-track { stroke: rgba(255, 255, 255, 0.3); }

  /* Phones: the SVG scales down a lot, so keep only big names. / Điện thoại: SVG bị thu nhỏ nhiều nên chỉ giữ tên cỡ lớn. */
  @media (max-width: 600px) {
    .act, .status, .dept, .core-sub, .store-path, .store-io, .store-last { display: none; }
    .store-name { font-size: 20px; }
    .name { font-size: 26px; }
    .core-title { font-size: 20px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring, .spin, .ripple, .breath, .link.live, .s-error .orb { animation: none; }
    .beam, .packet { display: none; }
  }
</style>
