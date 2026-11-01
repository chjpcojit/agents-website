import { useEffect, useState } from 'react';
import { AgentPanel } from './components/AgentPanel';
import { OfficeCanvas } from './components/OfficeCanvas';
import { ApprovalInbox, AuditLog, BusFeed, TaskBoard } from './components/Panels';
import { TopBar } from './components/TopBar';
import { useOffice } from './useOffice';

type Tab = 'agent' | 'approvals' | 'bus' | 'board' | 'audit';

export function App() {
  const s = useOffice();
  const [tab, setTab] = useState<Tab>('agent');
  const pending = s.approvals.filter((a) => a.status === 'pending').length;

  // Selecting a character in the scene jumps to its detail tab. / Chọn nhân vật trong scene thì nhảy sang tab chi tiết.
  useEffect(() => {
    if (s.selectedAgentId) setTab('agent');
  }, [s.selectedAgentId]);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'agent', label: 'Agent' },
    { key: 'approvals', label: 'Duyệt', badge: pending },
    { key: 'bus', label: 'Office bus' },
    { key: 'board', label: 'Task board' },
    { key: 'audit', label: 'Audit' },
  ];

  return (
    <div className="app">
      <TopBar onOpenApprovals={() => setTab('approvals')} />
      <main className="layout">
        <OfficeCanvas />
        <aside className="sidebar">
          <nav className="tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
                {!!t.badge && <span className="badge">{t.badge}</span>}
              </button>
            ))}
          </nav>
          <div className="panel">
            {tab === 'agent' && <AgentPanel />}
            {tab === 'approvals' && <ApprovalInbox />}
            {tab === 'bus' && <BusFeed />}
            {tab === 'board' && <TaskBoard />}
            {tab === 'audit' && <AuditLog />}
          </div>
        </aside>
      </main>
    </div>
  );
}
