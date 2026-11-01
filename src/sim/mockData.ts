import type { Agent, AgentRole, Approval, BusMessage, OfficeState, StreamEvent, Task } from './types';

// Seed data for the demo. Nothing here talks to a backend.
// Dữ liệu mẫu cho demo. Không có gì ở đây gọi backend.

export const AGENT_SEED: Omit<Agent, 'status' | 'context' | 'currentTaskId' | 'lastError'>[] = [
  {
    id: 'bo', name: 'Bơ', role: 'backend', roleLabel: 'Backend · Go', color: '#7cc08a', hair: '#4a3427',
    model: 'opus', worktree: '~/office/wt/bo', tools: ['Read', 'Edit', 'Bash(go *)', 'Grep'],
    sessionId: 'a1f3-bo', desk: 0,
  },
  {
    id: 'mit', name: 'Mít', role: 'frontend', roleLabel: 'Frontend · React', color: '#f6c453', hair: '#2f2a3a',
    model: 'sonnet', worktree: '~/office/wt/mit', tools: ['Read', 'Edit', 'Bash(npm *)', 'WebFetch'],
    sessionId: 'b7c2-mit', desk: 1,
  },
  {
    id: 'na', name: 'Na', role: 'mobile', roleLabel: 'Mobile · Flutter', color: '#8fb8f2', hair: '#6b3f2a',
    model: 'sonnet', worktree: '~/office/wt/na', tools: ['Read', 'Edit', 'Bash(flutter *)'],
    sessionId: 'c9d4-na', desk: 2,
  },
  {
    id: 'sau', name: 'Sấu', role: 'devops', roleLabel: 'DevOps · K8s', color: '#b59ae8', hair: '#1f1c24',
    model: 'sonnet', worktree: '~/office/wt/sau', tools: ['Read', 'Bash(kubectl get *)', 'Bash(terraform plan)'],
    sessionId: 'd2e8-sau', desk: 3,
  },
  {
    id: 'chanh', name: 'Chanh', role: 'qa', roleLabel: 'QA · Test', color: '#f29bb0', hair: '#a8643a',
    model: 'haiku', worktree: '~/office/wt/chanh', tools: ['Read', 'Bash(go test *)', 'Bash(npm test)'],
    sessionId: 'e5f1-chanh', desk: 4,
  },
  {
    id: 'cam', name: 'Cam', role: 'lead', roleLabel: 'Tech Lead · Review', color: '#f39a5b', hair: '#3b2b22',
    model: 'opus', worktree: '~/office/wt/cam', tools: ['Read', 'Grep', 'Bash(git diff *)'],
    sessionId: 'f0a6-cam', desk: 5,
  },
];

/** Who an agent usually pings for each role. / Mỗi role thường nhắn cho ai. */
export const COLLEAGUE: Record<AgentRole, string> = {
  backend: 'mit',
  frontend: 'bo',
  mobile: 'bo',
  devops: 'cam',
  qa: 'bo',
  lead: 'bo',
};

/** Task ideas used when the simulator invents new work. / Ý tưởng task khi simulator tự sinh việc. */
export const TASK_IDEAS: Record<AgentRole, string[]> = {
  backend: ['Thêm idempotency key cho API transfer', 'Viết outbox pattern cho Kafka', 'Fix deadlock ở ledger repo'],
  frontend: ['Làm màn hình approval inbox', 'Thêm SSE reconnect cho stream', 'Dark mode cho task board'],
  mobile: ['Push notification duyệt từ xa', 'Lưu token vào Keychain/Keystore', 'Màn hình chat agent'],
  devops: ['Viết Terraform cho Tailscale node', 'Thêm readiness probe cho orchestrator', 'Rotate secret qua Vault'],
  qa: ['Viết e2e test cho luồng duyệt', 'Test anti-loop của office bus', 'Regression test cho --resume'],
  lead: ['Review PR orchestrator', 'Chốt ADR: Go + claude -p', 'Review data model Approval'],
};

