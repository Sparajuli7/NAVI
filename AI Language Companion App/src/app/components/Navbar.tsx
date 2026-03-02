import React from 'react';
import { Home, Pencil, Settings } from 'lucide-react';

interface NavbarProps {
  onGoHome: () => void;
  children?: React.ReactNode;
}

export function Navbar({ onGoHome, children }: NavbarProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card sticky top-0 z-10">
      {/* NAVI logo — always links home */}
      <button
        onClick={onGoHome}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <Home className="w-4 h-4 text-primary" />
        <span
          className="text-lg uppercase tracking-[0.15em] text-primary font-medium"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          NAVI
        </span>
      </button>

      {/* Spacer + contextual content */}
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
        {children}
        <button
          onClick={() => {}}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Pencil className="w-5 h-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => {}}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
