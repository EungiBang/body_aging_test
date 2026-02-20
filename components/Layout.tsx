
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--gradient-bg)' }}>
      {/* Subtle grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      
      <header className="glass px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center">
          <img src="/logo.jpg" alt="BrainTraining Center" className="h-10 object-contain" style={{ filter: 'brightness(1.1)' }} />
        </div>
        {title && (
          <div className="glass-light px-4 py-2 rounded-full text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {title}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col relative z-10">
        {children}
      </main>

      <footer className="glass py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        © 2024 BrainTraining Center · Brain Education 5-Step · AI Physical Assessment
      </footer>
    </div>
  );
};

export default Layout;