/** Shell commands per role, some flagged high-risk. / Lệnh shell theo role, vài lệnh bị đánh dấu high-risk. */
export const COMMANDS: Record<AgentRole, { cmd: string; risk: 'low' | 'high' }[]> = {
  backend: [{ cmd: 'go test ./internal/...', risk: 'low' }, { cmd: 'git push origin feat/idempotency', risk: 'high' }],
  frontend: [{ cmd: 'npm run build', risk: 'low' }, { cmd: 'rm -rf node_modules dist', risk: 'high' }],
  mobile: [{ cmd: 'flutter test', risk: 'low' }, { cmd: 'flutter pub upgrade --major-versions', risk: 'high' }],
  devops: [{ cmd: 'terraform plan', risk: 'low' }, { cmd: 'kubectl apply -f k8s/orchestrator.yaml', risk: 'high' }],
  qa: [{ cmd: 'go test -race ./...', risk: 'low' }, { cmd: 'docker system prune -af', risk: 'high' }],
  lead: [{ cmd: 'git diff main...HEAD --stat', risk: 'low' }, { cmd: 'git merge --no-ff feat/bus', risk: 'high' }],
};

export const QUESTIONS: Record<AgentRole, { q: string; options: string[] }> = {
  backend: { q: 'Idempotency key nên dùng UUIDv7 hay ULID?', options: ['UUIDv7', 'ULID', 'Để em tự chọn'] },
  frontend: { q: 'Task board dùng SSE hay WebSocket?', options: ['SSE', 'WebSocket'] },
  mobile: { q: 'Duyệt từ xa có cần biometric không?', options: ['Bắt buộc Face ID/vân tay', 'Chỉ PIN'] },
  devops: { q: 'Expose orchestrator qua Tailscale hay chỉ localhost?', options: ['Tailscale', 'Chỉ localhost'] },
  qa: { q: 'Có chặn merge khi coverage < 80% không?', options: ['Chặn', 'Chỉ cảnh báo'] },
  lead: { q: 'Turn limit cho office bus là bao nhiêu?', options: ['6 lượt', '10 lượt', '20 lượt'] },
};

