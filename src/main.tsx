import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useStore } from './store';

// ganchos para testes automatizados (somente em desenvolvimento ou com ?debug)
if (import.meta.env.DEV || location.search.includes('debug')) {
  (window as unknown as Record<string, unknown>).__store = useStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
