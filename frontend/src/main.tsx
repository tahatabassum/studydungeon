import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './state/SessionContext';
import '@fontsource/pirata-one/latin-400.css';
import '@fontsource/cinzel/latin-400.css';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
