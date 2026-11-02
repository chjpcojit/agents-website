<script lang="ts">
  import { office } from '../stores/office';
  import Ring from './Ring.svelte';

  // Heads-up bar: brand, shared Max quota, concurrency, queue, clock.
  // Thanh HUD: logo, quota Max dùng chung, concurrency, queue, đồng hồ.
  const active = $derived($office.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length);
  const queued = $derived($office.tasks.filter((t) => t.status === 'queued').length);
  const clock = $derived(new Date($office.now).toLocaleTimeString('vi-VN', { hour12: false }));
  const tone = (v: number) => (v >= 0.85 ? '#ff5c7c' : v >= 0.65 ? '#ffc46b' : '#9ef6ff');
</script>

<header class="hud">
  <div class="brand">
    <span class="mark" aria-hidden="true"></span>
    <div>
      <b>AGENT<span>·</span>OS</b>
      <small>mock · chưa nối orchestrator</small>
    </div>
  </div>
  <div class="metrics">
    <div class="metric"><Ring value={$office.quota.fiveHour} color={tone($office.quota.fiveHour)} label="Max 5h" /><span>MAX 5H</span></div>
    <div class="metric"><Ring value={$office.quota.weekly} color={tone($office.quota.weekly)} label="Max tuần" /><span>TUẦN</span></div>
    <div class="metric num"><b>{active}<i>/{$office.concurrencyLimit}</i></b><span>RUN</span></div>
    <div class="metric num"><b>{queued}</b><span>QUEUE</span></div>
    <div class="metric num clock"><b>{clock}</b><span>LOCAL</span></div>
  </div>
</header>

<style>
  .hud { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 22px; flex-wrap: wrap; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark {
    width: 28px; height: 28px; border-radius: 50%;
    background: conic-gradient(from 0deg, #5ef2ff, #9b7bff, #ff6bd6, #5ef2ff);
    box-shadow: 0 0 18px rgba(94, 242, 255, 0.6); position: relative; animation: spin 8s linear infinite;
  }
  .mark::after { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: #05060c; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .brand b { font: 700 16px 'Space Grotesk', sans-serif; letter-spacing: 3px; display: block; }
  .brand b span { color: #5ef2ff; }
  .brand small { font: 400 10px 'JetBrains Mono', monospace; color: var(--h-muted); letter-spacing: 1px; }
  .metrics { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .metric { display: flex; align-items: center; gap: 8px; }
  .metric span { font: 500 10px 'JetBrains Mono', monospace; color: var(--h-muted); letter-spacing: 1.5px; }
  .metric.num { flex-direction: column; align-items: flex-start; gap: 0; }
  .metric.num b { font: 600 18px 'Space Grotesk', sans-serif; }
  .metric.num i { font-style: normal; color: var(--h-muted); font-size: 13px; }
  .clock b { font-family: 'JetBrains Mono', monospace; font-size: 15px; color: #9ef6ff; }
  @media (max-width: 600px) {
    .hud { padding: 12px 16px; }
    .metrics { gap: 12px; }
    .clock { display: none; }
  }
</style>
