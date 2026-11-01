import { useOffice } from '../useOffice';

function Meter({ label, value, sub }: { label: string; value: number; sub: string }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 85 ? 'danger' : pct >= 65 ? 'warn' : 'ok';
  return (
    <div className="meter" title={`${label}: ${pct}%`}>
      <div className="meter-head">
        <span>{label}</span>
        <b>{pct}%</b>
      </div>
      <div className={`bar ${tone}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <small>{sub}</small>
    </div>
  );
}

/** Header: brand, shared Max quota, concurrency/queue, pending approvals. / Header: logo, quota Max dùng chung, concurrency/queue, số yêu cầu duyệt. */
export function TopBar({ onOpenApprovals }: { onOpenApprovals: () => void }) {
  const s = useOffice();
  const active = s.agents.filter((a) => a.status === 'working' || a.status === 'waiting').length;
  const queued = s.tasks.filter((t) => t.status === 'queued').length;
  const pending = s.approvals.filter((a) => a.status === 'pending').length;
  const resetMin = Math.max(0, Math.round((s.quota.fiveHourResetAt - s.now) / 60000));

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          🏢
        </span>
        <div>
          <h1>Agent Office</h1>
          <p>Demo · mock data · chưa nối orchestrator</p>
        </div>
      </div>
      <div className="stats">
        <Meter label="Max · 5h" value={s.quota.fiveHour} sub={`reset sau ${Math.floor(resetMin / 60)}h${String(resetMin % 60).padStart(2, '0')}`} />
        <Meter label="Max · tuần" value={s.quota.weekly} sub="dùng chung mọi agent" />
        <div className="chip">
          <b>
            {active}/{s.concurrencyLimit}
          </b>
          <span>đang chạy</span>
        </div>
        <div className="chip">
          <b>{queued}</b>
          <span>trong queue</span>
        </div>
        <button className={`chip bell ${pending ? 'ring' : ''}`} onClick={onOpenApprovals}>
          <b>🔔 {pending}</b>
          <span>chờ duyệt</span>
        </button>
      </div>
    </header>
  );
}
