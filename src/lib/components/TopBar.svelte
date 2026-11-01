<script lang="ts">
  import { office } from '../stores/office';
  import Meter from './Meter.svelte';

  let { onOpenApprovals }: { onOpenApprovals: () => void } = $props();

  // Header: brand, shared Max quota, concurrency/queue, pending approvals.
  // Header: logo, quota Max dùng chung, concurrency/queue, số yêu cầu duyệt.
  const active = $derived($office.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length);
  const queued = $derived($office.tasks.filter((t) => t.status === 'queued').length);
  const pending = $derived($office.approvals.filter((a) => a.status === 'pending').length);
  const resetMin = $derived(Math.max(0, Math.round(($office.quota.fiveHourResetAt - $office.now) / 60000)));
</script>

<header class="topbar">
  <div class="brand">
    <span class="logo" aria-hidden="true">🏢</span>
    <div>
      <h1>Agent Office</h1>
      <p>Demo · mock data · chưa nối orchestrator</p>
    </div>
  </div>
  <div class="stats">
    <Meter label="Max · 5h" value={$office.quota.fiveHour} sub="reset sau {Math.floor(resetMin / 60)}h{String(resetMin % 60).padStart(2, '0')}" />
    <Meter label="Max · tuần" value={$office.quota.weekly} sub="dùng chung mọi agent" />
    <div class="chip"><b>{active}/{$office.concurrencyLimit}</b><span>đang chạy</span></div>
    <div class="chip"><b>{queued}</b><span>trong queue</span></div>
    <button class="chip bell" class:ring={pending > 0} onclick={onOpenApprovals}>
      <b>🔔 {pending}</b><span>chờ duyệt</span>
    </button>
  </div>
</header>
