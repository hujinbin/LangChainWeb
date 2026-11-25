import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/theme-dark.css';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少应用挂载节点');
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
