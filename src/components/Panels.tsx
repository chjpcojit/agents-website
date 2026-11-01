import { useMemo, useState } from 'react';
import { api } from '../api/mock';
import { store } from '../sim/store';
import type { Agent, TaskStatus } from '../sim/types';
import { ago, useOffice } from '../useOffice';
import { Avatar } from './AgentPanel';

const useAgentMap = () => {
  const s = useOffice();
  return useMemo(() => new Map<string, Agent>(s.agents.map((a) => [a.id, a])), [s.agents]);
};

/** Central approval inbox: tool permissions + agent questions, timeout → deny. / Hộp duyệt tập trung: quyền tool + câu hỏi của agent, hết giờ → deny.
 * Decisions go through OfficeApi (POST /approvals/{id}/decision). / Quyết định đi qua OfficeApi (POST /approvals/{id}/decision). */
export function ApprovalInbox() {
  const s = useOffice();
  const agents = useAgentMap();
  const pending = s.approvals.filter((a) => a.status === 'pending');
  const history = s.approvals.filter((a) => a.status !== 'pending').slice(0, 12);

  return (
    <div className="inbox">
      {pending.length === 0 && <div className="empty">Không có yêu cầu nào đang chờ 🎉</div>}
      {pending.map((ap) => {
        const a = agents.get(ap.agentId);
        const left = Math.max(0, Math.ceil((ap.deadline - s.now) / 1000));
        const total = Math.max(1, (ap.deadline - ap.createdAt) / 1000);
        return (
          <article key={ap.id} className={`card approval ${ap.risk === 'high' ? 'high' : ''}`}>
            <header className="row between">
              <div className="row">
                {a && <Avatar agent={a} size={28} />}
                <b>{a?.name}</b>
                <span className="tag">{ap.type === 'tool' ? `tool · ${ap.tool}` : 'hỏi'}</span>
                {ap.risk === 'high' && <span className="tag danger">high-risk</span>}
              </div>
              <span className={`countdown ${left < 20 ? 'soon' : ''}`}>{left}s</span>
            </header>
            {ap.type === 'tool' ? <pre className="cmd">$ {ap.summary}</pre> : <p className="question">{ap.summary}</p>}
            <small className="muted">{ap.detail} · hết giờ → mặc định deny</small>
            <div className="bar thin">
              <i style={{ width: `${(left / total) * 100}%` }} />
            </div>
            <div className="actions">
              {ap.type === 'tool' ? (
                <>
                  <button className="primary" onClick={() => void api.postDecision(ap.id, { decision: 'approve' })}>
                    Approve
                  </button>
                  <button onClick={() => void api.postDecision(ap.id, { decision: 'deny' })}>Deny</button>
                  <small className="muted">Không có “always allow” từ xa</small>
                </>
              ) : (
                ap.options?.map((o) => (
                  <button key={o} onClick={() => void api.postDecision(ap.id, { decision: 'answer', answer: o })}>
                    {o}
                  </button>
                ))
              )}
            </div>
          </article>
        );
      })}

      {history.length > 0 && <h3 className="section">Đã xử lý</h3>}
      {history.map((ap) => (
        <div key={ap.id} className="history-row">
          <span className={`dot s-${ap.status}`} />
          <span className="clip grow">
            <b>{agents.get(ap.agentId)?.name}</b> · {ap.type === 'tool' ? `${ap.tool}(${ap.summary})` : ap.summary}
          </span>
          <small className="muted">{ap.status === 'answered' ? `→ ${ap.answer}` : ap.status}</small>
        </div>
      ))}
    </div>
  );
}

/** Office bus feed: agent ↔ agent and channel messages. / Feed office bus: tin agent ↔ agent và kênh chung. */
export function BusFeed() {
  const s = useOffice();
  const agents = useAgentMap();
  const [filter, setFilter] = useState<string>('all');
  const name = (id: string) => (id === 'system' ? 'system' : id.startsWith('#') ? id : agents.get(id)?.name ?? id);
  const msgs = s.bus.filter((m) => filter === 'all' || m.from === filter || m.to === filter).slice(-60).reverse();

  return (
    <div className="bus">
      <div className="filters">
        {['all', '#general', ...s.agents.map((a) => a.id)].map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Tất cả' : name(f)}
          </button>
        ))}
      </div>
      <p className="muted small">
        Agent gọi tool <code>bus.send</code> của office bus (MCP nội bộ). Mỗi cặp tối đa {s.turnLimit} lượt rồi bị chặn (anti-loop).
      </p>
      {msgs.map((m) => {
        const from = agents.get(m.from);
        return (
          <div key={m.id} className={`msg ${m.from === 'system' ? 'sys' : ''} ${m.blocked ? 'blocked' : ''}`}>
            {from ? <Avatar agent={from} size={28} /> : <span className="avatar sys">⚙️</span>}
            <div className="grow">
              <div className="row between">
                <span>
                  <b>{name(m.from)}</b> → <b>{name(m.to)}</b>
                  {m.turn > 0 && !m.to.startsWith('#') && (
                    <span className="tag">
                      lượt {m.turn}/{s.turnLimit}
                    </span>
                  )}
                  {m.blocked && <span className="tag danger">blocked</span>}
                </span>
                <time>{ago(s.now, m.ts)}</time>
              </div>
              <p>{m.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const COLUMNS: { key: TaskStatus[]; title: string }[] = [
  { key: ['queued'], title: 'Queue' },
  { key: ['running'], title: 'Đang làm' },
  { key: ['review'], title: 'Review' },
  { key: ['done', 'failed', 'cancelled'], title: 'Xong / Lỗi' },
];

/** Kanban task board with a quick "new task" form. / Task board kiểu kanban kèm form tạo task nhanh. */
export function TaskBoard() {
  const s = useOffice();
  const agents = useAgentMap();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState(s.agents[0]?.id ?? '');

  return (
    <div className="board-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          store.assignTask(assignee, title);
          setTitle('');
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task mới…" />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assignee">
          {s.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="primary" disabled={!title.trim()}>
          Tạo
        </button>
      </form>
      <div className="board">
        {COLUMNS.map((c) => {
          const items = s.tasks.filter((t) => c.key.includes(t.status)).slice(-12).reverse();
          return (
            <div key={c.title} className="col">
              <h4>
                {c.title} <span>{items.length}</span>
              </h4>
              {items.map((t) => {
                const a = agents.get(t.assignee);
                return (
                  <div key={t.id} className={`task s-${t.status}`} onClick={() => store.select(t.assignee)}>
                    <p>{t.title}</p>
                    <div className="row between">
                      <span className="row">
                        {a && <Avatar agent={a} size={18} />}
                        <small>{a?.name}</small>
                      </span>
                      <small className="muted">
                        {t.status === 'failed' ? 'lỗi' : t.status === 'cancelled' ? 'huỷ' : ago(s.now, t.updatedAt)}
                        {t.parentId ? ' · subtask' : ''}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Audit log: who approved/assigned what. / Audit log: ai duyệt/giao gì. */
export function AuditLog() {
  const s = useOffice();
  return (
    <div className="audit">
      {s.audit.map((e) => (
        <div key={e.id} className="history-row">
          <span className={`dot ${e.actor === 'system' ? 's-expired' : 's-approved'}`} />
          <span className="grow">
            <b>{e.actor}</b> · {e.action}
          </span>
          <time>{ago(s.now, e.ts)}</time>
        </div>
      ))}
    </div>
  );
}
