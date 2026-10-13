import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { IS_DEMO } from './env.ts';
import './styles.css';

// The demo runs where browser dialogs are unavailable, and its data is resettable.
if (IS_DEMO) {
  window.confirm = () => true;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
