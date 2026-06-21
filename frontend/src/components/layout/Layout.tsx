import { Header } from './Header';
import { Footer } from './Footer';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col animated-gradient-bg noise-overlay relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse-glow" />
      </div>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 relative z-10 max-w-lg">{children}</main>
      <Footer />
    </div>
  );
}
