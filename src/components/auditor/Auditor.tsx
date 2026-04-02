import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, FileText, ShieldAlert, Cpu, Layers, Activity, ChevronRight } from 'lucide-react';
import { auditDocument } from '../../lib/groq';
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const Auditor = () => {
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
        } catch (err: any) {
            setError(err?.message || 'Neural connection lost.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-4 border-l-2 border-[var(--color-primary)] pl-8">
                <div className="flex items-center gap-4">
                   <span className="text-[10px] font-mono font-bold uppercase tracking-[0.6em] text-[var(--color-primary)]">Neural_Core_v4.2</span>
                   <div className="h-px w-24 bg-[var(--color-divider)]" />
                </div>
                <h1 className="text-6xl font-serif font-bold text-[var(--color-text)] tracking-tight">Technical Auditor</h1>
                <p className="max-w-2xl text-sm text-[var(--color-text-muted)] leading-relaxed font-medium">
                    High-fidelity autonomous extraction hub. Engineered for corporate-level compliance and industrial documentation analysis.
                </p>
            </div>

            <div className="grid lg:grid-cols-12 gap-12 items-start mt-8">
                {/* Left Panel */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="relative aspect-[3/4] border border-[var(--color-divider)] rounded-sm overflow-hidden bg-[var(--color-surface-offset)] shadow-2xl neon-glow scanline">
                        <div className="absolute inset-0 z-0 bg-dot-grid opacity-10" />
                        {!preview ? (
                            <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group">
                                <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,application/pdf" />
                                <div className="w-16 h-16 rounded-full border border-[var(--color-divider)] flex items-center justify-center group-hover:border-[var(--color-primary)] transition-all">
                                    <FileText className="opacity-20 group-hover:opacity-100 group-hover:text-[var(--color-primary)] transition-all" size={24} />
                                </div>
                                <span className="mt-6 text-[10px] font-bold uppercase tracking-[0.4em] opacity-40">Load Input Segment</span>
                            </label>
                        ) : (
                            <div className="absolute inset-0 p-4 flex flex-col">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <span className="text-[9px] font-mono font-bold uppercase opacity-30 tracking-widest">Buffer_Active</span>
                                    <button onClick={() => setPreview(null)} className="text-[9px] font-bold uppercase tracking-widest hover:text-[var(--color-error)] transition-colors text-[var(--color-text-muted)]">Unload</button>
                                </div>
                                <div className="flex-1 rounded-sm overflow-hidden border border-[var(--color-divider)] bg-black/5 flex items-center justify-center relative">
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
                            <span>{loading ? 'Analyzing Neural Weights...' : 'Execute Audit Sequence'}</span>
                        </motion.button>
                    )}
                </div>

                {/* Right Panel */}
                <div className="lg:col-span-7 bg-[var(--color-surface)] border border-[var(--color-divider)] rounded-sm min-h-[700px] relative overflow-hidden shadow-2xl neon-glow jelly-float flex flex-col p-16 scanline">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-dot-grid bg-[size:40px_40px]" />
                    
                    {!report && !loading && !error && (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                            <Layers size={48} strokeWidth={1} className="mb-6" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.6em]">Terminal Idle</span>
                        </div>
                    )}

                    {error && (
                        <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                            <div className="w-16 h-16 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center text-[var(--color-error)] mb-8 neon-glow border-[var(--color-error)]/20 shadow-red-500/10">
                                <ShieldAlert size={28} />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-[0.4em] text-[var(--color-error)] mb-2">Engine Alert</span>
                            <p className="text-xs text-[var(--color-text-muted)] font-medium italic">{error}</p>
                            <button onClick={runAudit} className="mt-10 text-[10px] font-bold uppercase tracking-widest underline hover:text-[var(--color-primary)]">Retry Connection</button>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-14 relative z-10">
                            <div className="flex justify-between items-end border-b border-[var(--color-divider)] pb-8">
                                <div className="flex flex-col gap-2">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary)] animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--color-primary)]">Verified Entry_v1.0</span>
                                     </div>
                                     <h3 className="text-4xl font-serif font-bold text-[var(--color-text)] tracking-tight">{report.document_type}</h3>
                                </div>
                                <div className="text-right">
                                    <div className="text-[11px] font-mono font-bold opacity-30 uppercase tracking-widest mb-1">Conf_Score</div>
                                    <div className="text-4xl font-mono font-black text-[var(--color-primary)]">{(report.confidence * 100).toFixed(0)}%</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-12 gap-y-10 border-b border-[var(--color-divider)] pb-12">
                                {Object.entries(report.extracted_fields || {}).map(([key, val]) => (
                                    <div key={key} className="flex flex-col gap-2 group transition-all hover:translate-x-1">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-text-muted)] opacity-60 group-hover:opacity-100 group-hover:text-[var(--color-primary)]">{key.replace('_', ' ')}</span>
                                        <span className="text-base font-semibold text-[var(--color-text)]">{val as string}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                   <ChevronRight size={14} className="text-[var(--color-warning)]" />
                                   <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--color-warning)]">Security_Observations</span>
                                </div>
                                <p className="text-sm italic text-[var(--color-text-muted)] leading-relaxed font-semibold pl-6 border-l border-[var(--color-warning)]/20">
                                    {report.summary || 'No critical anomalies detected in the input stream buffer.'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    <div className="mt-auto pt-16 flex items-center justify-between opacity-30 text-[9px] font-mono font-bold uppercase tracking-[0.2em]">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500" /> API_OK</span>
                            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-green-500" /> NEURAL_LOAD_BALANCED</span>
                        </div>
                        <div>LATENCY: {latency}MS</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Auditor;
