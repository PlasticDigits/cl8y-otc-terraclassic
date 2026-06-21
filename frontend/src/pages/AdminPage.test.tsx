import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from '../pages/AdminPage';
import { useWalletStore } from '../stores/wallet';

vi.mock('../services/contract', () => ({
  contractService: {
    getConfig: vi.fn(() =>
      Promise.resolve({
        owner: 'terra1mockowner000000000000000000000000',
        cl8y_token: 'terra1cl8y',
        usdc_denom: 'ibc/test',
        destination: 'terra1dest',
        price: '700000',
      })
    ),
    getNativeBalance: vi.fn(() => Promise.resolve('0')),
    getCw20Balance: vi.fn(() => Promise.resolve('0')),
    getOtcAddress: () => '',
    updateRate: vi.fn(),
    updateDestination: vi.fn(),
  },
}));

function renderAdmin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPage />
    </QueryClientProvider>
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    useWalletStore.setState({
      connected: false,
      address: null,
      usdcBalance: '0',
      cl8yBalance: '0',
    });
  });

  it('shows locked state when not connected', () => {
    renderAdmin();
    expect(screen.getByText(/Connect owner wallet/i)).toBeInTheDocument();
  });

  it('shows locked state for non-owner wallet', async () => {
    useWalletStore.setState({
      connected: true,
      address: 'terra1notowner000000000000000000000000',
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText(/Admin Locked/i)).toBeInTheDocument();
    });
  });

  it('unlocks for owner wallet', async () => {
    useWalletStore.setState({
      connected: true,
      address: 'terra1mockowner000000000000000000000000',
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText(/Owner Admin/i)).toBeInTheDocument();
    });
  });
});
