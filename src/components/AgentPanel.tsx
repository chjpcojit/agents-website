import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_COLOR } from '../scene/office';
import { store } from '../sim/store';
import type { Agent, AgentStatus, StreamKind } from '../sim/types';
import { ago, useOffice } from '../useOffice';

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Đang làm',
  idle: 'Rảnh',
  waiting: 'Chờ duyệt',
  error: 'Lỗi',
  paused: 'Tạm dừng',
};

const KIND_ICON: Record<StreamKind, string> = {
  user: '🧑‍💼',
  assistant: '💬',
  tool_call: '🔧',
  tool_result: '✅',
  system: '⚙️',
  error: '⛔',
};

export function Avatar({ agent, size = 36 }: { agent: Agent; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: agent.color }}>
      <span className="avatar-hair" style={{ background: agent.hair }} />
      <span className="avatar-face">
        <i />
        <i />
      </span>
    </span>
  );
}

function ContextBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="ctxbar" title={`Context ${pct}%`}>
      <div className={`bar ${pct >= 80 ? 'danger' : pct >= 60 ? 'warn' : 'ok'}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <small>context {pct}%</small>
    </div>
  );
}

/** Roster when nothing is selected. / Danh sách agent khi chưa chọn ai. */
function Roster() {
  const s = useOffice();
  return (
    <div className="roster">
      <p className="muted">6 agent, mỗi agent là một session Claude Code chạy trong git worktree riêng.</p>
      {s.agents.map((a) => {
        const task = s.tasks.find((t) => t.id === a.currentTaskId);
        return (
          <button key={a.id} className="roster-item" onClick={() => store.select(a.id)}>
            <Avatar agent={a} />
            <div className="grow">
              <div className="row between">
                <b>{a.name}</b>
                <span className="pill" style={{ background: STATUS_COLOR[a.status] }}>
                  {STATUS_LABEL[a.status]}
                </span>
              </div>
              <small className="muted">{a.roleLabel}</small>
              <div className="clip">{task ? task.title : a.lastError ?? '—'}</div>
              <ContextBar value={a.context} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Detail view: stream log, controls and chat box to assign work. / Chi tiết: stream log, nút điều khiển và ô chat để giao việc. */
function Detail({ agent }: { agent: Agent }) {
  const s = useOffice();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const events = useMemo(() => s.stream.filter((e) => e.agentId === agent.id).slice(-80), [s.stream, agent.id]);
  const task = s.tasks.find((t) => t.id === agent.currentTaskId);
  const queued = s.tasks.filter((t) => t.assignee === agent.id && t.status === 'queued');

  // Auto-scroll the log to the newest event. / Tự cuộn log xuống event mới nhất.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const submit = () => {
    store.assignTask(agent.id, draft);
    setDraft('');
  };

  return (
    <div className="detail">
      <div className="detail-head">
        <button className="ghost" onClick={() => store.select(null)} aria-label="Quay lại">
          ←
        </button>
        <Avatar agent={agent} size={44} />
        <div className="grow">
          <div className="row between">
            <h2>{agent.name}</h2>
            <span className="pill" style={{ background: STATUS_COLOR[agent.status] }}>
              {STATUS_LABEL[agent.status]}
            </span>
          </div>
          <small className="muted">
            {agent.roleLabel} · model <code>{agent.model}</code>
          </small>
        </div>
      </div>

      <dl className="facts">
        <dt>worktree</dt>
        <dd>
          <code>{agent.worktree}</code>
        </dd>
        <dt>session</dt>
        <dd>
          <code>{agent.sessionId}</code>
        </dd>
        <dt>tools</dt>
        <dd className="tags">
          {agent.tools.map((t) => (
            <code key={t}>{t}</code>
          ))}
        </dd>
        <dt>task</dt>
        <dd>{task?.title ?? (agent.lastError ? <span className="err">{agent.lastError}</span> : 'Không có')}</dd>
        {queued.length > 0 && (
          <>
            <dt>queue</dt>
            <dd>{queued.map((t) => t.title).join(' · ')}</dd>
          </>
        )}
      </dl>
      <ContextBar value={agent.context} />

      <div className="actions">
        <button onClick={() => store.togglePause(agent.id)}>{agent.status === 'paused' ? '▶ Resume' : '⏸ Pause'}</button>
        <button onClick={() => store.cancel(agent.id)} disabled={!agent.currentTaskId}>
          ✖ Cancel
        </button>
        <button onClick={() => store.retry(agent.id)} disabled={agent.status !== 'error'}>
          ↻ Retry
        </button>
        <button onClick={() => store.compact(agent.id)} title="Giả lập /compact">
          🗜 /compact
        </button>
      </div>

      <div className="log" ref={logRef}>
        {events.map((e) => (
          <div key={e.id} className={`log-item k-${e.kind}`}>
            <span className="ico">{KIND_ICON[e.kind]}</span>
            <span className="txt">{e.text}</span>
            <time>{ago(s.now, e.ts)}</time>
          </div>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Giao việc cho ${agent.name}…`} />
        <button type="submit" className="primary" disabled={!draft.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
}

export function AgentPanel() {
  const s = useOffice();
  const agent = s.agents.find((a) => a.id === s.selectedAgentId);
  return agent ? <Detail agent={agent} /> : <Roster />;
}
