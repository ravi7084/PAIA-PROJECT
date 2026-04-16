/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — React Entry Point                   ║
 * ╚══════════════════════════════════════════════╝
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

if (window.location.pathname !== '/') {
  window.history.replaceState({}, '', '/');
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
