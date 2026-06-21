import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from '../pages/AdminPage';
import { useWalletStore } from '../stores/wallet';
import { MAINNET_OTC_CONTRACT } from '../utils/constants';

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

  it('shows CL8Y deposit address with copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    useWalletStore.setState({
      connected: true,
      address: 'terra1mockowner000000000000000000000000',
    });
    renderAdmin();
    await waitFor(() => {
      expect(screen.getByText(/Send CL8Y to this address/i)).toBeInTheDocument();
    });
    const addressButton = screen.getByRole('button', { name: MAINNET_OTC_CONTRACT });
    fireEvent.click(addressButton);
    expect(writeText).toHaveBeenCalledWith(MAINNET_OTC_CONTRACT);
    await waitFor(() => {
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    });
  });
});
