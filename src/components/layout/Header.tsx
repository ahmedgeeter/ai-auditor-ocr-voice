import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, History, FileSearch, Mic2 } from 'lucide-react';

interface HeaderProps {
  activeMode: 'auditor' | 'voice';
  onModeChange: (m: 'auditor' | 'voice') => void;
  isDark: boolean;
  onToggleDark: () => void;
  onOpenHistory: () => void;
  language: 'en' | 'ar';
  onToggleLanguage: () => void;
  auditDone?: boolean;
}

const MODES = [
  { key: 'auditor' as const, icon: FileSearch, en: '1 · Scan Document', ar: '١ · فحص مستند' },
  { key: 'voice'   as const, icon: Mic2,       en: '2 · Ask Questions', ar: '٢ · اسأل بالصوت' },
];

const Header = ({ activeMode, onModeChange, isDark, onToggleDark, onOpenHistory, language, onToggleLanguage, auditDone }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-divider)] bg-[var(--color-bg)]/90 backdrop-blur-xl transition-colors duration-300">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-10 h-14 flex items-center justify-between gap-6">

        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[11px]">M</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-serif font-bold text-[var(--color-text)] tracking-tight">Meridian</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-[var(--color-primary)] opacity-70">AI Suite</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-[var(--color-divider)]">
            <motion.span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"
              animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
            />
            <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">Groq Online</span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-[var(--color-surface-2)] p-1 rounded-full border border-[var(--color-divider)]">
          {MODES.map(({ key, icon: Icon, en, ar }) => (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                activeMode === key ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {activeMode === key && (
                <motion.div layoutId="mode-bg"
                  className="absolute inset-0 bg-[var(--color-primary)] rounded-full shadow-sm"
                  transition={{ type: 'spring', damping: 20, stiffness: 180 }}
                />
              )}
              <Icon size={12} className="relative z-10 shrink-0" />
              <span className="relative z-10 hidden sm:inline tracking-[0.12em]">
                {language === 'ar' ? ar : en}
              </span>
              {key === 'voice' && auditDone && activeMode !== 'voice' && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-success)] border border-[var(--color-bg)] z-20" />
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggleLanguage}
            className="h-8 px-3 rounded-full border border-[var(--color-divider)] text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-all"
          >
            {language === 'en' ? 'ع' : 'EN'}
          </button>
          <button onClick={onToggleDark}
            className="w-8 h-8 rounded-full border border-[var(--color-divider)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-all"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={onOpenHistory}
            className="w-8 h-8 rounded-full border border-[var(--color-divider)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-all"
          >
            <History size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
