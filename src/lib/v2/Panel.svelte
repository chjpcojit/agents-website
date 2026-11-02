<script lang="ts">
  import { DEPARTMENTS } from '../sim/departments';
  import { store } from '../sim/store';
  import type { StreamKind, TaskStatus } from '../sim/types';
  import { ago, office } from '../stores/office';
  import { NEON, STATUS_TEXT } from './theme';

  // Right-hand glass panel: global live feed, or one agent's session when selected.
  // Panel kính bên phải: live feed toàn hệ thống, hoặc session của một agent khi được chọn.
  type Tab = 'feed' | 'bus' | 'tasks' | 'audit';
  let tab = $state<Tab>('feed');

  const KIND: Record<StreamKind, string> = { user: 'YOU', assistant: 'AI', tool_call: 'TOOL', tool_result: 'OK', system: 'SYS', error: 'ERR' };
  const agents = $derived(new Map($office.agents.map((a) => [a.id, a])));
  const agent = $derived($office.agents.find((a) => a.id === $office.selectedAgentId));
  const feed = $derived(
    (agent ? $office.stream.filter((e) => e.agentId === agent.id) : $office.stream).slice(-60).reverse(),
  );
  const task = $derived(agent ? $office.tasks.find((t) => t.id === agent.currentTaskId) : undefined);
  const COLS: { key: TaskStatus[]; title: string }[] = [
    { key: ['running'], title: 'ĐANG CHẠY' },
    { key: ['queued'], title: 'QUEUE' },
    { key: ['review'], title: 'REVIEW' },
    { key: ['done', 'failed', 'cancelled'], title: 'XONG' },
  ];
  const name = (id: string) => (id === 'system' ? 'system' : id.startsWith('#') ? id : (agents.get(id)?.name ?? id));
</script>

