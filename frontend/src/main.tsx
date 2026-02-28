import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import ScrollToTop from '@/components/ScrollToTop';
import ToastContainer from '@/components/ui/Toast';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ScrollToTop />
          <App />
        </BrowserRouter>
      </QueryClientProvider>
      <ToastContainer />
    </ErrorBoundary>
  </StrictMode>,
);
