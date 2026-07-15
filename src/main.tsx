import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and demote non-fatal network/Supabase errors from console.error to console.warn
const originalError = console.error;
console.error = function (...args) {
  const argStr = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message + '\n' + arg.stack;
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(' ');

  const isNetworkOrDbFetchError = 
    argStr.includes('Failed to fetch') || 
    argStr.includes('TypeError') ||
    argStr.includes('Lỗi kiểm tra Onboarding') ||
    argStr.includes('Lỗi fetchAllRows') ||
    argStr.includes('Lỗi tải b_') ||
    argStr.includes('Lỗi sync') ||
    argStr.includes('Lỗi khi tải dữ liệu từ Supabase Cloud') ||
    argStr.includes('Lỗi trong quá trình khởi tạo Auth');

  if (isNetworkOrDbFetchError) {
    console.warn('[Network/DB Warning (Demoted from Error)]:', ...args);
    return;
  }

  originalError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

