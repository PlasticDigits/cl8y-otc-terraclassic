import { TOKENS, USDC_DENOM, VYNTREX_MARKET_URLS } from '../../utils/constants';
import { getAddressScannerUrl } from '../../utils/format';

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="container mx-auto px-4 py-6 text-center text-xs text-gray-500 space-y-2">
        <p>CL8Y OTC Swap — Terra Classic</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://github.com/cl8y/cl8y-otc-terraclassic/blob/main/docs/contract.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400/80 hover:text-amber-300"
          >
            Contract docs
          </a>
          <a
            href="https://github.com/cl8y/cl8y-otc-terraclassic/blob/main/docs/tokens.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400/80 hover:text-amber-300"
          >
            Token info
          </a>
          <a
            href={getAddressScannerUrl(TOKENS.cl8y.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400/80 hover:text-amber-300"
          >
            CL8Y token
          </a>
          <a
            href={VYNTREX_MARKET_URLS.usdc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400/80 hover:text-amber-300"
            title={USDC_DENOM}
          >
            Noble USDC (IBC)
          </a>
        </div>
      </div>
    </footer>
  );
}
