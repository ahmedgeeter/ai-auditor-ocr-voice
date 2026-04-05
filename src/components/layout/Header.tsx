import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Moon, Sun, Clock } from 'lucide-react';

interface HeaderProps {
  activeMode: 'auditor' | 'voice';
  onModeChange: (m: 'auditor' | 'voice') => void;
  isDark: boolean;
  onToggleDark: () => void;
  onOpenHistory: () => void;
  language: 'en' | 'ar';
  onToggleLanguage: () => void;
}

const Header = ({ activeMode, onModeChange, isDark, onToggleDark, onOpenHistory, language, onToggleLanguage }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/95 backdrop-blur-md border-b border-[var(--color-divider)] px-5 sm:px-8 lg:px-10 py-3 transition-colors duration-400">
      <div className="max-w-[1200px] mx-auto flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <span className="text-lg font-serif font-bold text-[var(--color-text)] tracking-tight">Meridian</span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--color-primary)] opacity-80">AI Audit Suite</span>
          </div>
          <div className="hidden md:flex items-center gap-6 border-l border-[var(--color-divider)] pl-6">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest opacity-50">System: Online</span>
            </div>
            <div className="flex items-center gap-2">
                <Cpu size={12} className="opacity-30" />
                <span className="text-[10px] font-mono font-semibold uppercase tracking-widest opacity-40">Engine: Groq</span>
            </div>
          </div>
        </div>

        <div className="flex bg-[var(--color-surface-2)] p-1 rounded-full border border-[var(--color-border)] shadow-inner">
          {(['auditor', 'voice'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`relative px-4 sm:px-6 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] transition-all ${
                activeMode === mode ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {activeMode === mode && (
                <motion.div
                  layoutId="mode-pill"
                  className="absolute inset-0 bg-[var(--color-primary)] rounded-full"
                  transition={{ type: 'spring', damping: 18, stiffness: 150 }}
                />
              )}
              <span className="relative z-10">{mode}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={onToggleDark}
             title="Toggle Theme"
             className="w-9 h-9 flex items-center justify-center border border-[var(--color-border)] rounded-full hover:bg-[var(--color-surface-offset)] transition-colors group"
           >
              {isDark ? <Sun size={15} className="opacity-50 group-hover:opacity-100" /> : <Moon size={15} className="opacity-50 group-hover:opacity-100" />}
           </button>
           <button
             onClick={onToggleLanguage}
             className="flex items-center gap-2 px-3 py-1.5 border border-[var(--color-border)] rounded-full hover:bg-[var(--color-surface-offset)] transition-colors group"
             title={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
           >
             <span className="text-[9px] font-semibold uppercase tracking-widest">
               {language === 'en' ? 'AR' : 'EN'}
             </span>
           </button>
           <button 
              onClick={onOpenHistory}
              className="flex items-center gap-2 px-3 py-1.5 border border-[var(--color-border)] rounded-full hover:bg-[var(--color-surface-offset)] transition-colors group"
            >
              <Clock size={13} className="opacity-40 group-hover:text-[var(--color-primary)] transition-colors" />
              <span className="text-[9px] font-semibold uppercase tracking-widest">
                {language === 'en' ? 'History' : 'السجل'}
              </span>
           </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
