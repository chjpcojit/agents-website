<script lang="ts">
  import { ago, office } from '../stores/office';
  import Avatar from './Avatar.svelte';

  // Office bus feed: agent ↔ agent and channel messages. / Feed office bus: tin agent ↔ agent và kênh chung.
  let filter = $state('all');
  const agents = $derived(new Map($office.agents.map((a) => [a.id, a])));
  const name = (id: string) => (id === 'system' ? 'system' : id.startsWith('#') ? id : (agents.get(id)?.name ?? id));
  const msgs = $derived(
    $office.bus
      .filter((m) => filter === 'all' || m.from === filter || m.to === filter)
      .slice(-60)
      .reverse(),
  );
  const filters = $derived(['all', '#general', ...$office.agents.map((a) => a.id)]);
</script>

<div class="bus">
  <div class="filters">
    {#each filters as f (f)}
      <button class:on={filter === f} onclick={() => (filter = f)}>{f === 'all' ? 'Tất cả' : name(f)}</button>
    {/each}
  </div>
  <p class="muted small">
    Agent gọi tool <code>bus.send</code> của office bus (MCP nội bộ). Mỗi cặp tối đa {$office.turnLimit} lượt rồi bị chặn (anti-loop).
  </p>
  {#each msgs as m (m.id)}
    {@const from = agents.get(m.from)}
    <div class="msg" class:sys={m.from === 'system'} class:blocked={m.blocked}>
      {#if from}<Avatar agent={from} size={28} />{:else}<span class="avatar sys">⚙️</span>{/if}
      <div class="grow">
        <div class="row between">
          <span>
            <b>{name(m.from)}</b> → <b>{name(m.to)}</b>
            {#if m.turn > 0 && !m.to.startsWith('#')}<span class="tag">lượt {m.turn}/{$office.turnLimit}</span>{/if}
            {#if m.blocked}<span class="tag danger">blocked</span>{/if}
          </span>
          <time>{ago($office.now, m.ts)}</time>
        </div>
        <p>{m.text}</p>
      </div>
    </div>
  {/each}
</div>
