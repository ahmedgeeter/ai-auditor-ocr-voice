import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Header from './components/layout/Header';
import Auditor from './components/auditor/Auditor';
import Voice from './components/voice/Voice';

function App() {
  const [activeMode, setActiveMode] = useState<'auditor' | 'voice'>('auditor');
  const [isDark, setIsDark] = useState(false);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-400 font-sans selection:bg-[var(--color-primary)] selection:text-white">
        <Header 
          activeMode={activeMode} 
          onModeChange={setActiveMode} 
          isDark={isDark} 
          onToggleDark={() => setIsDark(!isDark)}
        />
        
        <main className="max-w-[1600px] mx-auto px-12 py-12">
          <motion.div
            key={activeMode}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            {activeMode === 'auditor' ? <Auditor /> : <Voice />}
          </motion.div>
        </main>

        {/* Demo Mode Banner */}
        {!import.meta.env.VITE_GROQ_API_KEY && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[var(--color-surface-offset)] border border-[var(--color-primary)]/30 px-6 py-3 rounded-full text-[9px] font-bold tracking-[0.2em] uppercase flex items-center gap-4 z-50 shadow-lg transition-colors">
            <span className="text-[var(--color-primary)]">Demo Mode</span>
            <span className="opacity-40">Add VITE_GROQ_API_KEY for Live AI</span>
            <a href="https://console.groq.com" target="_blank" className="text-[var(--color-primary)] hover:underline">Get Key →</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
