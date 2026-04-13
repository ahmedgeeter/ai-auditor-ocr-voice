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
      
      // Remove any markdown code block remnants
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');

      const parsed = JSON.parse(content);
      setReport(parsed);
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

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Upload Section */}
      <div className={`${theme.bg} rounded-xl shadow-sm border ${theme.border} overflow-hidden`}>
        <div className={`p-4 border-b ${theme.borderSecondary} flex items-center justify-between`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>Document Upload</h2>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className={`text-xs ${theme.textMuted} hover:${theme.text} transition-colors`}
            >
              Clear History ({history.length})
            </button>
          )}
        </div>
        <div className="p-6">
          {/* History */}
          {history.length > 0 && !preview && (
            <div className="mb-4">
              <p className={`text-xs ${theme.textMuted} mb-2`}>Recent Analyses</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setReport(item.report)}
                    className={`w-full text-left p-2 rounded-lg ${theme.bgSecondary} hover:opacity-80 transition-opacity`}
                  >
                    <p className={`text-xs font-medium ${theme.text}`}>{item.report.document_type}</p>
                    <p className={`text-xs ${theme.textMuted}`}>
                      {new Date(item.date).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!preview ? (
            <label className={`flex flex-col items-center justify-center h-64 cursor-pointer ${theme.bgSecondary} hover:opacity-90 transition-all rounded-xl border-2 border-dashed ${theme.border}`}>
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
              <div className={`w-16 h-16 ${isDark ? 'bg-slate-600' : 'bg-slate-200'} rounded-full flex items-center justify-center mb-4`}>
                <svg className={`w-8 h-8 ${theme.textMuted}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className={`text-sm font-medium ${theme.text}`}>Drop file or click to browse</p>
              <p className={`text-xs ${theme.textMuted} mt-1`}>PDF, JPG, PNG, ID, Invoice, CV, etc.</p>
            </label>
          ) : (
            <div className="space-y-4">
              <div className={`relative aspect-[3/4] ${theme.bgSecondary} rounded-lg overflow-hidden`}>
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setPreview(null); setFile(null); setReport(null); }}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${theme.textSecondary} ${theme.bgSecondary} rounded-lg hover:opacity-80 transition-colors`}
                >
                  Remove
                </button>
                {!report && (
                  <button
                    onClick={runAudit}
                    disabled={loading}
                    className={`flex-1 px-4 py-2.5 text-sm font-medium text-white ${theme.accentBg} rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        AI Analyzing...
                      </span>
                    ) : 'Analyze with AI'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className={`${theme.bg} rounded-xl shadow-sm border ${theme.border} overflow-hidden`}>
        <div className={`p-4 border-b ${theme.borderSecondary} flex items-center justify-between`}>
          <h2 className={`text-sm font-semibold ${theme.text}`}>AI Analysis Results</h2>
          {report && onExport && (
            <button
              onClick={() => onExport(report)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${theme.accentBg} text-white rounded-lg hover:opacity-90 transition-opacity`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export JSON
            </button>
          )}
        </div>
        <div className="p-6 max-h-[600px] overflow-y-auto">
          {!report && !loading && !error && (
            <div className={`h-80 flex flex-col items-center justify-center ${theme.textMuted}`}>
              <div className={`w-12 h-12 ${theme.bgSecondary} rounded-full flex items-center justify-center mb-3`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm">Upload any document for intelligent analysis</p>
              <p className={`text-xs mt-2 opacity-70`}>The AI will auto-detect document type and extract all relevant fields</p>
            </div>
          )}

          {loading && (
            <div className={`h-80 flex flex-col items-center justify-center ${theme.textSecondary}`}>
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-sm">AI is analyzing document...</p>
              <p className={`text-xs mt-2 ${theme.textMuted}`}>Detecting type, extracting fields, verifying content</p>
            </div>
          )}

          {error && (
            <div className="h-80 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className={`text-sm ${theme.error} mb-3`}>{error}</p>
              <button onClick={runAudit} className={`text-sm ${theme.accent} hover:opacity-80 font-medium`}>
                Try again
              </button>
            </div>
          )}

          {report && (
            <div className="space-y-6">
              {/* Document Type & Confidence */}
              <div className={`flex items-center justify-between pb-4 border-b ${theme.borderSecondary}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${theme.bgSecondary} ${theme.accent}`}>
                    {getDocumentIcon(report.document_type)}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide`}>Detected Type</p>
                    <div className="flex items-center gap-2 mt-1">
                      <h3 className={`text-lg font-semibold ${theme.text}`}>{report.document_type}</h3>
                      {report.document_subtype && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${theme.bgSecondary} ${theme.textSecondary}`}>
                          {report.document_subtype}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide`}>AI Confidence</p>
                  <p className={`text-2xl font-bold ${(report.confidence || 0) > 0.8 ? theme.success : theme.warning} mt-0.5`}>
                    {((report.confidence || 0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Verification Status */}
              {report.document_specific_analysis?.verification_status && (
                <div className={`p-3 rounded-lg ${
                  report.document_specific_analysis.verification_status === 'verified' 
                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
                    : report.document_specific_analysis.verification_status === 'suspicious'
                    ? isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
                    : theme.bgSecondary
                }`}>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {report.document_specific_analysis.verification_status === 'verified' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      ) : report.document_specific_analysis.verification_status === 'suspicious' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      )}
                    </svg>
                    <span className="text-sm font-medium capitalize">
                      Status: {report.document_specific_analysis.verification_status}
                    </span>
                  </div>
                </div>
              )}

              {/* Extracted Fields - Dynamic & Grouped */}
              {report.extracted_fields && typeof report.extracted_fields === 'object' && Object.keys(report.extracted_fields).length > 0 && (
                <div>
                  <p className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-4`}>
                    Extracted Information
                  </p>
                  
                  {/* Group fields by category */}
                  {(() => {
                    const fields = Object.entries(report.extracted_fields);
                    const grouped = fields.reduce((acc: any, [key, field]: [string, any]) => {
                      const category = (typeof field === 'object' && field?.category) || 'general';
                      if (!acc[category]) acc[category] = [];
                      acc[category].push({ key, field });
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
                      summary: 'Summary',
                      portfolio: 'Portfolio',
                      general: 'General Information'
                    };
                    
                    const categoryOrder = ['personal_info', 'contact_info', 'location', 'social_media', 'experience', 'education', 'technical_skills', 'summary', 'portfolio', 'general'];
                    
                    return categoryOrder
                      .filter(cat => grouped[cat] && grouped[cat].length > 0)
                      .map(category => (
                        <div key={category} className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                          <p className={`text-xs font-semibold ${theme.accent} uppercase tracking-wide mb-3 flex items-center gap-2`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`}></span>
                            {categoryLabels[category] || category.replace(/_/g, ' ')}
                          </p>
                          <div className="space-y-3">
                            {grouped[category].map(({ key, field }: { key: string, field: any }) => {
                              const fieldValue = typeof field === 'object' && field !== null ? (field.value || '') : String(field || '');
                              const fieldConfidence = typeof field === 'object' && field !== null ? (field.confidence || 0.5) : 0.5;
                              
                              return (
                                <div key={key} className="group">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs ${theme.textMuted} capitalize`}>
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-16 h-1.5 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-200'} overflow-hidden`}>
                                        <div 
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            fieldConfidence > 0.8 ? 'bg-green-500' : 
                                            fieldConfidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${fieldConfidence * 100}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-medium ${
                                        fieldConfidence > 0.8 ? theme.success : 
                                        fieldConfidence > 0.5 ? theme.warning : theme.error
                                      }`}>
                                        {(fieldConfidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  <p className={`text-sm ${theme.text} font-medium break-words leading-relaxed`}>
                                    {fieldValue}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              )}

              {/* Detected Entities */}
              {report.detected_entities && report.detected_entities.length > 0 && (
                <div className={`pt-4 border-t ${theme.borderSecondary}`}>
                  <p className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-2`}>
                    Key Entities Detected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.detected_entities.map((entity: string, i: number) => (
                      <span 
                        key={i} 
                        className={`px-2 py-1 text-xs rounded-md ${theme.bgSecondary} ${theme.textSecondary}`}
                      >
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {report.document_specific_analysis?.insights && (
                <div className={`pt-4 border-t ${theme.borderSecondary}`}>
                  <p className={`text-xs font-medium ${theme.accent} uppercase tracking-wide mb-2`}>
                    AI Insights
                  </p>
                  <ul className="space-y-1">
                    {report.document_specific_analysis.insights.map((insight: string, i: number) => (
                      <li key={i} className={`text-sm ${theme.textSecondary} flex items-start gap-2`}>
                        <span className={`${theme.accent} mt-1`}>•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {report.document_specific_analysis?.recommendations && (
                <div className={`pt-4 border-t ${theme.borderSecondary}`}>
                  <p className={`text-xs font-medium ${theme.success} uppercase tracking-wide mb-2`}>
                    AI Recommendations
                  </p>
                  <ul className="space-y-1">
                    {report.document_specific_analysis.recommendations.map((rec: string, i: number) => (
                      <li key={i} className={`text-sm ${theme.textSecondary} flex items-start gap-2`}>
                        <svg className={`w-4 h-4 ${theme.success} mt-0.5 shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Anomalies */}
              {report.anomalies && report.anomalies.length > 0 && (
                <div className={`pt-4 border-t ${theme.borderSecondary}`}>
                  <p className={`text-xs font-medium ${theme.error} uppercase tracking-wide mb-2`}>
                    Anomalies Detected
                  </p>
                  <div className="space-y-2">
                    {report.anomalies.map((anomaly: any, i: number) => (
                      <div 
                        key={i} 
                        className={`p-2 rounded-lg ${
                          anomaly.severity === 'high' 
                            ? isDark ? 'bg-red-900/30' : 'bg-red-50'
                            : anomaly.severity === 'medium'
                            ? isDark ? 'bg-amber-900/30' : 'bg-amber-50'
                            : theme.bgSecondary
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase ${
                            anomaly.severity === 'high' ? theme.error :
                            anomaly.severity === 'medium' ? theme.warning :
                            theme.textMuted
                          }`}>
                            {anomaly.severity}
                          </span>
                          <span className={`text-sm ${theme.text}`}>{anomaly.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {report.summary && (
                <div className={`pt-4 border-t ${theme.borderSecondary}`}>
                  <p className={`text-xs font-medium ${theme.textMuted} uppercase tracking-wide mb-2`}>Summary</p>
                  <p className={`text-sm ${theme.textSecondary} leading-relaxed italic`}>{report.summary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
