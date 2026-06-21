import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BuyRecord {
  txHash: string;
  cl8yAmount: string;
  walletAddress: string;
  timestamp: number;
}

interface BuyHistoryState {
  buys: BuyRecord[];
  addBuy: (buy: Omit<BuyRecord, 'timestamp'>) => void;
}

export const useBuyHistoryStore = create<BuyHistoryState>()(
  persist(
    (set) => ({
      buys: [],
      addBuy: (buy) =>
        set((state) => {
          if (state.buys.some((b) => b.txHash === buy.txHash)) return state;
          return {
            buys: [{ ...buy, timestamp: Date.now() }, ...state.buys],
          };
        }),
    }),
    { name: 'cl8y-buy-history' }
  )
);
