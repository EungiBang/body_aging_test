
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <i className="fas fa-brain"></i>
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">NEURO-PHYSICAL</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Brain Training Center</p>
          </div>
        </div>
        {title && <div className="text-slate-600 font-medium px-4 py-2 bg-slate-100 rounded-full text-sm">{title}</div>}
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 p-4 text-center text-xs text-slate-400">
        &copy; 2024 Brain Training Center. All Rights Reserved. AI Physical Assessment Module.
      </footer>
    </div>
  );
};

export default Layout;
