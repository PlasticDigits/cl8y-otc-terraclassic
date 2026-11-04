import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractService } from '../services/contract';
import { POLLING_INTERVAL } from '../utils/constants';

export function useOtcConfig() {
  return useQuery({
    queryKey: ['otc', 'config'],
    queryFn: () => contractService.getConfig(),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useOtcCl8yBalance() {
  return useQuery({
    queryKey: ['otc', 'cl8yBalance'],
    queryFn: () => contractService.getOtcCl8yBalance(),
    refetchInterval: POLLING_INTERVAL,
  });
}

export function useSimulateSwap(usdtIn: string) {
  return useQuery({
    queryKey: ['otc', 'simulate', usdtIn],
    queryFn: () => contractService.simulateSwap(usdtIn),
    enabled: BigInt(usdtIn || '0') > 0n,
  });
}

export function useSwap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usdtAmount: string) => contractService.executeSwap(usdtAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otc'] });
    },
  });
}

export function useUpdateRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (price: string) => contractService.updateRate(price),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['otc'] }),
  });
}

export function useUpdateDestination() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (destination: string) => contractService.updateDestination(destination),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['otc'] }),
  });
}
