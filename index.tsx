import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import './src/i18n';
import '@fontsource/dotgothic16';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LiveAPIProvider>
      <App />
    </LiveAPIProvider>
  </React.StrictMode>
);
