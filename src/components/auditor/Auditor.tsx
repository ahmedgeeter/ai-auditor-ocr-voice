import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, FileText, ShieldAlert, Cpu, Layers, ChevronRight } from 'lucide-react';
import { auditDocument } from '../../lib/groq';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface AuditorProps {
    language?: 'en' | 'ar';
    onAuditSuccess: (report: any) => void;
}

const Auditor = ({ onAuditSuccess, language = 'en' }: AuditorProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [latency, setLatency] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setReport(null);
            setError(null);
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
            const reader = new FileReader();
            const rawBase64 = await new Promise<string>((resolve) => {
                reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
                reader.readAsDataURL(file);
            });
            const imageBase64 = await resizeImage(rawBase64);
            const result = await auditDocument(imageBase64);
            const parsed = JSON.parse(result.content);
            setReport(parsed);
            setLatency(result.latency);
            onAuditSuccess(parsed);
        } catch (err: any) {
            setError(err?.message || 'Neural connection lost.');
        } finally {
            setLoading(false);
        }
    };

    const labels = language === 'ar'
        ? {
            badge: 'مدقق المستندات',
            title: 'ارفع مستند المرشح وراجع النتائج بسرعة.',
            subtitle: 'استخرج الحقول الأساسية، تحقق من نسب الثقة، واحصل على ملاحظات المطابقة لتسريع قرار التوظيف.',
            upload: 'ارفع المستند',
            preview: 'المعاينة جاهزة',
            remove: 'حذف',
            run: 'تشغيل التدقيق',
            processing: 'جاري المعالجة...',
            awaiting: 'في انتظار مستند',
            issue: 'مشكلة في المعالجة',
            retry: 'إعادة المحاولة',
            summary: 'ملخص التدقيق',
            confidence: 'الثقة',
            notes: 'ملاحظات المطابقة',
            fallback: 'لا توجد ملاحظات حرجة في المستند.'
        }
        : {
            badge: 'Document Auditor',
            title: 'Upload and review candidate documents.',
            subtitle: 'Extract key fields, validate confidence scores, and surface compliance notes for faster recruiter decisions.',
            upload: 'Upload document',
            preview: 'Preview ready',
            remove: 'Remove',
            run: 'Run audit',
            processing: 'Processing document...',
            awaiting: 'Awaiting document',
            issue: 'Processing issue',
            retry: 'Retry audit',
            summary: 'Audit summary',
            confidence: 'Confidence',
            notes: 'Compliance notes',
            fallback: 'No critical anomalies detected in the input stream buffer.'
        };

    const isRtl = language === 'ar';

    return (
        <div className="flex flex-col gap-10">
            <div className={`flex flex-col gap-4 ${isRtl ? 'border-r-2 pr-5' : 'border-l-2 pl-5'} border-[var(--color-primary)] fade-up`}>
                <div className="flex items-center gap-4">
                   <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[var(--color-primary)]">{labels.badge}</span>
                   <div className="h-px w-20 bg-[var(--color-divider)]" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--color-text)] tracking-tight">{labels.title}</h2>
                <p className="max-w-2xl text-[13px] sm:text-[15px] text-[var(--color-text-muted)] leading-relaxed font-medium">
                    {labels.subtitle}
                </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start mt-6">
                <div className="lg:col-span-5 flex flex-col gap-5 fade-up">
                    <div className="relative aspect-[3/4] border border-[var(--color-divider)] rounded-3xl overflow-hidden bg-[var(--color-surface-2)] shadow-[var(--shadow-md)]">
                        <div className="absolute inset-0 z-0 bg-dot-grid opacity-10" />
                        {!preview ? (
                            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group">
                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                                <div className="w-16 h-16 rounded-2xl border border-[var(--color-divider)] flex items-center justify-center group-hover:border-[var(--color-primary)] transition-all bg-white shadow-[var(--shadow-sm)]">
                                    <FileText className="opacity-40 group-hover:opacity-100 group-hover:text-[var(--color-primary)] transition-all" size={24} />
                                </div>
                                <span className="mt-6 text-[10px] font-semibold uppercase tracking-[0.3em] opacity-50">{labels.upload}</span>
                                <span className="mt-3 text-[12px] text-[var(--color-text-muted)]">PDF, JPG, PNG</span>
                            </label>
                        ) : (
                            <div className="absolute inset-0 p-4 flex flex-col">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <span className="text-[9px] font-mono font-semibold uppercase opacity-40 tracking-widest">{labels.preview}</span>
                                    <button onClick={() => setPreview(null)} className="text-[9px] font-semibold uppercase tracking-widest hover:text-[var(--color-error)] transition-colors text-[var(--color-text-muted)]">{labels.remove}</button>
                                </div>
                                <div className="flex-1 rounded-xl overflow-hidden border border-[var(--color-divider)] bg-white flex items-center justify-center relative">
                                    <img src={preview} className="max-w-full max-h-full object-contain" />
                                </div>
                            </div>
                        )}
                    </div>
                    {preview && !report && (
                        <motion.button 
                            whileTap={{ scale: 0.98 }}
                            onClick={runAudit}
                            disabled={loading}
                            className="btn-accent"
                        >
                            {loading ? <Cpu className="animate-spin" size={14} /> : <Scan size={14} />}
                            <span>{loading ? labels.processing : labels.run}</span>
                        </motion.button>
                    )}
                </div>

                <div className="lg:col-span-7 glass-card border border-[var(--color-divider)] rounded-3xl min-h-[620px] relative overflow-hidden shadow-[var(--shadow-lg)] flex flex-col p-8 sm:p-10 fade-up">
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-dot-grid bg-[size:40px_40px]" />
                    
                    {!report && !loading && !error && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                            <Layers size={48} strokeWidth={1} className="mb-6" />
                            <span className="text-[10px] font-semibold uppercase tracking-[0.4em]">{labels.awaiting}</span>
                        </div>
                    )}

                    {error && (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                            <div className="w-16 h-16 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center text-[var(--color-error)] mb-8 border border-[var(--color-error)]/20">
                                <ShieldAlert size={28} />
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-error)] mb-2">{labels.issue}</span>
                            <p className="text-xs text-[var(--color-text-muted)] font-medium italic">{error}</p>
                            <button onClick={runAudit} className="mt-10 text-[9px] font-semibold uppercase tracking-widest underline hover:text-[var(--color-primary)]">{labels.retry}</button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col gap-12 w-full relative z-10">
                             <div className="flex justify-between items-end border-b border-[var(--color-divider)] pb-6">
                                <div className="flex flex-col gap-4">
                                     <div className="h-2 w-32 bg-[var(--color-divider)] rounded-full animate-pulse" />
                                     <div className="h-10 w-64 bg-[var(--color-divider)] rounded-full animate-pulse" />
                                </div>
                                <div className="h-12 w-20 bg-[var(--color-divider)] rounded-full animate-pulse" />
                             </div>
                             <div className="grid grid-cols-2 gap-8">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="space-y-3">
                                        <div className="h-2 w-20 bg-[var(--color-divider)] rounded-full opacity-40" />
                                        <div className="h-4 w-full bg-[var(--color-divider)] rounded-sm" />
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {report && !loading && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-12 relative z-10">
                            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-b border-[var(--color-divider)] pb-6">
                                <div className="flex flex-col gap-2">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[var(--color-primary)]">{labels.summary}</span>
                                     </div>
                                     <h3 className="text-3xl font-serif font-bold text-[var(--color-text)] tracking-tight">{report.document_type}</h3>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-mono font-semibold opacity-40 uppercase tracking-widest mb-1">{labels.confidence}</div>
                                    <div className="text-3xl font-mono font-bold text-[var(--color-primary)]">{(report.confidence * 100).toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8 border-b border-[var(--color-divider)] pb-10">
                                {Object.entries(report.extracted_fields || {}).map(([key, val]) => (
                                    <div key={key} className="flex flex-col gap-2 group transition-all hover:translate-x-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)] opacity-70 group-hover:opacity-100 group-hover:text-[var(--color-primary)]">{key.replace('_', ' ')}</span>
                                        <span className="text-[15px] font-semibold text-[var(--color-text)]">{val as string}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                   <ChevronRight size={14} className="text-[var(--color-warning)]" />
                                   <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-warning)]">{labels.notes}</span>
                                </div>
                                <p className={`text-[13px] italic text-[var(--color-text-muted)] leading-relaxed font-semibold ${isRtl ? 'pr-6 border-r' : 'pl-6 border-l'} border-[var(--color-warning)]/20`}>
                                    {report.summary || labels.fallback}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    <div className="mt-auto pt-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 opacity-40 text-[9px] font-mono font-semibold uppercase tracking-[0.2em]">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500" /> API ready</span>
                            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500" /> pipeline stable</span>
                        </div>
                        <div>LATENCY: {latency}MS</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auditor;
