import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from '@/context/theme-provider';
import { installChunkErrorHandler } from '@/lib/lazy-with-retry';

// Catch stale chunk errors after rebuilds and auto-reload
installChunkErrorHandler();

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
