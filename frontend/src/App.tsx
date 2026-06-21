import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/layout';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { useWalletStore } from './stores/wallet';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000 },
  },
});

function DevWalletBootstrap() {
  const location = useLocation();
  useEffect(() => {
    const devConnect =
      import.meta.env.VITE_DEV_MODE === 'true' &&
      (location.pathname === '/admin' || location.search.includes('devconnect=1'));

    if (devConnect && import.meta.env.VITE_MOCK_OWNER) {
      const addr =
        location.pathname === '/admin'
          ? import.meta.env.VITE_MOCK_OWNER
          : 'terra1testuser00000000000000000000000000';
      const state = useWalletStore.getState();
      if (!state.connected) {
        useWalletStore.setState({
          connected: true,
          address: addr,
          walletType: 'station',
          chainId: 'columbus-5',
        });
      }
    }
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DevWalletBootstrap />
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
