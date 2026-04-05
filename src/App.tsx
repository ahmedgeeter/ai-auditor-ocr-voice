import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Upload, Sparkles, Mic2, ArrowRight } from 'lucide-react';
import Header from './components/layout/Header';
import Auditor from './components/auditor/Auditor';
import Voice from './components/voice/Voice';

function App() {
  const [activeMode, setActiveMode] = useState<'auditor' | 'voice'>('auditor');
  const [isDark, setIsDark] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [lastAuditContext, setLastAuditContext] = useState<string>('');
  const [auditDone, setAuditDone] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');

  const T = {
    en: {
      badge: 'Built for HR teams · Powered by Groq AI',
      headline: 'Screen any CV in seconds.',
      sub: 'Upload a resume or document, get an instant AI-powered analysis, then ask follow-up questions by voice — all in one session.',
      steps: [
        { icon: Upload,   n: '1', title: 'Upload',  desc: 'Drop a CV, resume, or any hiring document (PDF or image).' },
        { icon: Sparkles, n: '2', title: 'Analyse', desc: 'AI extracts key fields, scores confidence, and flags any risks.' },
        { icon: Mic2,     n: '3', title: 'Ask',     desc: 'Switch to Voice and ask anything — answered instantly by AI.' },
      ],
      ctaAudit: 'Start: Scan a Document',
      ctaVoice: 'Then: Ask Questions',
      auditedBadge: '✓ Document analysed — now ask questions',
      log: 'Session Log', logTitle: 'Activity',
      entries: 'Items', empty: 'No activity yet', verified: 'AI-verified',
      demo: 'Demo mode', demoHint: 'Add VITE_GROQ_API_KEY for live AI', demoLink: 'Get key →',
    },
    ar: {
      badge: 'مصمم لفرق الموارد البشرية · مشغّل بـ Groq AI',
      headline: 'حلل أي سيرة ذاتية في ثوانٍ.',
      sub: 'ارفع سيرة ذاتية أو مستند، احصل على تحليل فوري بالذكاء الاصطناعي، ثم اسأل بصوتك — كل ذلك في جلسة واحدة.',
      steps: [
        { icon: Upload,   n: '١', title: 'رفع',     desc: 'ارفع سيرة ذاتية أو أي مستند توظيف (PDF أو صورة).' },
        { icon: Sparkles, n: '٢', title: 'تحليل',   desc: 'يستخرج الذكاء الاصطناعي الحقول ويقيّم الثقة ويكشف المخاطر.' },
        { icon: Mic2,     n: '٣', title: 'اسأل',    desc: 'انتقل إلى الصوت واسأل أي شيء — إجابة فورية.' },
      ],
      ctaAudit: 'ابدأ: افحص مستنداً',
      ctaVoice: 'ثم: اسأل بالصوت',
      auditedBadge: '✓ تم تحليل المستند — اسأل الآن',
      log: 'سجل الجلسة', logTitle: 'النشاط',
      entries: 'عناصر', empty: 'لا يوجد نشاط', verified: 'موثق بالذكاء الاصطناعي',
      demo: 'وضع تجريبي', demoHint: 'أضف VITE_GROQ_API_KEY للذكاء الحي', demoLink: 'احصل على المفتاح →',
    },
  };

  const t = T[language];

  const addToHistory = (type: string, title: string, data: any) => {
    setHistory(prev => [{ id: Date.now(), type, title, timestamp: new Date().toLocaleTimeString(), data }, ...prev]);
  };

  return (
    <div className={isDark ? 'dark' : ''} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">

        <Header
          activeMode={activeMode} onModeChange={setActiveMode}
          isDark={isDark} onToggleDark={() => setIsDark(d => !d)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          language={language} onToggleLanguage={() => setLanguage(l => l === 'en' ? 'ar' : 'en')}
          auditDone={auditDone}
        />

        <main className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10">

          {/* ── Hero ── */}
          <section className="pt-12 pb-10">
            {/* Ambient orb */}
            <div className="absolute top-0 left-0 w-[500px] h-[300px] bg-[var(--color-primary)] opacity-[0.04] rounded-full blur-3xl pointer-events-none -translate-x-1/2" />

            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 mb-6"
            >
              <motion.span className="w-2 h-2 rounded-full bg-[var(--color-success)]"
                animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">{t.badge}</span>
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight mb-4 max-w-2xl"
            >
              <span className="text-[var(--color-text)]">{t.headline.split(' ').slice(0, -2).join(' ')} </span>
              <span className="text-gradient">{t.headline.split(' ').slice(-2).join(' ')}</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
              className="text-[15px] text-[var(--color-text-muted)] leading-relaxed max-w-lg mb-8"
            >
              {t.sub}
            </motion.p>

            {/* 3-step flow */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="grid sm:grid-cols-3 gap-3 mb-8"
            >
              {t.steps.map((s, i) => (
                <motion.div key={s.n} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 + i * 0.07 }}
                  className={`relative glass-card rounded-2xl p-4 border transition-all group cursor-pointer ${
                    (i === 0 && activeMode === 'auditor') || (i === 2 && activeMode === 'voice')
                      ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary-highlight)]'
                      : 'border-[var(--color-divider)] hover:border-[var(--color-primary)]/30'
                  }`}
                  onClick={() => { if (i === 0) setActiveMode('auditor'); if (i === 2) setActiveMode('voice'); }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      (i === 0 && activeMode === 'auditor') || (i === 2 && activeMode === 'voice')
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}>{s.n}</span>
                    <span className="text-[12px] font-bold text-[var(--color-text)]">{s.title}</span>
                    {i < 2 && <ArrowRight size={12} className="ml-auto opacity-20" />}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{s.desc}</p>
                  {i === 1 && auditDone && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-bg)]" />
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="flex flex-wrap items-center gap-3"
            >
              <button onClick={() => setActiveMode('auditor')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold transition-all ${
                  activeMode === 'auditor'
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-divider)] hover:border-[var(--color-primary)]/40'
                }`}
              >
                <Upload size={13} />{t.ctaAudit}
              </button>
              <button onClick={() => setActiveMode('voice')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold transition-all ${
                  activeMode === 'voice'
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : auditDone
                      ? 'bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-divider)] hover:border-[var(--color-primary)]/40'
                      : 'opacity-40 cursor-not-allowed bg-[var(--color-surface-2)] border border-[var(--color-divider)] text-[var(--color-text-muted)]'
                }`}
                disabled={!auditDone}
                title={!auditDone ? (language === 'ar' ? 'افحص مستنداً أولاً' : 'Scan a document first') : undefined}
              >
                <Mic2 size={13} />{t.ctaVoice}
              </button>
              {auditDone && (
                <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] text-[var(--color-success)] font-semibold flex items-center gap-1"
                >
                  {t.auditedBadge}
                </motion.span>
              )}
            </motion.div>
          </section>

          {/* ── Panels (BOTH always mounted — shared session) ── */}
          <div className="pb-16">
            <motion.div
              key="auditor-panel"
              animate={{ opacity: activeMode === 'auditor' ? 1 : 0, y: activeMode === 'auditor' ? 0 : 8 }}
              transition={{ duration: 0.25 }}
              style={{ display: activeMode === 'auditor' ? 'block' : 'none' }}
            >
              <Auditor language={language} onAuditSuccess={(report: any) => {
                addToHistory('AUDIT', report.document_type || 'Document', report);
                setLastAuditContext(JSON.stringify(report));
                setAuditDone(true);
              }} />
            </motion.div>

            <motion.div
              key="voice-panel"
              animate={{ opacity: activeMode === 'voice' ? 1 : 0, y: activeMode === 'voice' ? 0 : 8 }}
              transition={{ duration: 0.25 }}
              style={{ display: activeMode === 'voice' ? 'block' : 'none' }}
            >
              <Voice
                context={lastAuditContext}
                language={language}
                onVoiceSuccess={(input, output) => addToHistory('INTEL', input.slice(0, 60), output)}
              />
            </motion.div>
          </div>
        </main>

        {/* ── History Drawer ── */}
        <AnimatePresence>
          {isHistoryOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsHistoryOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
              />
              <motion.aside
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="fixed top-0 right-0 h-full w-full max-w-xs bg-[var(--color-surface)] border-l border-[var(--color-divider)] z-[101] flex flex-col shadow-2xl"
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-divider)]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-primary)] mb-1">{t.log}</div>
                    <h2 className="text-xl font-serif font-bold">{t.logTitle}</h2>
                  </div>
                  <button onClick={() => setIsHistoryOpen(false)}
                    className="w-9 h-9 rounded-full border border-[var(--color-divider)] flex items-center justify-center hover:bg-[var(--color-surface-2)] transition-colors group"
                  >
                    <X size={15} className="opacity-40 group-hover:opacity-100 group-hover:rotate-90 transition-all" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 opacity-20 gap-3">
                      <Clock size={36} strokeWidth={1} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{t.empty}</span>
                    </div>
                  ) : history.map(r => (
                    <motion.div key={r.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-divider)] hover:border-[var(--color-primary)]/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-[var(--color-primary)]">{r.type}</span>
                        <span className="text-[9px] font-mono opacity-30">{r.timestamp}</span>
                      </div>
                      <p className="text-[12px] font-semibold truncate group-hover:text-[var(--color-primary)] transition-colors">{r.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1 opacity-50">{t.verified}</p>
                    </motion.div>
                  ))}
                </div>
                <div className="p-5 border-t border-[var(--color-divider)] text-[10px] font-mono opacity-30 flex justify-between uppercase tracking-wider">
                  <span>{t.entries}</span><span>{history.length}</span>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Demo banner */}
        {!import.meta.env.VITE_GROQ_API_KEY && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.2 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] border border-[var(--color-divider)] px-5 py-2.5 rounded-full text-[10px] font-semibold flex items-center gap-3 z-50 shadow-lg whitespace-nowrap"
          >
            <span className="text-[var(--color-primary)]">{t.demo}</span>
            <span className="opacity-40 hidden sm:inline">{t.demoHint}</span>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-[var(--color-primary)] hover:underline">{t.demoLink}</a>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default App;
