import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import AdminApp from './AdminApp';
import '../index.css';

// Entrada separada del panel administrativo.
// HashRouter evita depender de rewrites del servidor para una SPA estática.
ReactDOM.createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <HashRouter>
      <AdminApp />
    </HashRouter>
  </React.StrictMode>
);
