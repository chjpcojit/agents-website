// Client-only SPA: three.js needs the DOM, and the orchestrator lives on localhost.
// SPA chỉ chạy client: three.js cần DOM, và orchestrator nằm trên localhost.
export const ssr = false;
export const prerender = true;
