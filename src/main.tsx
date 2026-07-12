import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found — check index.html for <div id="root"></div>');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
