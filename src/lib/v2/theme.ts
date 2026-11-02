import type { AgentStatus } from '../sim/types';

// Neon status palette for the futuristic UI. / Bảng màu neon theo trạng thái cho giao diện tương lai.
export const NEON: Record<AgentStatus, string> = {
  working: '#7fd1ae',
  waiting: '#e3b66f',
  error: '#e8737f',
  idle: '#5d616c',
  paused: '#8a8f9b',
};

export const STATUS_TEXT: Record<AgentStatus, string> = {
  working: 'ĐANG XỬ LÝ',
  waiting: 'CHỜ DUYỆT',
  error: 'LỖI',
  idle: 'SẴN SÀNG',
  paused: 'TẠM DỪNG',
};
