<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../sim/store';
  import Approvals from './Approvals.svelte';
  import CommandBar from './CommandBar.svelte';
  import Hud from './Hud.svelte';
  import Panel from './Panel.svelte';
  import Stage from './Stage.svelte';

  // v2 "AI assistant" UI: no 3D, dark glass + neon, same mock orchestrator as v1.
  // Giao diện v2 kiểu "trợ lý AI": không 3D, kính tối + neon, dùng chung orchestrator giả lập với v1.
  onMount(() => {
    store.start();
    return () => store.stop();
  });
</script>

<div class="holo">
  <div class="aurora" aria-hidden="true"><span class="a1"></span><span class="a2"></span><span class="a3"></span></div>
  <div class="grid" aria-hidden="true"></div>
  <Hud />
  <main>
    <section class="stage-wrap">
      <Stage />
    </section>
    <div class="side">
      <Approvals />
      <div class="panel-wrap"><Panel /></div>
    </div>
  </main>
  <footer><CommandBar /></footer>
</div>

<style>
  .holo {
    --h-bg: #08090b;
    --h-glass: rgba(20, 21, 25, 0.6);
    --h-line: rgba(255, 255, 255, 0.08);
    --h-muted: #7c808a;
    position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden;
    background: var(--h-bg); color: #eceef1; font-family: 'Space Grotesk', system-ui, sans-serif;
    color-scheme: dark;
  }
  .aurora { position: absolute; inset: 0; pointer-events: none; filter: blur(80px); opacity: 0.55; }
  .aurora span { position: absolute; border-radius: 50%; }
  .a1 { width: 46vw; height: 46vw; left: 12%; top: 8%; background: radial-gradient(circle, rgba(120, 130, 160, 0.35) 0%, transparent 65%); animation: drift 22s ease-in-out infinite; }
  .a2 { width: 38vw; height: 38vw; right: 18%; top: 30%; background: radial-gradient(circle, rgba(90, 110, 130, 0.25) 0%, transparent 65%); animation: drift 28s ease-in-out infinite reverse; opacity: 0.6; }
  .a3 { width: 30vw; height: 30vw; left: 38%; bottom: -10%; background: radial-gradient(circle, rgba(140, 140, 150, 0.2) 0%, transparent 65%); animation: drift 34s ease-in-out infinite; opacity: 0.35; }
  @keyframes drift { 50% { transform: translate(6vw, 4vh) scale(1.1); } }
  .grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse at 40% 50%, #000 20%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse at 40% 50%, #000 20%, transparent 70%);
  }
  .holo > :global(*) { position: relative; }
  main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 16px; padding: 0 22px; }
  .stage-wrap { position: relative; min-height: 0; }
  .side { min-height: 0; padding-bottom: 8px; display: flex; flex-direction: column; gap: 12px; }
  .panel-wrap { flex: 1; min-height: 0; }
  footer { padding: 14px 22px 20px; }

  @media (max-width: 960px) {
    .holo { position: static; min-height: 100vh; overflow: visible; }
    main { grid-template-columns: 1fr; padding: 0 16px; }
    .stage-wrap { height: auto; }
    .stage-wrap :global(svg.stage) { height: auto; aspect-ratio: 1000 / 720; }
    .side :global(.stack) { width: 100%; }
    .panel-wrap { height: 70vh; flex: none; }
    footer { position: sticky; bottom: 0; padding: 12px 16px 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .aurora span { animation: none; }
  }
</style>
