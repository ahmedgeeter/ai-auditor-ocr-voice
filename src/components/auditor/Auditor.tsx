import { useState, useEffect } from 'react';
import { auditDocument } from '../../lib/groq';
import { pdfPageToBase64 } from '../../lib/pdf';

interface AuditorProps {
  isDark?: boolean;
  onAuditSuccess?: (report: any) => void;
  onExport?: (report: any) => void;
}

// Get icon based on document type
const getDocumentIcon = (type: string) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('contract') || t.includes('agreement')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  if (t.includes('invoice') || t.includes('receipt') || t.includes('bill')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  );
  if (t.includes('cv') || t.includes('resume')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
  if (t.includes('id') || t.includes('passport')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
    </svg>
  );
  if (t.includes('bank') || t.includes('statement')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
  if (t.includes('certificate')) return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  // Default
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

export default function Auditor({ isDark = false, onAuditSuccess, onExport }: AuditorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'fields' | 'insights' | 'entities' | 'anomalies'>('fields');
  const [uiLang, setUiLang] = useState<'en' | 'ar'>('en');

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('auditHistory');
    if (saved) setHistory(JSON.parse(saved).slice(0, 5));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setReport(null);
    setError(null);

    if (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf')) {
      try {
        const base64 = await pdfPageToBase64(selectedFile, 1);
        setPreview(`data:image/jpeg;base64,${base64}`);
      } catch {
        setError('Failed to load PDF preview');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const resizeImage = (base64: string, maxWidth = 1600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.src = `data:image/jpeg;base64,${base64}`;
    });
  };

  const runAudit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      let imageBase64: string;
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        imageBase64 = await pdfPageToBase64(file, 1);
      } else {
        const reader = new FileReader();
        const rawBase64 = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        imageBase64 = await resizeImage(rawBase64);
      }

      const result = await auditDocument(imageBase64);

      // The auditDocument function already cleans the JSON, but double-check here
      let content = result.content.trim();
      
      // Extract JSON from response (handles cases where AI adds text before/after)
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      // Remove any markdown code block remnants and control characters
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
      content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      // Remove trailing commas before } or ] (invalid JSON from AI)
      content = content.replace(/,(\s*[}\]])/g, '$1');

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (parseErr: any) {
        throw new Error(`AI returned malformed JSON. Please try again. (${parseErr.message})`);
      }
      setReport(parsed);
      setActiveTab('fields');
      onAuditSuccess?.(parsed);
    } catch (err: any) {
      console.error('Audit error:', err);
      setError(err?.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem('auditHistory');
    setHistory([]);
  };

  const theme = {
    bg: isDark ? 'bg-slate-800' : 'bg-white',
    bgSecondary: isDark ? 'bg-slate-700' : 'bg-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    borderSecondary: isDark ? 'border-slate-600' : 'border-slate-100',
    accent: 'text-indigo-500',
    accentBg: 'bg-indigo-600',
    success: isDark ? 'text-green-400' : 'text-green-600',
    warning: isDark ? 'text-amber-400' : 'text-amber-600',
    error: isDark ? 'text-red-400' : 'text-red-600',
  };

  const copy = {
    en: {
      workspaceTitle: 'AI Document Auditor',
      uploadTitle: 'Document Upload',
      clearHistory: 'Clear history',
      recentAnalyses: 'Recent analyses',
      dropFile: 'Drop file here or click to browse',
      fileTypes: 'PDF · JPG · PNG · ID · Invoice · CV',
      change: 'Change',
      done: 'Done',
      remove: 'Remove',
      analyze: 'Analyze with AI',
      analyzing: 'Analyzing...',
      overviewTitle: 'Analysis Overview',
      exportJson: 'Export JSON',
      noAnalysisYet: 'No analysis yet',
      noAnalysisHint: 'Upload a document and click Analyze with AI',
      analysisFailed: 'Analysis failed',
      analysisFailedHint: 'Please check your file and try again',
      tryAgain: 'Try again',
      fieldsRead: 'Fields Read',
      fieldsReadSub: 'visible extracted values',
      anomalies: 'Anomalies',
      anomaliesClean: 'Clean',
      anomaliesCleanSub: 'no issues found',
      anomaliesFlaggedSub: 'needs review',
      accuracy: 'AI Accuracy',
      accuracySub: 'reading confidence',
      aiSummary: 'AI Summary',
      extractedFields: 'Extracted Fields',
      insights: 'Insights & Tips',
      recommendations: 'Recommendations',
      entities: 'Entities',
      noInsights: 'No insights available.',
      noEntities: 'No entities detected.',
      noAnomalies: 'No anomalies detected. Document looks clean.',
      aiBusyTitle: 'AI is analyzing...',
      aiBusySub: 'Detecting type · Extracting fields · Verifying',
      verifiedMsg: 'This document appears authentic and all fields are consistent.',
      suspiciousMsg: 'AI detected inconsistencies. Manual review is recommended.',
      genericMsg: 'AI successfully read and extracted the document content.'
    },
    ar: {
      workspaceTitle: 'مراجع المستندات بالذكاء الاصطناعي',
      uploadTitle: 'رفع المستند',
      clearHistory: 'مسح السجل',
      recentAnalyses: 'التحليلات الأخيرة',
      dropFile: 'اسحب الملف هنا أو اضغط للاختيار',
      fileTypes: 'PDF · JPG · PNG · هوية · فاتورة · سيرة ذاتية',
      change: 'تغيير',
      done: 'تم',
      remove: 'حذف',
      analyze: 'تحليل بالذكاء الاصطناعي',
      analyzing: 'جاري التحليل...',
      overviewTitle: 'ملخص التحليل',
      exportJson: 'تصدير JSON',
      noAnalysisYet: 'لا يوجد تحليل بعد',
      noAnalysisHint: 'ارفع مستنداً ثم اضغط تحليل بالذكاء الاصطناعي',
      analysisFailed: 'فشل التحليل',
      analysisFailedHint: 'يرجى مراجعة الملف ثم المحاولة مرة أخرى',
      tryAgain: 'إعادة المحاولة',
      fieldsRead: 'الحقول المقروءة',
      fieldsReadSub: 'قيم مرئية مستخرجة',
      anomalies: 'المشكلات',
      anomaliesClean: 'سليم',
      anomaliesCleanSub: 'لا توجد مشكلات',
      anomaliesFlaggedSub: 'تحتاج مراجعة',
      accuracy: 'دقة الذكاء الاصطناعي',
      accuracySub: 'ثقة القراءة',
      aiSummary: 'ملخص التحليل',
      extractedFields: 'الحقول المستخرجة',
      insights: 'الملاحظات والتوصيات',
      recommendations: 'التوصيات',
      entities: 'الكيانات',
      noInsights: 'لا توجد ملاحظات متاحة.',
      noEntities: 'لا توجد كيانات مكتشفة.',
      noAnomalies: 'لا توجد مشكلات. المستند يبدو سليماً.',
      aiBusyTitle: 'جاري التحليل بالذكاء الاصطناعي...',
      aiBusySub: 'تحديد النوع · استخراج الحقول · التحقق',
      verifiedMsg: 'يبدو أن المستند صحيح وكل الحقول متسقة.',
      suspiciousMsg: 'تم رصد تعارضات. يوصى بالمراجعة اليدوية.',
      genericMsg: 'تمت قراءة المستند واستخراج البيانات بنجاح.'
    }
  }[uiLang];

  const getVisibleFieldEntries = (extractedFields: any): Array<{ key: string; fieldValue: string; category: string; isLong: boolean }> => {
    if (!extractedFields || typeof extractedFields !== 'object') return [];
    return Object.entries(extractedFields)
      .map(([key, field]: [string, any]) => {
        const rawValue = typeof field === 'object' && field !== null ? field.value : field;
        const fieldValue = Array.isArray(rawValue)
          ? rawValue.join(', ').trim()
          : rawValue !== null && rawValue !== undefined
          ? String(rawValue).trim()
          : '';
        const isEmpty = !fieldValue || ['n/a', 'null', 'undefined', 'none', ''].includes(fieldValue.toLowerCase());
        if (isEmpty) return null;
        const category = (typeof field === 'object' && field?.category) || 'general';
        return { key, fieldValue, category, isLong: fieldValue.length > 60 };
      })
      .filter(Boolean) as Array<{ key: string; fieldValue: string; category: string; isLong: boolean }>;
  };

  const visibleFields = getVisibleFieldEntries(report?.extracted_fields);
  const visibleFieldCount = visibleFields.length;
  const insightsCount = (report?.document_specific_analysis?.insights?.length || 0) + (report?.document_specific_analysis?.recommendations?.length || 0);
  const entitiesCount = report?.detected_entities?.length || 0;
  const anomaliesCount = report?.anomalies?.length || 0;
  const status = report?.document_specific_analysis?.verification_status;
  const statusIsVerified = status === 'verified';
  const statusIsSuspicious = status === 'suspicious';
  const recentHistoryItems = history.reduce((acc: any[], item: any) => {
    const docType = (item?.report?.document_type || 'Document').toLowerCase();
    if (!acc.some((x) => (x?.report?.document_type || 'Document').toLowerCase() === docType)) {
      acc.push(item);
    }
    return acc;
  }, []).slice(0, 5);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto" dir={uiLang === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`rounded-2xl border ${theme.border} ${theme.bg} px-5 py-4 shadow-sm bg-gradient-to-br ${isDark ? 'from-slate-800 to-slate-900' : 'from-white to-slate-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={`text-xl font-semibold tracking-tight ${theme.text}`}>{copy.workspaceTitle}</h1>
            <p className={`text-xs ${theme.textMuted} mt-1`}>{copy.fileTypes}</p>
          </div>
          <div className={`flex items-center rounded-lg border ${theme.border} overflow-hidden`}>
            <button
              onClick={() => setUiLang('en')}
              className={`px-3 py-1.5 text-xs font-medium ${uiLang === 'en' ? 'bg-indigo-600 text-white' : `${theme.textMuted} ${theme.bg}`}`}
            >
              EN
            </button>
            <button
              onClick={() => setUiLang('ar')}
              className={`px-3 py-1.5 text-xs font-medium ${uiLang === 'ar' ? 'bg-indigo-600 text-white' : `${theme.textMuted} ${theme.bg}`}`}
            >
              AR
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-7 space-y-5">
          <div className={`${theme.bg} rounded-2xl border ${theme.border} shadow-sm overflow-hidden`}> 
            <div className={`px-5 py-3.5 border-b ${theme.borderSecondary} flex items-center justify-between`}>
              <h2 className={`text-sm font-semibold ${theme.text}`}>{copy.uploadTitle}</h2>
              {history.length > 0 && (
                <button onClick={clearHistory} className={`text-xs ${theme.textMuted} hover:text-red-500 transition-colors`}>
                  {copy.clearHistory}
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {history.length > 0 && !preview && (
                <div>
                  <p className={`text-xs ${theme.textMuted} mb-2`}>{copy.recentAnalyses}</p>
                  <div className="flex flex-wrap gap-2">
                    {recentHistoryItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setReport(item.report);
                          setActiveTab('fields');
                          onAuditSuccess?.(item.report);
                        }}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          isDark ? 'border-slate-600 text-slate-300 hover:border-indigo-500' : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        {item.report.document_type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!preview ? (
                <label className={`block cursor-pointer rounded-xl border-2 border-dashed transition-all ${
                  isDark ? 'border-slate-600 bg-slate-800/50 hover:border-indigo-500' : 'border-slate-200 bg-slate-50 hover:border-indigo-400'
                }`}>
                  <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                  <div className="h-72 flex flex-col items-center justify-center px-6 text-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isDark ? 'bg-slate-700' : 'bg-white'} shadow-sm`}>
                      <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className={`text-sm font-semibold ${theme.text}`}>{copy.dropFile}</p>
                    <p className={`text-xs ${theme.textMuted} mt-2`}>{copy.fileTypes}</p>
                  </div>
                </label>
              ) : (
                <div className="grid md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-8">
                    <div className={`relative rounded-xl overflow-hidden border ${theme.border} ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                      <img src={preview} alt="Preview" className="w-full h-[300px] object-contain" />
                      {loading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="text-white text-xs font-medium">{copy.analyzing}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-3">
                    <div className={`rounded-xl border ${theme.border} p-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      <p className={`text-xs ${theme.textMuted} mb-1`}>File</p>
                      <p className={`text-sm font-semibold ${theme.text} break-words`}>{file?.name}</p>
                      <p className={`text-xs ${theme.textMuted} mt-1`}>{file ? `${(file.size / 1024).toFixed(0)} KB` : ''}</p>
                    </div>

                    <label className="block">
                      <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                      <span className={`w-full inline-flex justify-center px-3 py-2 text-sm font-medium rounded-lg border cursor-pointer ${theme.border} ${theme.textSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
                        {copy.change}
                      </span>
                    </label>

                    <button
                      onClick={() => { setPreview(null); setFile(null); setReport(null); setError(null); }}
                      className={`w-full px-3 py-2 text-sm font-medium rounded-lg border ${theme.border} ${theme.textSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                    >
                      {copy.remove}
                    </button>

                    {!report && (
                      <button
                        onClick={runAudit}
                        disabled={loading}
                        className="w-full px-3 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? copy.analyzing : copy.analyze}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-100 text-red-600'}`}>
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs flex-1">{error}</p>
                  <button onClick={runAudit} className="text-xs font-bold underline underline-offset-2 shrink-0">{copy.tryAgain}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-5">
          <div className={`${theme.bg} rounded-2xl border ${theme.border} shadow-sm overflow-hidden`}>
            <div className={`px-5 py-3.5 border-b ${theme.borderSecondary} flex items-center justify-between`}>
              <h2 className={`text-sm font-semibold ${theme.text}`}>{copy.overviewTitle}</h2>
              {report && onExport && (
                <button
                  onClick={() => onExport(report)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}
                >
                  {copy.exportJson}
                </button>
              )}
            </div>

            <div className="p-5">
              {!report && !loading && !error && (
                <div className={`h-[300px] rounded-xl border ${theme.border} flex flex-col items-center justify-center text-center px-6 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                  <p className={`text-sm font-semibold ${theme.text}`}>{copy.noAnalysisYet}</p>
                  <p className={`text-xs mt-2 ${theme.textMuted}`}>{copy.noAnalysisHint}</p>
                </div>
              )}

              {loading && (
                <div className="h-[300px] flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                  <p className={`text-sm font-semibold ${theme.text}`}>{copy.aiBusyTitle}</p>
                  <p className={`text-xs ${theme.textMuted}`}>{copy.aiBusySub}</p>
                </div>
              )}

              {error && !loading && (
                <div className="h-[300px] flex flex-col items-center justify-center text-center gap-3">
                  <p className="text-sm font-semibold text-red-600">{copy.analysisFailed}</p>
                  <p className={`text-xs ${theme.textMuted}`}>{copy.analysisFailedHint}</p>
                  <button onClick={runAudit} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    {copy.tryAgain}
                  </button>
                </div>
              )}

              {report && !loading && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${statusIsVerified ? (isDark ? 'bg-green-900/20 border-green-700/40' : 'bg-green-50 border-green-200') : statusIsSuspicious ? (isDark ? 'bg-red-900/20 border-red-700/40' : 'bg-red-50 border-red-200') : (isDark ? 'bg-indigo-900/20 border-indigo-700/40' : 'bg-indigo-50 border-indigo-200')}`}>
                    <div className="flex items-start gap-3">
                      <div className={`${theme.accent}`}>{getDocumentIcon(report.document_type)}</div>
                      <div className="min-w-0">
                        <p className={`text-base font-semibold tracking-tight ${theme.text}`}>{report.document_type}</p>
                        {report.document_subtype && <p className={`text-xs ${theme.textMuted} mt-0.5`}>{report.document_subtype}</p>}
                        <p className={`text-xs mt-2 ${theme.textSecondary}`}>{statusIsVerified ? copy.verifiedMsg : statusIsSuspicious ? copy.suspiciousMsg : copy.genericMsg}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className={`rounded-xl p-3 border ${theme.border} ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                      <p className={`text-xs uppercase tracking-wide ${theme.textMuted}`}>{copy.fieldsRead}</p>
                      <p className={`text-xl font-bold ${theme.text} mt-1`}>{visibleFieldCount}</p>
                    </div>
                    <div className={`rounded-xl p-3 border ${theme.border} ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                      <p className={`text-xs uppercase tracking-wide ${theme.textMuted}`}>{copy.anomalies}</p>
                      <p className={`text-xl font-bold mt-1 ${anomaliesCount === 0 ? theme.success : theme.error}`}>{anomaliesCount === 0 ? copy.anomaliesClean : anomaliesCount}</p>
                    </div>
                    <div className={`rounded-xl p-3 border ${theme.border} ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                      <p className={`text-xs uppercase tracking-wide ${theme.textMuted}`}>{copy.entities}</p>
                      <p className={`text-xl font-bold mt-1 ${theme.text}`}>{entitiesCount}</p>
                    </div>
                  </div>

                  {report.summary && (
                    <div className={`rounded-xl p-3.5 border ${theme.border} ${isDark ? 'bg-slate-800/40' : 'bg-white'}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>{copy.aiSummary}</p>
                      <p className={`text-sm ${theme.textSecondary} leading-relaxed`}>{report.summary}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {report && (
        <div className={`${theme.bg} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
          <div className={`p-3 border-b ${theme.borderSecondary}`}>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'fields', label: copy.extractedFields, count: visibleFieldCount },
                { key: 'insights', label: copy.insights, count: insightsCount },
                { key: 'entities', label: copy.entities, count: entitiesCount },
                { key: 'anomalies', label: copy.anomalies, count: anomaliesCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    activeTab === tab.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200/40'
                      : isDark
                      ? 'border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-white'
                      : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'fields' && (
              (() => {
                const grouped = visibleFields.reduce((acc: any, item: any) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {});

                const categoryLabels: Record<string, string> = {
                  personal_info: 'Personal Information',
                  contact_info: 'Contact Details',
                  location: 'Location',
                  social_media: 'Social Profiles',
                  experience: 'Experience',
                  education: 'Education',
                  technical_skills: 'Technical Skills',
                  skills: 'Skills',
                  summary: 'Summary',
                  portfolio: 'Portfolio',
                  projects: 'Projects',
                  certifications: 'Certifications',
                  languages: 'Languages',
                  general: 'General Information'
                };

                const categoryOrder = ['personal_info', 'contact_info', 'location', 'social_media', 'experience', 'education', 'technical_skills', 'skills', 'summary', 'portfolio', 'projects', 'certifications', 'languages', 'general'];
                const knownCats = categoryOrder.filter((cat) => grouped[cat]?.length > 0);
                const unknownCats = Object.keys(grouped).filter((cat) => !categoryOrder.includes(cat));
                const activeCats = [...knownCats, ...unknownCats];

                return (
                  <div className="columns-1 md:columns-2 xl:columns-3 gap-4 [column-fill:_balance]">
                    {activeCats.map((category) => {
                      const catFields = grouped[category] || [];
                      if (catFields.length === 0) return null;
                      return (
                        <article
                          key={category}
                          className={`mb-4 break-inside-avoid rounded-xl border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm hover:shadow-md transition-shadow`}
                        >
                          <header className={`px-4 py-2.5 border-b ${isDark ? 'bg-slate-700/60 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                            <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                              {categoryLabels[category] || category.replace(/_/g, ' ')}
                            </p>
                          </header>
                          <div className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                            {catFields.map((f: any) => (
                              <div key={f.key} className="px-4 py-3">
                                <p className={`text-[11px] font-medium uppercase tracking-wide ${theme.textMuted}`}>{f.key.replace(/_/g, ' ')}</p>
                                <p className={`text-sm font-semibold mt-1 leading-relaxed ${theme.text}`}>{f.fieldValue}</p>
                              </div>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })()
            )}

            {activeTab === 'insights' && (
              <div className="grid md:grid-cols-2 gap-5">
                <div className={`rounded-xl border ${theme.border} p-4 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${theme.accent}`}>{copy.insights}</p>
                  {report.document_specific_analysis?.insights?.length > 0 ? (
                    <ul className="space-y-2.5">
                      {report.document_specific_analysis.insights.map((insight: string, i: number) => (
                        <li key={i} className={`text-sm leading-relaxed ${theme.textSecondary}`}>{insight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={`text-sm ${theme.textMuted}`}>{copy.noInsights}</p>
                  )}
                </div>

                <div className={`rounded-xl border ${theme.border} p-4 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${theme.success}`}>{copy.recommendations}</p>
                  {report.document_specific_analysis?.recommendations?.length > 0 ? (
                    <ul className="space-y-2.5">
                      {report.document_specific_analysis.recommendations.map((rec: string, i: number) => (
                        <li key={i} className={`text-sm leading-relaxed ${theme.textSecondary}`}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className={`text-sm ${theme.textMuted}`}>{copy.noInsights}</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'entities' && (
              <div>
                {report.detected_entities?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {report.detected_entities.map((entity: string, i: number) => (
                      <span key={i} className={`px-3 py-1.5 text-xs rounded-lg font-medium border ${theme.border} ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-50 text-slate-700'}`}>
                        {entity}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>{copy.noEntities}</p>
                )}
              </div>
            )}

            {activeTab === 'anomalies' && (
              <div>
                {report.anomalies?.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {report.anomalies.map((anomaly: any, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border ${
                        anomaly.severity === 'high'
                          ? isDark ? 'bg-red-900/20 border-red-800/40' : 'bg-red-50 border-red-100'
                          : anomaly.severity === 'medium'
                          ? isDark ? 'bg-amber-900/20 border-amber-800/40' : 'bg-amber-50 border-amber-100'
                          : `${theme.bgSecondary} ${theme.border}`
                      }`}>
                        <p className={`text-xs uppercase font-semibold mb-1 ${anomaly.severity === 'high' ? theme.error : anomaly.severity === 'medium' ? theme.warning : theme.textMuted}`}>
                          {anomaly.severity}
                        </p>
                        <p className={`text-sm ${theme.textSecondary}`}>{anomaly.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>{copy.noAnomalies}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
