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
  const [language, setLanguage] = useState<'en' | 'ar'>('en');

  const copy = {
    en: {
      badge: 'Talent-ready document intelligence',
      title: 'Audit resumes and hiring documents with confidence, then query insights by voice.',
      subtitle: 'This platform reviews uploaded PDFs or images, extracts structured fields, and highlights risks or missing data. After auditing, switch to Voice to ask follow-up questions and get instant, plain-language answers.',
      stats: ['98% HR clarity', '1.2s avg scan', '24/7 voice'],
      cards: [
        { title: 'Fast triage', body: 'Surface key fields and confidence scores in seconds.' },
        { title: 'Safer hiring', body: 'Identify missing or inconsistent information early.' },
        { title: 'Clear next steps', body: 'Voice prompts guide follow-up questions instantly.' }
      ],
      howTitle: 'How it works',
      how: [
        'Upload a resume, ID, or document scan (PDF or image).',
        'Review extracted fields, confidence, and the compliance summary.',
        'Ask Voice assistant follow-up questions to accelerate review.'
      ],
      activityLog: 'Activity Log',
      auditHistory: 'Audit History',
      entries: 'Entries stored',
      empty: 'No activity yet',
      verified: 'Verified record',
      demoMode: 'Demo Mode',
      addKey: 'Add VITE_GROQ_API_KEY for Live AI',
      getKey: 'Get Key →'
    },
    ar: {
      badge: 'ذكاء تدقيق المستندات للموارد البشرية',
      title: 'دقّق السير الذاتية ومستندات التوظيف بثقة، ثم اسأل بالبحث الصوتي فورًا.',
      subtitle: 'المنصة تراجع ملفات PDF أو الصور، تستخرج الحقول المنظمة، وتبرز المخاطر أو النقص. بعد التدقيق، استخدم المساعد الصوتي لأسئلة فورية وإجابات واضحة.',
      stats: ['وضوح 98% للموارد البشرية', 'فحص خلال 1.2 ثانية', 'مساعد صوتي 24/7'],
      cards: [
        { title: 'فرز سريع', body: 'أظهر أهم الحقول ونسب الثقة خلال ثوانٍ.' },
        { title: 'توظيف أكثر أمانًا', body: 'اكتشف التناقضات أو النقص مبكرًا.' },
        { title: 'خطوات واضحة', body: 'الأسئلة الصوتية تقترح المتابعة فورًا.' }
      ],
      howTitle: 'طريقة العمل',
      how: [
        'ارفع سيرة ذاتية أو هوية أو مستند (PDF أو صورة).',
        'راجع الحقول المستخرجة ونسب الثقة وملخص المطابقة.',
        'اسأل المساعد الصوتي لتسريع قرار التوظيف.'
      ],
      activityLog: 'سجل النشاط',
      auditHistory: 'سجل التدقيق',
      entries: 'عدد السجلات',
      empty: 'لا يوجد نشاط حتى الآن',
      verified: 'سجل موثق',
      demoMode: 'وضع تجريبي',
      addKey: 'أضف VITE_GROQ_API_KEY لتفعيل الذكاء الحي',
      getKey: 'الحصول على المفتاح →'
    }
  };

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
    <div className={`${isDark ? 'dark' : ''} ${language === 'ar' ? 'rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-400 font-sans selection:bg-[var(--color-primary)] selection:text-white">
        <Header 
          activeMode={activeMode} 
          onModeChange={setActiveMode} 
          isDark={isDark} 
          onToggleDark={() => setIsDark(!isDark)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          language={language}
          onToggleLanguage={() => setLanguage(prev => (prev === 'en' ? 'ar' : 'en'))}
        />
        
        <main className="max-w-[1200px] mx-auto px-5 sm:px-8 lg:px-10 py-10 lg:py-14">
          <section className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center mb-10">
            <div className="lg:col-span-7 space-y-6 fade-up">
              <div className="inline-flex items-center gap-3 rounded-full border border-[var(--color-divider)] bg-white/80 px-4 py-2 text-[10px] font-semibold tracking-[0.26em] uppercase text-[var(--color-text-muted)] shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                {copy[language].badge}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight">
                <span className="text-gradient">{copy[language].title}</span>
              </h1>
              <p className="text-[15px] sm:text-base text-[var(--color-text-muted)] leading-relaxed max-w-2xl">
                {copy[language].subtitle}
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {copy[language].cards.map((item, index) => (
                  <div key={item.title} className="glass-card rounded-2xl p-4 border border-[var(--color-divider)] transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2">
                      0{index + 1} — {item.title}
                    </div>
                    <div className="text-[13px] text-[var(--color-text)] leading-relaxed">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5 space-y-4 fade-up">
              <div className="glass-card rounded-3xl p-6 border border-[var(--color-divider)] shadow-[var(--shadow-md)] float-slow">
                <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)] mb-4">{copy[language].howTitle}</div>
                <ol className="space-y-3 text-[13px] text-[var(--color-text)]">
                  {copy[language].how.map((item, index) => (
                    <li key={item} className="flex gap-3">
                      <span className="text-[var(--color-primary)] font-bold">0{index + 1}</span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {copy[language].stats.map((stat) => (
                  <div key={stat} className="glass-card rounded-2xl p-3 text-center text-[11px] font-semibold text-[var(--color-text-muted)]">
                    {stat}
                  </div>
                ))}
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
                <Auditor language={language} onAuditSuccess={(report: any) => {
                  addToHistory('AUDIT', report.document_type, report);
                  setLastAuditContext(JSON.stringify(report));
                }} />
              ) : (
                <Voice 
                  context={lastAuditContext}
                  language={language}
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
                className="fixed top-0 right-0 h-full w-full max-w-sm bg-[var(--color-surface)] border-l border-[var(--color-divider)] z-[101] shadow-2xl p-8 sm:p-10 flex flex-col"
              >
                <div className="flex justify-between items-center mb-8 border-b border-[var(--color-divider)] pb-6">
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                         <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-primary)]">{copy[language].activityLog}</span>
                      </div>
                      <h2 className="text-2xl font-serif font-bold text-[var(--color-text)]">{copy[language].auditHistory}</h2>
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
                       <span className="text-[10px] font-bold uppercase tracking-[0.4em]">{copy[language].empty}</span>
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
                           <span>{copy[language].verified}</span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-[var(--color-divider)] opacity-30 text-[9px] font-mono font-bold uppercase tracking-[0.2em] flex flex-col gap-2">
                   <div className="flex justify-between">
                     <span>{copy[language].entries}</span>
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
            <span className="text-[var(--color-primary)]">{copy[language].demoMode}</span>
            <span className="opacity-40">{copy[language].addKey}</span>
            <a href="https://console.groq.com" target="_blank" className="text-[var(--color-primary)] hover:underline">{copy[language].getKey}</a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
