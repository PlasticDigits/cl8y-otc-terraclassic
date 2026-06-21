import { createPortal } from 'react-dom';
import { Button } from '../common';
import { ConfettiCanvas } from './ConfettiCanvas';

interface SwapSuccessPopoverProps {
  cl8yAmount: string;
  onClose: () => void;
}

export function SwapSuccessPopover({ cl8yAmount, onClose }: SwapSuccessPopoverProps) {
  return createPortal(
    <>
      <ConfettiCanvas active />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div
          role="dialog"
          aria-labelledby="swap-success-title"
          className="relative z-10 w-full max-w-sm glass border border-amber-500/25 rounded-2xl p-8 text-center shadow-2xl shadow-amber-500/10 animate-fade-in-up"
        >
          <p className="text-5xl mb-4" aria-hidden="true">
            🎉
          </p>
          <h2 id="swap-success-title" className="text-2xl font-bold text-white mb-3">
            Bought {cl8yAmount} CL8Y!
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Thank you for supporting TerraClassic ecosystem development. You are awesome!
          </p>
          <Button className="w-full" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>,
    document.body
  );
}
