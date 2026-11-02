<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../sim/store';
  import type { Agent, StreamEvent } from '../sim/types';
  import { office } from '../stores/office';
  import { CORE, RX, RY, VIEW, curveThroughCore, layoutConstellation, pointOnQuad } from './layout';
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

  function activity(a: Agent): string {
    if (a.status === 'error') return a.lastError ?? 'error';
    const e = lastEvent.get(a.id);
    if (!e) return '—';
    return e.text.length > 26 ? `${e.text.slice(0, 25)}…` : e.text;
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
      <stop offset="100%" stop-color="#16181d" />
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
    .act, .status, .dept, .core-sub { display: none; }
    .name { font-size: 26px; }
    .core-title { font-size: 20px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring, .spin, .ripple, .breath, .link.live, .s-error .orb { animation: none; }
  }
</style>
