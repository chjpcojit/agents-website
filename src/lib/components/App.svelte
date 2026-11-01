<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../sim/store';
  import { office } from '../stores/office';
  import AgentPanel from './AgentPanel.svelte';
  import ApprovalInbox from './ApprovalInbox.svelte';
  import AuditLog from './AuditLog.svelte';
  import BusFeed from './BusFeed.svelte';
  import OfficeCanvas from './OfficeCanvas.svelte';
  import TaskBoard from './TaskBoard.svelte';
  import TopBar from './TopBar.svelte';

  type Tab = 'agent' | 'approvals' | 'bus' | 'board' | 'audit';
  let tab = $state<Tab>('agent');
  const pending = $derived($office.approvals.filter((a) => a.status === 'pending').length);

  // Run the mock orchestrator while the app is mounted. / Chạy orchestrator giả lập khi app đang mount.
  onMount(() => {
    store.start();
    return () => store.stop();
  });

  // Selecting a character in the scene jumps to its detail tab. / Chọn nhân vật trong scene thì nhảy sang tab chi tiết.
  // Depend on the id only, not on every store tick. / Chỉ phụ thuộc vào id, không phải mỗi tick của store.
  const selectedId = $derived($office.selectedAgentId);
  $effect(() => {
    if (selectedId) tab = 'agent';
  });

  const tabs = $derived<{ key: Tab; label: string; badge?: number }[]>([
    { key: 'agent', label: 'Agent' },
    { key: 'approvals', label: 'Duyệt', badge: pending },
    { key: 'bus', label: 'Office bus' },
    { key: 'board', label: 'Task board' },
    { key: 'audit', label: 'Audit' },
  ]);
</script>

<div class="app">
  <TopBar onOpenApprovals={() => (tab = 'approvals')} />
  <main class="layout">
    <OfficeCanvas />
    <aside class="sidebar">
      <div class="tabs" role="tablist">
        {#each tabs as t (t.key)}
          <button role="tab" aria-selected={tab === t.key} class:on={tab === t.key} onclick={() => (tab = t.key)}>
            {t.label}
            {#if t.badge}<span class="badge">{t.badge}</span>{/if}
          </button>
        {/each}
      </div>
      <div class="panel">
        {#if tab === 'agent'}<AgentPanel />
        {:else if tab === 'approvals'}<ApprovalInbox />
        {:else if tab === 'bus'}<BusFeed />
        {:else if tab === 'board'}<TaskBoard />
        {:else}<AuditLog />{/if}
      </div>
    </aside>
  </main>
</div>
