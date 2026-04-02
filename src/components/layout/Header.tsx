import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Cpu, Layers, Moon, Sun } from 'lucide-react';

interface HeaderProps {
    activeMode: string;
    onModeChange: (m: 'auditor' | 'voice') => void;
    isDark: boolean;
    onToggleDark: () => void;
}

const Header = ({ activeMode, onModeChange, isDark, onToggleDark }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-divider)] px-8 py-3 transition-colors duration-400">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        
        {/* Brand & Technical Metadata */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-xl font-serif font-bold text-[var(--color-text)] tracking-tight">Meridıan</span>
            <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[var(--color-primary)] opacity-80">Autonomous Intelligence</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 border-l border-[var(--color-divider)] pl-6">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-40">System: Active</span>
            </div>
            <div className="flex items-center gap-2">
                <Cpu size={10} className="opacity-30" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest opacity-40">Engine: v3+</span>
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-[var(--color-surface-2)] p-1 rounded-sm border border-[var(--color-border)] shadow-inner">
          {(['auditor', 'voice'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`relative px-8 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                activeMode === mode ? 'text-[var(--color-text-inverse)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {activeMode === mode && (
                <motion.div
                  layoutId="mode-pill"
                  className="absolute inset-0 bg-[var(--color-primary)] rounded-sm"
                  transition={{ type: 'spring', damping: 18, stiffness: 150 }}
                />
              )}
              <span className="relative z-10">{mode}</span>
            </button>
          ))}
        </div>

        {/* Action / Meta */}
        <div className="flex items-center gap-4">
           <button 
             onClick={onToggleDark}
             className="w-10 h-10 flex items-center justify-center border border-[var(--color-border)] rounded-sm hover:bg-[var(--color-surface-offset)] transition-colors group"
           >
              {isDark ? <Sun size={14} className="opacity-40 group-hover:opacity-100" /> : <Moon size={14} className="opacity-40 group-hover:opacity-100" />}
           </button>
           <button className="hidden lg:flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-sm hover:bg-[var(--color-surface-offset)] transition-colors group">
              <Layers size={14} className="opacity-40 group-hover:text-[var(--color-primary)] transition-colors" />
              <span className="text-[9px] font-bold uppercase tracking-widest">History</span>
           </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
