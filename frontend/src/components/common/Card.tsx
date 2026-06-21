interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'highlight' | 'glass';
}

export function Card({ children, className = '', variant = 'default' }: CardProps) {
  const variants = {
    default: 'glass border border-white/5',
    highlight:
      'relative bg-gradient-to-br from-amber-500/10 via-surface-800/90 to-orange-500/10 border border-amber-500/20',
    glass: 'glass border border-white/5',
  };
  return (
    <div className={`rounded-2xl transition-all duration-300 ${variants[variant]} ${className}`}>
      <div className="relative">{children}</div>
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-5 md:p-6 ${className}`}>{children}</div>;
}
