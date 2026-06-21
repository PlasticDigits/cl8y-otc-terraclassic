import { BalanceCards } from '../components/swap/BalanceCards';
import { BuyHistory } from '../components/swap/BuyHistory';
import { SwapCard } from '../components/swap/SwapCard';

export function HomePage() {
  return (
    <div>
      <BalanceCards />
      <SwapCard />
      <BuyHistory />
    </div>
  );
}
