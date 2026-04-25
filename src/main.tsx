import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { queryClient } from '@/lib/queryClient';
import '@/i18n';
import { installZodI18n } from '@/lib/zod-i18n';
import { initTheme } from '@/features/theme/theme';
import '@/styles/globals.css';

installZodI18n();
initTheme();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
