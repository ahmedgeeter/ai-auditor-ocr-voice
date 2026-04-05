import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Command, Radio, AlertTriangle, Clock } from 'lucide-react';
import JellyOrb from './JellyOrb';
import { getIntelligentResponse, transcribeAudio } from '../../lib/groq';

interface VoiceProps {
    context?: string;
    language?: 'en' | 'ar';
    onVoiceSuccess: (input: string, output: string) => void;
}

const Voice = ({ context, onVoiceSuccess, language = 'en' }: VoiceProps) => {
    const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [liveTranscript, setLiveTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [isLiveSupported, setIsLiveSupported] = useState(false);

    const labels = language === 'ar'
        ? {
            session: 'جلسة صوتية',
            live: 'نسخ صوتي مباشر',
            recording: 'جاري التسجيل',
            transcribing: 'جاري التفريغ',
            thinking: 'جاري التحليل',
            speaking: 'جاري الرد',
            ready: 'جاهز',
            hold: 'اضغط للتحدث. النص يظهر فوراً.',
            transcript: 'النص',
            insights: 'تحليلات ذكية',
            placeholder: 'ابدأ الكلام للحصول على النص.',
            secure: 'آمن',
            context: 'سياقي',
            response: 'الرد جاهز'
        }
        : {
            session: 'Voice session',
            live: 'Live transcription',
            recording: 'Recording',
            transcribing: 'Transcribing',
            thinking: 'Analyzing',
            speaking: 'Responding',
            ready: 'Ready',
            hold: 'Hold to speak. Live text updates instantly.',
            transcript: 'Transcript',
            insights: 'AI Insights',
            placeholder: 'Start speaking to generate a transcript.',
            secure: 'Secure',
            context: 'Context-aware',
            response: 'Response ready'
        };
    
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const timerInterval = useRef<any>(null);
    const startTimeRef = useRef<number>(0);
    const recognitionRef = useRef<any>(null);
    const finalTranscriptRef = useRef<string>('');
    const stopRequestedRef = useRef(false);

    const resetToIdle = useCallback((errorMsg?: string) => {
        if (errorMsg) setError(errorMsg);
        setState('idle');
        setTimer(0);
        setLiveTranscript('');
        if (timerInterval.current) clearInterval(timerInterval.current);
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop();
        }
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null;
            recognitionRef.current.onerror = null;
            recognitionRef.current.onend = null;
            recognitionRef.current.stop?.();
        }
    }, []);

    const startRecording = async () => {
        if (state !== 'idle') return;
        
        setError(null);
        setTranscript('');
        setLiveTranscript('');
        setResponse('');
        audioChunks.current = [];
        setTimer(0);
        startTimeRef.current = Date.now();
        finalTranscriptRef.current = '';
        stopRequestedRef.current = false;

        if (isLiveSupported && recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setDebugInfo('LIVE STT');
                setState('recording');
                timerInterval.current = setInterval(() => {
                    setTimer(prev => +(prev + 0.1).toFixed(1));
                }, 100);
                return;
            } catch (err: any) {
                setDebugInfo('FALLBACK');
            }
        }
        
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

        if (isLiveSupported && recognitionRef.current) {
            stopRequestedRef.current = true;
            recognitionRef.current.stop();
            return;
        }
        
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
            setTimeout(() => setState('idle'), 4500);
        } catch (err: any) { 
            resetToIdle(err.message.includes('400') ? 'Response rejected by AI' : 'Voice processing failed');
        }
    };

    const handleLiveTranscript = useCallback(async () => {
        const finalText = finalTranscriptRef.current.trim();
        if (!finalText) {
            resetToIdle('No speech captured.');
            return;
        }

        try {
            setTranscript(finalText);
            setLiveTranscript('');
            setState('thinking');
            const aiResponse = await getIntelligentResponse(finalText, context);
            setResponse(aiResponse);
            setState('speaking');
            onVoiceSuccess(finalText, aiResponse);
            setTimeout(() => setState('idle'), 4500);
        } catch (err: any) {
            resetToIdle(err.message?.includes?.('400') ? 'Response rejected by AI' : 'Voice processing failed');
        }
    }, [context, onVoiceSuccess, resetToIdle]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = navigator.language || 'en-US';
            recognition.onresult = (event: any) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i += 1) {
                    const result = event.results[i];
                    const text = result[0]?.transcript || '';
                    if (result.isFinal) {
                        finalTranscriptRef.current = `${finalTranscriptRef.current} ${text}`.trim();
                        setTranscript(finalTranscriptRef.current);
                    } else {
                        interim += text;
                    }
                }
                setLiveTranscript(interim.trim());
            };
            recognition.onerror = () => {
                if (!stopRequestedRef.current) {
                    resetToIdle('Live transcription failed.');
                }
            };
            recognition.onend = () => {
                if (stopRequestedRef.current) {
                    handleLiveTranscript();
                }
            };
            recognitionRef.current = recognition;
            setIsLiveSupported(true);
        } else {
            setIsLiveSupported(false);
        }
    }, [handleLiveTranscript, resetToIdle]);

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
        <div className="max-w-5xl mx-auto py-4">
            <div className="grid lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 flex flex-col gap-6 glass-card border border-[var(--color-divider)] p-8 rounded-3xl shadow-[var(--shadow-lg)] relative fade-up">
                    <div className="flex items-center justify-between text-[10px] font-mono font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                        <div className="flex items-center gap-2">
                            <Radio size={12} className="text-[var(--color-primary)]" />
                            <span>{debugInfo || (isLiveSupported ? labels.live : labels.session)}</span>
                        </div>
                        {state === 'recording' && (
                            <div className="flex items-center gap-2 text-[var(--color-primary)]">
                                <Clock size={12} />
                                <span>{timer}s</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-8">
                        <div className="float-slow">
                            <JellyOrb state={state} />
                        </div>
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
                                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-[var(--shadow-md)] relative ${
                                    state === 'recording' ? 'bg-red-500 text-white' :
                                    state === 'idle' ? 'bg-[var(--color-primary)] text-white cursor-pointer' :
                                    'bg-gray-500/20 cursor-not-allowed opacity-50'
                                }`}
                            >
                                {state === 'recording' ? <MicOff size={30} /> : <Mic size={30} />}
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
                                    {state === 'recording'
                                        ? labels.recording
                                        : state === 'transcribing'
                                            ? labels.transcribing
                                            : state === 'thinking'
                                                ? labels.thinking
                                                : state === 'speaking'
                                                    ? labels.speaking
                                                    : labels.ready}
                                </span>
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">{labels.hold}</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-7 flex flex-col gap-6">
                    <div className="glass-card border border-[var(--color-divider)] p-8 rounded-3xl shadow-[var(--shadow-md)] relative overflow-hidden fade-up">
                        <div className="flex items-center gap-4 mb-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                            <Activity size={14} className="text-[var(--color-primary)]" />
                            {labels.transcript}
                        </div>
                        <p className="font-serif text-xl italic leading-relaxed text-[var(--color-text)] min-h-[90px]">
                            {transcript || liveTranscript ? (
                                <>
                                    {transcript}
                                    {liveTranscript && <span className="text-[var(--color-text-muted)]"> {liveTranscript}</span>}
                                </>
                            ) : (
                                <span className="opacity-20 text-xl">{labels.placeholder}</span>
                            )}
                        </p>
                    </div>

                    <div className="glass-card border border-[var(--color-divider)] p-8 rounded-3xl shadow-[var(--shadow-lg)] flex flex-col min-h-[260px] fade-up">
                        <div className="flex items-center justify-between mb-8 border-b border-[var(--color-divider)] pb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
                            <div className="flex items-center gap-3">
                                <Command size={14} className="text-[var(--color-primary)]" />
                                {labels.insights}
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
                                <span>{labels.secure}</span>
                                <span>{labels.context}</span>
                             </div>
                             <span>{labels.response}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Voice;
