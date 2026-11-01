<script lang="ts">
  import { api } from '../api/mock';
  import { office } from '../stores/office';
  import Avatar from './Avatar.svelte';

  // Central approval inbox: tool permissions + agent questions, timeout → deny.
  // Decisions go through OfficeApi (POST /approvals/{id}/decision).
  // Hộp duyệt tập trung: quyền tool + câu hỏi của agent, hết giờ → deny.
  // Quyết định đi qua OfficeApi (POST /approvals/{id}/decision).
  const agents = $derived(new Map($office.agents.map((a) => [a.id, a])));
  const pending = $derived($office.approvals.filter((a) => a.status === 'pending'));
  const history = $derived($office.approvals.filter((a) => a.status !== 'pending').slice(0, 12));
</script>

<div class="inbox">
  {#if pending.length === 0}
    <div class="empty">Không có yêu cầu nào đang chờ 🎉</div>
  {/if}
  {#each pending as ap (ap.id)}
    {@const a = agents.get(ap.agentId)}
    {@const left = Math.max(0, Math.ceil((ap.deadline - $office.now) / 1000))}
    {@const total = Math.max(1, (ap.deadline - ap.createdAt) / 1000)}
    <article class="card approval" class:high={ap.risk === 'high'}>
      <header class="row between">
        <div class="row">
          {#if a}<Avatar agent={a} size={28} />{/if}
          <b>{a?.name}</b>
          <span class="tag">{ap.type === 'tool' ? `tool · ${ap.tool}` : 'hỏi'}</span>
          {#if ap.risk === 'high'}<span class="tag danger">high-risk</span>{/if}
        </div>
        <span class="countdown" class:soon={left < 20}>{left}s</span>
      </header>
      {#if ap.type === 'tool'}
        <pre class="cmd">$ {ap.summary}</pre>
      {:else}
        <p class="question">{ap.summary}</p>
      {/if}
      <small class="muted">{ap.detail} · hết giờ → mặc định deny</small>
      <div class="bar thin"><i style:width="{(left / total) * 100}%"></i></div>
      <div class="actions">
        {#if ap.type === 'tool'}
          <button class="primary" onclick={() => void api.postDecision(ap.id, { decision: 'approve' })}>Approve</button>
          <button onclick={() => void api.postDecision(ap.id, { decision: 'deny' })}>Deny</button>
          <small class="muted">Không có “always allow” từ xa</small>
        {:else}
          {#each ap.options ?? [] as o (o)}
            <button onclick={() => void api.postDecision(ap.id, { decision: 'answer', answer: o })}>{o}</button>
          {/each}
        {/if}
      </div>
    </article>
  {/each}

  {#if history.length > 0}<h3 class="section">Đã xử lý</h3>{/if}
  {#each history as ap (ap.id)}
    <div class="history-row">
      <span class="dot s-{ap.status}"></span>
      <span class="clip grow">
        <b>{agents.get(ap.agentId)?.name}</b> · {ap.type === 'tool' ? `${ap.tool}(${ap.summary})` : ap.summary}
      </span>
      <small class="muted">{ap.status === 'answered' ? `→ ${ap.answer}` : ap.status}</small>
    </div>
  {/each}
</div>
