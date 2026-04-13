import { useState, useEffect } from 'react';
import Auditor from './components/auditor/Auditor';
import Voice from './components/voice/Voice';

function App() {
  const [activeTab, setActiveTab] = useState<'audit' | 'voice'>('audit');
  const [lastAuditContext, setLastAuditContext] = useState<string>('');
  const [auditDone, setAuditDone] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const exportResults = (report: any) => {
    const data = JSON.stringify(report, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-10 transition-colors ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className={`text-lg font-semibold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Document Intelligence System
            </h1>
            <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
              AI-Powered
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Tabs */}
            <div className={`flex rounded-lg p-1 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'audit'
                    ? isDark ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Document Analysis
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                disabled={!auditDone}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeTab === 'voice'
                    ? isDark ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                    : auditDone
                    ? isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 cursor-not-allowed'
                }`}
              >
                AI Assistant
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'audit' && (
          <Auditor
            isDark={isDark}
            onAuditSuccess={(report) => {
              setLastAuditContext(JSON.stringify(report));
              setAuditDone(true);
              // Auto-save to localStorage
              const history = JSON.parse(localStorage.getItem('auditHistory') || '[]');
              history.unshift({ id: Date.now(), date: new Date().toISOString(), report });
              localStorage.setItem('auditHistory', JSON.stringify(history.slice(0, 10)));
            }}
            onExport={exportResults}
          />
        )}

        {activeTab === 'voice' && auditDone && (
          <Voice
            context={lastAuditContext}
            isDark={isDark}
            onVoiceSuccess={(input, output) => {
              console.log('Voice interaction:', input, output);
            }}
          />
        )}

        {activeTab === 'voice' && !auditDone && (
          <div className={`text-center py-20 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">Analyze a document first to unlock AI Assistant</p>
            <p className="text-sm mt-2 opacity-70">Upload any document to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