<aside class="panel">
  {#if agent}
    <header class="ahead">
      <button class="back" onclick={() => store.select(null)} aria-label="Quay lại">←</button>
      <span class="dot" style:background={NEON[agent.status]}></span>
      <div class="grow">
        <h2>{agent.name}</h2>
        <small>{agent.roleLabel} · {DEPARTMENTS.find((d) => d.id === agent.dept)?.name}</small>
      </div>
      <span class="st" style:color={NEON[agent.status]}>● {STATUS_TEXT[agent.status]}</span>
    </header>
    <dl>
      <dt>MODEL</dt><dd>{agent.model}</dd>
      <dt>SESSION</dt><dd>{agent.sessionId}</dd>
      <dt>WORKTREE</dt><dd>{agent.worktree}</dd>
      <dt>TOOLS</dt><dd>{agent.tools.join(' · ')}</dd>
      <dt>TASK</dt><dd class="task">{task?.title ?? agent.lastError ?? '—'}</dd>
    </dl>
    <div class="ctx">
      <span>CONTEXT</span>
      <div class="track"><i style:width="{agent.context * 100}%" class:hot={agent.context >= 0.8}></i></div>
      <b>{Math.round(agent.context * 100)}%</b>
    </div>
    <div class="ctrl">
      <button onclick={() => store.togglePause(agent.id)}>{agent.status === 'paused' ? 'Resume' : 'Pause'}</button>
      <button onclick={() => store.cancel(agent.id)} disabled={!agent.currentTaskId}>Cancel</button>
      <button onclick={() => store.retry(agent.id)} disabled={agent.status !== 'error'}>Retry</button>
      <button onclick={() => store.compact(agent.id)}>/compact</button>
    </div>
    <h3>SESSION STREAM</h3>
    <ol class="feed">
      {#each feed as e (e.id)}
        <li class="k-{e.kind}"><span class="k">{KIND[e.kind]}</span><span class="t">{e.text}</span><time>{ago($office.now, e.ts)}</time></li>
      {/each}
    </ol>
  {:else}
    <div class="tabs" role="tablist">
      {#each [['feed', 'Live'], ['bus', 'Bus'], ['tasks', 'Tasks'], ['audit', 'Audit']] as [k, label] (k)}
        <button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => (tab = k as Tab)}>{label}</button>
      {/each}
    </div>
    {#if tab === 'feed'}
      <ol class="feed">
        {#each feed as e (e.id)}
          {@const a = agents.get(e.agentId)}
          <li class="k-{e.kind}">
            <span class="who">{a?.name}</span>
            <span class="t"><em>{KIND[e.kind]}</em> {e.text}</span>
            <time>{ago($office.now, e.ts)}</time>
          </li>
        {/each}
      </ol>
    {:else if tab === 'bus'}
      <p class="note">Agent nhắn nhau qua office bus (MCP nội bộ), tối đa {$office.turnLimit} lượt mỗi cặp (anti-loop).</p>
      <ol class="feed bus">
        {#each $office.bus.slice(-40).reverse() as m (m.id)}
          <li class:blocked={m.blocked}>
            <span class="who">{name(m.from)} → {name(m.to)}</span>
            <span class="t">{m.text}{#if m.turn > 0 && !m.to.startsWith('#')}<em> · {m.turn}/{$office.turnLimit}</em>{/if}</span>
            <time>{ago($office.now, m.ts)}</time>
          </li>
        {/each}
      </ol>
    {:else if tab === 'tasks'}
      {#each COLS as c (c.title)}
        {@const items = $office.tasks.filter((t) => c.key.includes(t.status)).slice(-8).reverse()}
        <h3>{c.title} <span>{items.length}</span></h3>
        {#each items as t (t.id)}
          {@const a = agents.get(t.assignee)}
          <button class="trow s-{t.status}" onclick={() => store.select(t.assignee)}>
            <i></i><span class="grow">{t.title}</span><small>{a?.name}</small>
          </button>
        {/each}
      {/each}
    {:else}
      <ol class="feed">
        {#each $office.audit as e (e.id)}
          <li><span class="who">{e.actor}</span><span class="t">{e.action}</span><time>{ago($office.now, e.ts)}</time></li>
        {/each}
      </ol>
    {/if}
  {/if}
</aside>

<style>
  .panel {
    height: 100%; overflow-y: auto; padding: 16px; border-radius: 22px;
    background: var(--h-glass); border: 1px solid var(--h-line);
    backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .grow { flex: 1; min-width: 0; }
  .tabs { display: flex; gap: 4px; padding: 4px; background: rgba(255, 255, 255, 0.04); border-radius: 12px; margin-bottom: 12px; }
  .tabs button { flex: 1; border: 0; background: transparent; color: var(--h-muted); font: 600 12px 'Space Grotesk', sans-serif; padding: 7px; border-radius: 9px; cursor: pointer; letter-spacing: 0.5px; }
  .tabs button.on { background: rgba(255, 255, 255, 0.08); color: #f2f3f5; }
  .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .feed li { display: grid; grid-template-columns: 52px 1fr auto; gap: 8px; padding: 7px 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); font: 11.5px/1.45 'JetBrains Mono', monospace; animation: fade 0.4s ease-out; }
  .feed.bus li { grid-template-columns: 1fr auto; }
  .feed.bus .who { grid-column: 1 / -1; }
  @keyframes fade { from { opacity: 0; transform: translateX(6px); } }
  .feed .who { color: #f2f3f5; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .feed .k { font-weight: 600; color: var(--h-muted); }
  .feed em { font-style: normal; color: var(--h-muted); }
  .feed .t { color: #c9ccd3; overflow-wrap: anywhere; }
  .feed time { color: rgba(255, 255, 255, 0.28); font-size: 10px; }
  .k-tool_call .t, .k-tool_call .k { color: #eceef1; }
  .k-tool_result .t { color: #8d929d; }
  .k-user .t { color: #f2f3f5; font-weight: 500; }
  .k-error .t, .k-error .k { color: #e8737f; }
  .k-system .t { color: var(--h-muted); font-style: italic; }
  .blocked { opacity: 0.5; }
  .note { font: 11px 'JetBrains Mono', monospace; color: var(--h-muted); margin: 0 0 8px; }
  h3 { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: 2.5px; color: var(--h-muted); margin: 14px 0 6px; display: flex; justify-content: space-between; }
  .trow { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: rgba(255, 255, 255, 0.03); border: 1px solid transparent; border-radius: 10px; padding: 8px 10px; margin-bottom: 4px; color: #e6eaff; font: 500 12.5px 'Space Grotesk', sans-serif; cursor: pointer; }
  .trow:hover { border-color: var(--h-line); }
  .trow i { width: 6px; height: 6px; border-radius: 50%; flex: none; background: rgba(255, 255, 255, 0.35); }
  .trow small { color: var(--h-muted); font: 10px 'JetBrains Mono', monospace; }
  .trow.s-failed { box-shadow: inset 2px 0 0 #e8737f; }
  .trow.s-running { box-shadow: inset 2px 0 0 rgba(255, 255, 255, 0.6); }

  .ahead { display: flex; align-items: center; gap: 10px; }
  .back { border: 1px solid var(--h-line); background: transparent; color: #eef1ff; border-radius: 10px; width: 32px; height: 32px; cursor: pointer; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  h2 { font: 700 20px 'Space Grotesk', sans-serif; margin: 0; }
  .ahead small { color: var(--h-muted); font: 11px 'JetBrains Mono', monospace; }
  .st { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: 1.5px; }
  dl { display: grid; grid-template-columns: 84px 1fr; gap: 6px 10px; margin: 16px 0 12px; font: 11.5px 'JetBrains Mono', monospace; }
  dt { color: var(--h-muted); letter-spacing: 1.5px; font-size: 10px; padding-top: 1px; }
  dd { margin: 0; color: #d9dce3; overflow-wrap: anywhere; }
  dd.task { font-family: 'Space Grotesk', sans-serif; font-size: 13px; }
  .ctx { display: flex; align-items: center; gap: 10px; font: 10px 'JetBrains Mono', monospace; color: var(--h-muted); letter-spacing: 1.5px; }
  .ctx b { color: #eef1ff; font-weight: 500; }
  .track { flex: 1; height: 4px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden; }
  .track i { display: block; height: 100%; background: rgba(255, 255, 255, 0.75); border-radius: 4px; transition: width 0.6s; }
  .track i.hot { background: #e3b66f; }
  .ctrl { display: flex; gap: 6px; flex-wrap: wrap; margin: 14px 0 4px; }
  .ctrl button { font: 600 12px 'Space Grotesk', sans-serif; color: #eef1ff; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--h-line); border-radius: 10px; padding: 6px 12px; cursor: pointer; }
  .ctrl button:disabled { opacity: 0.35; cursor: not-allowed; }
  .ctrl button:not(:disabled):hover { border-color: rgba(255, 255, 255, 0.3); }
</style>
