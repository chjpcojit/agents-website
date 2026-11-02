import type { AgentStatus } from '../sim/types';

// Neon status palette for the futuristic UI. / Bảng màu neon theo trạng thái cho giao diện tương lai.
export const NEON: Record<AgentStatus, string> = {
  working: '#4dffc3',
  waiting: '#ffc46b',
  error: '#ff5c7c',
  idle: '#7a83ad',
  paused: '#7ea6ff',
};

export const STATUS_TEXT: Record<AgentStatus, string> = {
  working: 'ĐANG XỬ LÝ',
  waiting: 'CHỜ DUYỆT',
  error: 'LỖI',
  idle: 'SẴN SÀNG',
  paused: 'TẠM DỪNG',
};
