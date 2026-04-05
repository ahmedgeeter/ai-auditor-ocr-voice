import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Command, Radio, AlertTriangle, Clock } from 'lucide-react';
import JellyOrb from './JellyOrb';
import { getIntelligentResponse, transcribeAudio } from '../../lib/groq';

interface VoiceProps {
    context?: string;
    onVoiceSuccess: (input: string, output: string) => void;
}

const Voice = ({ context, onVoiceSuccess }: VoiceProps) => {
    const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);
    const [debugInfo, setDebugInfo] = useState<string>('');
    
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerInterval = useRef<any>(null);
    const startTimeRef = useRef<number>(0);

    const resetToIdle = useCallback((errorMsg?: string) => {
        if (errorMsg) setError(errorMsg);
        setState('idle');
        setTimer(0);
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
        }
    }, []);

    const startRecording = async () => {
        if (state !== 'idle') return;
        
        setError(null);
        setTranscript('');
        setResponse('');
        audioChunks.current = [];
        setTimer(0);
        startTimeRef.current = Date.now();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/wav'];
            const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
            
            setDebugInfo(mimeType.split('/')[1].toUpperCase());
            mediaRecorder.current = new MediaRecorder(stream, { mimeType });
            
            mediaRecorder.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                const duration = (Date.now() - startTimeRef.current) / 1000;
                const finalBlob = new Blob(audioChunks.current, { type: mimeType });
                const sizeKB = Math.round(finalBlob.size / 1024);
                
                setDebugInfo(prev => `${prev.split(' | ')[0]} | ${sizeKB}KB`);
                
                if (finalBlob.size < 1000 || duration < 0.1) { 
                    resetToIdle(`No audio (${sizeKB}KB)`);
                } else {
                    handleAudioSequence(finalBlob);
                }
            };

            mediaRecorder.current.start(100);
            setState('recording');
            
            timerInterval.current = setInterval(() => {
                setTimer(prev => +(prev + 0.1).toFixed(1));
            }, 100);

        } catch (err: any) { 
            resetToIdle(err.message === 'Permission denied' ? 'Mic access denied.' : 'Mic unavailable.');
        }
    };

    const stopRecording = () => {
        if (state !== 'recording') return;
        
        setState('transcribing');
        if (timerInterval.current) clearInterval(timerInterval.current);
        
        if (mediaRecorder.current) {
            mediaRecorder.current.requestData();
            setTimeout(() => {
                if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
                    mediaRecorder.current.stop();
                    mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
                }
            }, 300);
        }
    };

    const handleAudioSequence = async (blob: Blob) => {
        try {
            const text = await transcribeAudio(blob);
            if (!text || text.trim().length < 2) throw new Error('Unintelligible audio.');
            setTranscript(text);
            
            setState('thinking');
            const aiResponse = await getIntelligentResponse(text, context);
            setResponse(aiResponse);
            
            setState('speaking');
            onVoiceSuccess(text, aiResponse);
            setTimeout(() => setState('idle'), 6000);
        } catch (err: any) { 
            resetToIdle(err.message.includes('400') ? 'Response rejected by AI' : 'Voice processing failed');
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && state === 'idle') {
                e.preventDefault();
                startRecording();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && state === 'recording') stopRecording();
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (timerInterval.current) clearInterval(timerInterval.current);
        };
    }, [state, startRecording, stopRecording]);

    return (
        <div className="max-w-6xl mx-auto py-4">
            <div className="grid lg:grid-cols-12 gap-12 items-start">
                <div className="lg:col-span-5 flex flex-col gap-8 bg-[var(--color-surface)] border border-[var(--color-divider)] p-10 rounded-2xl shadow-[var(--shadow-lg)] relative">
                    <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-2">
                            <Radio size={12} className="text-[var(--color-primary)]" />
                            <span>{debugInfo || 'Voice session'}</span>
                        </div>
                        {state === 'recording' && (
                            <div className="flex items-center gap-2 text-[var(--color-primary)]">
                                <Clock size={12} />
                                <span>{timer}s</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-8">
                        <JellyOrb state={state} />
                        <div className="relative">
                            <motion.button
                                whileHover={state === 'idle' ? { scale: 1.03 } : {}}
                                whileTap={state === 'idle' ? { scale: 0.98 } : {}}
                                transition={{ type: 'spring', damping: 18 }}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecording}
                                disabled={state !== 'idle' && state !== 'recording'}
                                className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-[var(--shadow-md)] relative ${
                                    state === 'recording' ? 'bg-red-500 text-white' :
                                    state === 'idle' ? 'bg-[var(--color-primary)] text-white cursor-pointer' :
                                    'bg-gray-500/20 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {state === 'recording' ? <MicOff size={36} /> : <Mic size={36} />}
                            </motion.button>

                            <AnimatePresence>
                                {error && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 text-red-500 whitespace-nowrap bg-white px-4 py-2 rounded-full border border-red-500/30 shadow-[var(--shadow-sm)]">
                                        <AlertTriangle size={12} />
                                        <span className="text-[10px] font-semibold uppercase tracking-widest">{error}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${state !== 'idle' ? 'bg-[var(--color-primary)] animate-pulse' : 'bg-[var(--color-primary)] opacity-40'}`} />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--color-text)]">
                                    {state === 'recording' ? 'Recording' : state === 'transcribing' ? 'Transcribing' : state === 'thinking' ? 'Analyzing' : state === 'speaking' ? 'Responding' : 'Ready'}
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Hold to record. Release to send.</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-8">
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-divider)] p-10 rounded-2xl shadow-[var(--shadow-md)] relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                            <Activity size={14} className="text-[var(--color-primary)]" />
                            Transcript
                        </div>
                        <p className="font-serif text-2xl italic leading-relaxed text-[var(--color-text)] min-h-[100px]">
                            {transcript || <span className="opacity-20 text-2xl">Start speaking to generate a transcript.</span>}
                        </p>
                    </div>

                    <div className="bg-[var(--color-surface)] border border-[var(--color-divider)] p-10 rounded-2xl shadow-[var(--shadow-lg)] flex flex-col min-h-[300px]">
                        <div className="flex items-center justify-between mb-8 border-b border-[var(--color-divider)] pb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                            <div className="flex items-center gap-3">
                                <Command size={14} className="text-[var(--color-primary)]" />
                                AI Insights
                            </div>
                            <div className="text-[10px] font-mono lowercase opacity-50">llama.v4.scout</div>
                        </div>
                        
                        <div className="font-sans text-lg font-semibold leading-relaxed text-[var(--color-text)] tracking-tight">
                            {response ? (
                                <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>{response}</motion.p>
                            ) : (
                                <div className="space-y-4 opacity-10">
                                    <div className="h-4 w-full bg-current rounded-sm" />
                                    <div className="h-4 w-5/6 bg-current rounded-sm" />
                                </div>
                            )}
                        </div>

                        <div className="mt-auto pt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                             <div className="flex items-center gap-4">
                                <span>Secure</span>
                                <span>Context-aware</span>
                             </div>
                             <span>Response ready</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Voice;
