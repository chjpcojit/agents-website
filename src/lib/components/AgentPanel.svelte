<script lang="ts">
  import { tick } from 'svelte';
  import { STATUS_LABEL } from '../labels';
  import { STATUS_COLOR } from '../scene/office';
  import { DEPARTMENTS } from '../sim/departments';
  import { store } from '../sim/store';
  import type { StreamKind } from '../sim/types';
  import { ago, office } from '../stores/office';
  import Avatar from './Avatar.svelte';
  import ContextBar from './ContextBar.svelte';

  const KIND_ICON: Record<StreamKind, string> = {
    user: '🧑‍💼',
    assistant: '💬',
    tool_call: '🔧',
    tool_result: '✅',
    system: '⚙️',
    error: '⛔',
  };

  const teams = DEPARTMENTS.filter((d) => d.hasTeam);
  const agent = $derived($office.agents.find((a) => a.id === $office.selectedAgentId));
  const events = $derived(agent ? $office.stream.filter((e) => e.agentId === agent.id).slice(-80) : []);
  const task = $derived(agent ? $office.tasks.find((t) => t.id === agent.currentTaskId) : undefined);
  const queued = $derived(agent ? $office.tasks.filter((t) => t.assignee === agent.id && t.status === 'queued') : []);

  let draft = $state('');
  let log = $state<HTMLDivElement>();

  // Auto-scroll the log to the newest event. / Tự cuộn log xuống event mới nhất.
  $effect(() => {
    void events.length;
    tick().then(() => {
      if (log) log.scrollTop = log.scrollHeight;
    });
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!agent || !draft.trim()) return;
    store.assignTask(agent.id, draft);
    draft = '';
  }
</script>

{#if agent}
  <!-- Detail view: stream log, controls and chat box to assign work. / Chi tiết: stream log, nút điều khiển và ô chat để giao việc. -->
  <div class="detail">
    <div class="detail-head">
      <button class="ghost" onclick={() => store.select(null)} aria-label="Quay lại">←</button>
      <Avatar {agent} size={44} />
      <div class="grow">
        <div class="row between">
          <h2>{agent.name}</h2>
          <span class="pill" style:background={STATUS_COLOR[agent.status]}>{STATUS_LABEL[agent.status]}</span>
        </div>
        <small class="muted">{agent.roleLabel} · model <code>{agent.model}</code></small>
      </div>
    </div>

    <dl class="facts">
      <dt>phòng ban</dt>
      <dd>{DEPARTMENTS.find((d) => d.id === agent.dept)?.name}</dd>
      <dt>worktree</dt>
      <dd><code>{agent.worktree}</code></dd>
      <dt>session</dt>
      <dd><code>{agent.sessionId}</code></dd>
      <dt>tools</dt>
      <dd class="tags">
        {#each agent.tools as t (t)}<code>{t}</code>{/each}
      </dd>
      <dt>task</dt>
      <dd>
        {#if task}{task.title}{:else if agent.lastError}<span class="err">{agent.lastError}</span>{:else}Không có{/if}
      </dd>
      {#if queued.length > 0}
        <dt>queue</dt>
        <dd>{queued.map((t) => t.title).join(' · ')}</dd>
      {/if}
    </dl>
    <ContextBar value={agent.context} />

    <div class="actions">
      <button onclick={() => store.togglePause(agent.id)}>{agent.status === 'paused' ? '▶ Resume' : '⏸ Pause'}</button>
      <button onclick={() => store.cancel(agent.id)} disabled={!agent.currentTaskId}>✖ Cancel</button>
      <button onclick={() => store.retry(agent.id)} disabled={agent.status !== 'error'}>↻ Retry</button>
      <button onclick={() => store.compact(agent.id)} title="Giả lập /compact">🗜 /compact</button>
    </div>

    <div class="log" bind:this={log}>
      {#each events as e (e.id)}
        <div class="log-item k-{e.kind}">
          <span class="ico">{KIND_ICON[e.kind]}</span>
          <span class="txt">{e.text}</span>
          <time>{ago($office.now, e.ts)}</time>
        </div>
      {/each}
    </div>

    <form class="composer" onsubmit={submit}>
      <input bind:value={draft} placeholder="Giao việc cho {agent.name}…" />
      <button type="submit" class="primary" disabled={!draft.trim()}>Gửi</button>
    </form>
  </div>
{:else}
  <!-- Roster grouped by department. / Danh sách agent theo phòng ban. -->
  <div class="roster">
    <p class="muted">
      {$office.agents.length} agent ở {teams.length} phòng ban, mỗi agent là một session Claude Code chạy trong git worktree riêng.
    </p>
    {#each teams as d (d.id)}
      <section class="dept-group">
        <h3><i style:background={d.accent}></i>{d.icon} {d.name}</h3>
        {#each $office.agents.filter((a) => a.dept === d.id) as a (a.id)}
          {@const t = $office.tasks.find((x) => x.id === a.currentTaskId)}
          <button class="roster-item" onclick={() => store.select(a.id)}>
            <Avatar agent={a} />
            <div class="grow">
              <div class="row between">
                <b>{a.name}</b>
                <span class="pill" style:background={STATUS_COLOR[a.status]}>{STATUS_LABEL[a.status]}</span>
              </div>
              <small class="muted">{a.roleLabel}</small>
              <div class="clip">{t ? t.title : (a.lastError ?? '—')}</div>
              <ContextBar value={a.context} />
            </div>
          </button>
        {/each}
      </section>
    {/each}
  </div>
{/if}
