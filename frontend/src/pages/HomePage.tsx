import { BalanceCards } from '../components/swap/BalanceCards';
import { SwapCard } from '../components/swap/SwapCard';

export function HomePage() {
  return (
    <div>
      <BalanceCards />
      <SwapCard />
    </div>
  );
}
