import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Layers } from 'lucide-react';
import Header from './components/layout/Header';
import Auditor from './components/auditor/Auditor';
import Voice from './components/voice/Voice';

function App() {
  const [activeMode, setActiveMode] = useState<'auditor' | 'voice'>('auditor');
  const [isDark, setIsDark] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastAuditContext, setLastAuditContext] = useState<string>('');

  const addToHistory = (type: string, title: string, data: any) => {
    setHistory(prev => [{
      id: Date.now(),
      type,
      title,
      timestamp: new Date().toLocaleTimeString(),
      data
    }, ...prev]);
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-400 font-sans selection:bg-[var(--color-primary)] selection:text-white">
        <Header 
          activeMode={activeMode} 
          onModeChange={setActiveMode} 
          isDark={isDark} 
          onToggleDark={() => setIsDark(!isDark)}
          onOpenHistory={() => setIsHistoryOpen(true)}
        />
        
        <main className="max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-12 py-12 lg:py-16">
          <section className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center mb-14">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-2 text-[11px] font-semibold tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                Talent-ready document intelligence
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight">
                Audit resumes & documents with confidence, then query insights by voice.
              </h1>
              <p className="text-base sm:text-lg text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
                This platform reviews uploaded PDFs or images, extracts structured fields, and highlights risks or missing data.
                After auditing, switch to Voice to ask follow-up questions and get instant, plain-language answers.
              </p>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                {[
                  { title: 'Fast triage', body: 'Surface key fields and confidence scores in seconds.' },
                  { title: 'Safer hiring', body: 'Identify missing or inconsistent information early.' },
                  { title: 'Clear next steps', body: 'Voice prompts guide follow-up questions instantly.' }
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-divider)] shadow-[var(--shadow-sm)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)] mb-2">
                      {item.title}
                    </div>
                    <div className="text-[13px] text-[var(--color-text)] leading-relaxed">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-[var(--color-divider)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] p-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-4">How it works</div>
                <ol className="space-y-4 text-sm text-[var(--color-text)]">
                  <li className="flex gap-3">
                    <span className="text-[var(--color-primary)] font-bold">01</span>
                    Upload a resume, ID, or document scan (PDF or image).
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-primary)] font-bold">02</span>
                    Review extracted fields, confidence, and the compliance summary.
                  </li>
                  <li className="flex gap-3">
                    <span className="text-[var(--color-primary)] font-bold">03</span>
                    Ask Voice assistant follow-up questions to accelerate review.
                  </li>
                </ol>
              </div>
            </div>
          </section>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMode}
              initial={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            >
              {activeMode === 'auditor' ? (
                <Auditor onAuditSuccess={(report: any) => {
                  addToHistory('AUDIT', report.document_type, report);
                  setLastAuditContext(JSON.stringify(report));
                }} />
              ) : (
                <Voice 
                  context={lastAuditContext}
                  onVoiceSuccess={(input: string, output: string) => addToHistory('INTEL', input, output)} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* History Drawer */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-divider)] z-[101] shadow-2xl p-10 flex flex-col"
              >
                <div className="flex justify-between items-center mb-12 border-b border-[var(--color-divider)] pb-8">
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                         <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-primary)]">Activity Log</span>
                      </div>
                      <h2 className="text-3xl font-serif font-bold text-[var(--color-text)]">Audit History</h2>
                   </div>
                   <button 
                      onClick={() => setIsHistoryOpen(false)}
                      className="p-3 rounded-full hover:bg-[var(--color-surface-offset)] border border-[var(--color-divider)] transition-all group"
                   >
                     <X size={18} className="opacity-40 group-hover:opacity-100 group-hover:rotate-90 transition-transform" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-4 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                       <Clock size={48} strokeWidth={1} className="mb-6" />
                       <span className="text-[10px] font-bold uppercase tracking-[0.4em]">No activity yet</span>
                    </div>
                  ) : (
                    history.map((record) => (
                      <motion.div 
                        key={record.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-[var(--color-surface-offset)] border border-[var(--color-divider)] p-6 rounded-sm hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group"
                      >
                         <div className="flex items-center justify-between mb-4">
                           <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-[var(--color-primary)]">{record.type}</span>
                           <span className="text-[9px] font-mono opacity-30">{record.timestamp}</span>
                        </div>
                         <div className="text-sm font-bold text-[var(--color-text)] truncate mb-2 group-hover:text-[var(--color-primary)] transition-colors">{record.title}</div>
                         <div className="flex items-center gap-2 text-[9px] font-bold opacity-40 tracking-widest">
                           <Layers size={10} />
                           <span>Verified record</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-[var(--color-divider)] opacity-30 text-[9px] font-mono font-bold uppercase tracking-[0.2em] flex flex-col gap-2">
                   <div className="flex justify-between">
                     <span>Entries stored</span>
                     <span>{history.length}</span>
                   </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

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
