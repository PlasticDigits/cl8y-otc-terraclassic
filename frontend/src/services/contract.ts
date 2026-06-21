/**
 * Contract Service — LCD queries and OTC swap execution
 */

import {
  CONTRACTS,
  DEFAULT_NETWORK,
  DEFAULT_PRICE,
  LCD_CONFIG,
  NETWORKS,
  TOKENS,
  USDC_DENOM,
} from '../utils/constants';
import { executeContractWithCoins } from './wallet';
import { computeCl8yOut } from '../utils/swap';
import type { Cw20Balance, OtcConfig, SimulateSwapResponse } from '../types/contracts';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

const MOCK_CONFIG: OtcConfig = {
  owner: import.meta.env.VITE_MOCK_OWNER || 'terra1mockowner000000000000000000000000',
  cl8y_token: TOKENS.cl8y.address,
  usdc_denom: USDC_DENOM,
  destination: 'terra1mockdest000000000000000000000000000',
  price: DEFAULT_PRICE,
};

type NetworkKey = keyof typeof NETWORKS;

class ContractService {
  private network: NetworkKey = DEFAULT_NETWORK;
  private cache = new Map<string, { data: unknown; timestamp: number }>();

  getOtcAddress(): string {
    return CONTRACTS[this.network].otc;
  }

  private getLcdEndpoints(): readonly string[] {
    return NETWORKS[this.network].lcdFallbacks;
  }

  private async fetchLcd<T>(path: string): Promise<T> {
    const cached = this.cache.get(path);
    if (cached && Date.now() - cached.timestamp < LCD_CONFIG.cacheTtl) {
      return cached.data as T;
    }

    let lastError: Error | null = null;
    for (const base of this.getLcdEndpoints()) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), LCD_CONFIG.requestTimeout);
        const res = await fetch(`${base}${path}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`LCD ${res.status}`);
        const data = (await res.json()) as T;
        this.cache.set(path, { data, timestamp: Date.now() });
        return data;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (cached) return cached.data as T;
    throw lastError || new Error('All LCD endpoints failed');
  }

  private async queryContract<T>(contractAddress: string, query: object): Promise<T> {
    const queryBase64 = btoa(JSON.stringify(query));
    const path = `/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${queryBase64}`;
    const res = await this.fetchLcd<{ data: T }>(path);
    return res.data;
  }

  async getConfig(): Promise<OtcConfig> {
    if (DEV_MODE && !this.getOtcAddress()) return MOCK_CONFIG;
    const addr = this.getOtcAddress();
    if (!addr) throw new Error('OTC contract address not configured');
    return this.queryContract<OtcConfig>(addr, { config: {} });
  }

  async getTotalUsdcSpent(): Promise<string> {
    if (DEV_MODE && !this.getOtcAddress()) return '0';
    const addr = this.getOtcAddress();
    if (!addr) return '0';
    return this.queryContract<string>(addr, { total_usdc_spent: {} });
  }

  async simulateSwap(usdcIn: string): Promise<string> {
    if (DEV_MODE && !this.getOtcAddress()) {
      return computeCl8yOut(usdcIn, MOCK_CONFIG.price).toString();
    }
    const addr = this.getOtcAddress();
    if (!addr) throw new Error('OTC contract address not configured');
    const res = await this.queryContract<SimulateSwapResponse>(addr, {
      simulate_swap: { usdc_in: usdcIn },
    });
    return res.cl8y_out;
  }

  async getNativeBalance(address: string, denom: string): Promise<string> {
    if (DEV_MODE) {
      if (denom === USDC_DENOM) return '5000000';
      return '0';
    }
    const path = `/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(denom)}`;
    try {
      const res = await this.fetchLcd<{ balance: { amount: string } }>(path);
      return res.balance?.amount || '0';
    } catch {
      return '0';
    }
  }

  async getCw20Balance(tokenAddress: string, walletAddress: string): Promise<string> {
    if (DEV_MODE) return '10000000000000000000';
    const res = await this.queryContract<Cw20Balance>(tokenAddress, {
      balance: { address: walletAddress },
    });
    return res.balance;
  }

  async executeSwap(usdcAmountMicro: string): Promise<{ txHash: string }> {
    if (DEV_MODE && !this.getOtcAddress()) {
      return { txHash: 'MOCK_TX_HASH' };
    }
    const addr = this.getOtcAddress();
    if (!addr) throw new Error('OTC contract address not configured');
    return executeContractWithCoins(addr, { swap: {} }, [
      { denom: USDC_DENOM, amount: usdcAmountMicro },
    ]);
  }

  async updateRate(price: string): Promise<{ txHash: string }> {
    const addr = this.getOtcAddress();
    if (!addr) throw new Error('OTC contract address not configured');
    return executeContractWithCoins(addr, { update_rate: { price } }, []);
  }

  async updateDestination(destination: string): Promise<{ txHash: string }> {
    const addr = this.getOtcAddress();
    if (!addr) throw new Error('OTC contract address not configured');
    return executeContractWithCoins(addr, { update_destination: { destination } }, []);
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}

export const contractService = new ContractService();
