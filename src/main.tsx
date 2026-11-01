import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { store } from './sim/store';
import './styles.css';

// Boot the mock orchestrator, then render. / Khởi động orchestrator giả lập rồi render.
store.start();

const el = document.getElementById('root');
if (!el) throw new Error('#root not found / không tìm thấy #root');
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