/** Build the initial demo state relative to `now`. / Tạo state ban đầu cho demo, tính theo `now`. */
export function createInitialState(now: number): OfficeState {
  const ago = (s: number) => now - s * 1000;

  const tasks: Task[] = [
    { id: 't1', title: 'Thêm idempotency key cho API transfer', assignee: 'bo', status: 'running', parentId: null, createdAt: ago(600), updatedAt: ago(30) },
    { id: 't2', title: 'Làm màn hình approval inbox', assignee: 'mit', status: 'running', parentId: null, createdAt: ago(540), updatedAt: ago(20) },
    { id: 't3', title: 'Push notification duyệt từ xa', assignee: 'na', status: 'running', parentId: null, createdAt: ago(500), updatedAt: ago(15) },
    { id: 't4', title: 'Viết e2e test cho luồng duyệt', assignee: 'chanh', status: 'failed', parentId: 't2', createdAt: ago(480), updatedAt: ago(60) },
    { id: 't5', title: 'Review PR orchestrator', assignee: 'cam', status: 'running', parentId: null, createdAt: ago(420), updatedAt: ago(10) },
    { id: 't6', title: 'Viết Terraform cho Tailscale node', assignee: 'sau', status: 'done', parentId: null, createdAt: ago(1800), updatedAt: ago(300) },
    { id: 't7', title: 'Thêm readiness probe cho orchestrator', assignee: 'sau', status: 'queued', parentId: null, createdAt: ago(120), updatedAt: ago(120) },
    { id: 't8', title: 'Chốt ADR: Go + claude -p', assignee: 'cam', status: 'review', parentId: null, createdAt: ago(2400), updatedAt: ago(900) },
    { id: 't9', title: 'Test anti-loop của office bus', assignee: 'chanh', status: 'queued', parentId: null, createdAt: ago(90), updatedAt: ago(90) },
  ];

  const status: Record<string, Agent['status']> = { bo: 'working', mit: 'working', na: 'waiting', sau: 'idle', chanh: 'error', cam: 'working' };
  const context: Record<string, number> = { bo: 0.46, mit: 0.31, na: 0.58, sau: 0.12, chanh: 0.83, cam: 0.27 };
  const current: Record<string, string | null> = { bo: 't1', mit: 't2', na: 't3', sau: null, chanh: null, cam: 't5' };

  const agents: Agent[] = AGENT_SEED.map((a) => ({
    ...a,
    status: status[a.id] ?? 'idle',
    context: context[a.id] ?? 0.1,
    currentTaskId: current[a.id] ?? null,
    lastError: a.id === 'chanh' ? 'Bash(npm test) exit 1: 3 failed, 41 passed' : null,
  }));

  let n = 0;
  const ev = (agentId: string, kind: StreamEvent['kind'], text: string, s: number): StreamEvent => ({ id: `s0-${n++}`, agentId, kind, text, ts: ago(s) });
  const stream: StreamEvent[] = [
    ev('bo', 'user', 'Thêm idempotency key cho API transfer', 600),
    ev('bo', 'system', 'session resumed · claude -p --resume a1f3-bo', 598),
    ev('bo', 'assistant', 'Em đọc handler transfer và repo ledger trước nhé.', 590),
    ev('bo', 'tool_call', 'Grep "func (h *TransferHandler)" internal/', 585),
    ev('bo', 'tool_result', '3 matches · internal/transport/http/transfer.go', 584),
    ev('bo', 'tool_call', 'Edit internal/usecase/transfer.go (+42 −6)', 200),
    ev('mit', 'user', 'Làm màn hình approval inbox', 540),
    ev('mit', 'assistant', 'Em sẽ làm list + countdown timeout, mặc định deny khi hết giờ.', 530),
    ev('mit', 'tool_call', 'Edit src/components/ApprovalInbox.tsx (+120)', 120),
    ev('na', 'user', 'Push notification duyệt từ xa', 500),
    ev('na', 'tool_call', 'Bash flutter pub add firebase_messaging', 40),
    ev('na', 'system', 'Đang chờ duyệt quyền: Bash(flutter pub add …)', 39),
    ev('chanh', 'tool_call', 'Bash npm test', 70),
    ev('chanh', 'error', 'exit 1 · 3 failed, 41 passed (approval.spec.ts)', 60),
    ev('cam', 'user', 'Review PR orchestrator', 420),
    ev('cam', 'tool_call', 'Bash git diff main...HEAD --stat', 300),
    ev('cam', 'tool_result', '14 files changed, 812 insertions(+), 96 deletions(-)', 299),
    ev('sau', 'assistant', 'Terraform cho Tailscale node xong, plan sạch. Em rảnh nhé.', 300),
  ];

  const bus: BusMessage[] = [
    { id: 'b0', from: 'mit', to: 'bo', text: 'Anh Bơ ơi, API /approvals trả field deadline dạng gì ạ?', ts: ago(400), turn: 1 },
    { id: 'b1', from: 'bo', to: 'mit', text: 'RFC3339 UTC nhé, kèm status pending|approved|denied|expired.', ts: ago(380), turn: 2 },
    { id: 'b2', from: 'cam', to: '#general', text: 'Nhắc cả nhà: lệnh push/merge/apply luôn phải qua hộp duyệt.', ts: ago(250), turn: 1 },
    { id: 'b3', from: 'chanh', to: 'mit', text: 'Test approval.spec.ts fail 3 case timeout, em xem giúp nhé.', ts: ago(55), turn: 1 },
  ];

  const approvals: Approval[] = [
    {
      id: 'ap0', agentId: 'na', type: 'tool', tool: 'Bash', summary: 'flutter pub add firebase_messaging',
      detail: 'Thêm dependency mới vào pubspec.yaml', risk: 'low', createdAt: ago(39), deadline: now + 80_000, status: 'pending',
    },
    {
      id: 'ap1', agentId: 'cam', type: 'ask', summary: 'Turn limit cho office bus là bao nhiêu?',
      detail: 'Cam hỏi trước khi chốt config anti-loop', risk: 'low', options: ['6 lượt', '10 lượt', '20 lượt'],
      createdAt: ago(20), deadline: now + 110_000, status: 'pending',
    },
  ];

  return {
    now,
    agents,
    tasks,
    stream,
    bus,
    approvals,
    audit: [
      { id: 'au0', ts: ago(900), actor: 'Đức', action: 'Approve Bash(terraform apply) cho Sấu' },
      { id: 'au1', ts: ago(600), actor: 'Đức', action: 'Giao task "Thêm idempotency key cho API transfer" cho Bơ' },
      { id: 'au2', ts: ago(320), actor: 'system', action: 'Timeout → deny Bash(rm -rf ./tmp) của Mít' },
    ],
    flights: [],
    quota: { fiveHour: 0.42, weekly: 0.27, fiveHourResetAt: now + 2.6 * 3600_000 },
    concurrencyLimit: 4,
    turnLimit: 6,
    selectedAgentId: null,
  };
}
