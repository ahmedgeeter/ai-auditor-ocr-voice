import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Square, Send, Sparkles, RotateCcw, Loader2, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import JellyOrb from './JellyOrb';
import { getIntelligentResponse, transcribeAudio, generateSuggestions } from '../../lib/groq';

interface VoiceProps {
    context?: string;
    language?: 'en' | 'ar';
    onVoiceSuccess: (input: string, output: string) => void;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking';
interface ChatMsg { id: number; role: 'user' | 'assistant'; content: string; ts: string; }

const Waveform = ({ active }: { active: boolean }) => (
    <div className="flex items-center gap-[3px] h-6">
        {[0.4, 0.7, 1, 0.7, 0.5, 0.8, 0.4].map((h, i) => (
            <motion.div
                key={i}
                className="w-[3px] rounded-full bg-white"
                animate={active ? { scaleY: [h, 1, h * 0.5, 1, h], opacity: [0.6, 1, 0.6, 1, 0.6] } : { scaleY: 0.3, opacity: 0.3 }}
                transition={{ duration: 0.8, delay: i * 0.08, repeat: Infinity, ease: 'easeInOut' }}
                style={{ height: 20 }}
            />
        ))}
    </div>
);

const Voice = ({ context, onVoiceSuccess, language = 'en' }: VoiceProps) => {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [liveTranscript, setLiveTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);
    const [isLiveSupported, setIsLiveSupported] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [textInput, setTextInput] = useState('');
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const L = language === 'ar' ? {
        title: 'مساعد ذكاء اصطناعي للتوظيف',
        subtitle: 'اسأل بصوتك أو اكتب سؤالك — يحلل المستندات ويجيب فورًا',
        recording: 'جاري الاستماع...', transcribing: 'جاري التفريغ...', thinking: 'يحلل...', speaking: 'يتحدث...', ready: 'جاهز للمحادثة',
        hint: 'انقر الميكروفون أو اكتب سؤالك', stop: 'إيقاف', cancel: 'إلغاء',
        inputPlaceholder: 'اكتب سؤالك هنا...', send: 'إرسال',
        suggestions: 'أسئلة مقترحة', chatTitle: 'جلسة التحليل الذكي',
        clearChat: 'مسح المحادثة', you: 'أنت', ai: 'Meridian AI',
        emptyChat: 'ابدأ بسؤال بالصوت أو بالكتابة', liveBadge: 'نسخ مباشر', stopReading: 'إيقاف القراءة',
    } : {
        title: 'AI Talent Intelligence',
        subtitle: 'Ask by voice or type — analyses documents, answers instantly',
        recording: 'Listening...', transcribing: 'Transcribing...', thinking: 'Analysing...', speaking: 'Speaking...', ready: 'Ready',
        hint: 'Click the mic or type your question', stop: 'Stop', cancel: 'Cancel',
        inputPlaceholder: 'Ask anything about this candidate...', send: 'Send',
        suggestions: 'Suggested questions', chatTitle: 'Intelligence Session',
        clearChat: 'Clear chat', you: 'You', ai: 'Meridian AI',
        emptyChat: 'Start with a voice or text question', liveBadge: 'Live STT', stopReading: 'Stop reading',
    };

    // ── refs ──────────────────────────────────────────────────────
    const stateRef       = useRef<VoiceState>('idle');
    const mediaRec       = useRef<MediaRecorder | null>(null);
    const audioChunks    = useRef<Blob[]>([]);
    const recognitionRef = useRef<any>(null);
    const finalTextRef   = useRef('');
    const recordingId    = useRef(0);
    const stopReasonRef  = useRef<'send' | 'cancel' | null>(null);
    const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
    const stopTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const chatHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const utteranceRef   = useRef<SpeechSynthesisUtterance | null>(null);
    const [isTTSActive, setIsTTSActive] = useState(false);
    const [ttsSupported] = useState(() => 'speechSynthesis' in window);

    useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

    // ── TTS helpers ───────────────────────────────────────────────
    const getBestVoice = useCallback((lang: 'en' | 'ar'): SpeechSynthesisVoice | null => {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;
        if (lang === 'ar') {
            return voices.find(v => v.lang.startsWith('ar')) ??
                   voices.find(v => v.name.toLowerCase().includes('arabic')) ?? null;
        }
        const preferred = [
            'Google UK English Female', 'Google US English', 'Microsoft Zira',
            'Samantha', 'Karen', 'Daniel', 'Alex',
        ];
        for (const name of preferred) {
            const match = voices.find(v => v.name.includes(name));
            if (match) return match;
        }
        return voices.find(v => v.lang.startsWith('en')) ?? null;
    }, []);

    const speak = useCallback((text: string) => {
        if (!ttsSupported) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang   = language === 'ar' ? 'ar-SA' : 'en-US';
        utter.rate   = language === 'ar' ? 0.9 : 0.95;
        utter.pitch  = 1.05;
        utter.volume = 1;
        const trySetVoice = () => {
            const v = getBestVoice(language);
            if (v) utter.voice = v;
        };
        trySetVoice();
        if (!utter.voice) {
            window.speechSynthesis.addEventListener('voiceschanged', trySetVoice, { once: true });
        }
        utter.onstart = () => setIsTTSActive(true);
        utter.onend   = () => { setIsTTSActive(false); setVoiceState('idle'); };
        utter.onerror = () => { setIsTTSActive(false); setVoiceState('idle'); };
        utteranceRef.current = utter;
        window.speechSynthesis.speak(utter);
    }, [ttsSupported, language, getBestVoice]);

    const stopSpeaking = useCallback(() => {
        if (!ttsSupported) return;
        window.speechSynthesis.cancel();
        setIsTTSActive(false);
        setVoiceState('idle');
    }, [ttsSupported]);

    // ── Load suggestions when context changes ─────────────────────
    useEffect(() => {
        if (!context) {
            setSuggestions(language === 'ar'
                ? ['ما هي المهارات الأساسية المطلوبة لمهندس AI؟', 'كيف أقيّم المرشح بسرعة؟', 'ما أهم الأسئلة في مقابلة التوظيف؟', 'ما الفرق بين ML Engineer وAI Engineer؟']
                : ['What makes a great AI Engineer candidate?', 'Key skills to look for in ML roles?', 'Best interview questions for AI roles?', 'How to evaluate technical portfolios?']
            );
            return;
        }
        setLoadingSuggestions(true);
        generateSuggestions(context, language).then(s => { setSuggestions(s); setLoadingSuggestions(false); });
    }, [context, language]);

    // ── helpers ───────────────────────────────────────────────────
    const clearTimers = useCallback(() => {
        if (timerRef.current)    { clearInterval(timerRef.current);  timerRef.current = null; }
        if (stopTimerRef.current){ clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    }, []);
    const killMedia = useCallback(() => {
        if (mediaRec.current && mediaRec.current.state !== 'inactive') {
            try { mediaRec.current.stop(); } catch {}
            try { mediaRec.current.stream.getTracks().forEach(t => t.stop()); } catch {}
        }
        mediaRec.current = null;
    }, []);
    const killRecognition = useCallback((abort = false) => {
        if (!recognitionRef.current) return;
        try { abort ? recognitionRef.current.abort() : recognitionRef.current.stop(); } catch {}
    }, []);

    const addMsg = (role: 'user' | 'assistant', content: string) => {
        const msg: ChatMsg = { id: Date.now(), role, content, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setChatHistory(prev => [...prev, msg]);
        chatHistoryRef.current = [...chatHistoryRef.current, { role, content }];
        return msg;
    };

    // ── AI pipeline ───────────────────────────────────────────────
    const runAI = useCallback(async (text: string, id: number) => {
        if (id !== recordingId.current) return;
        addMsg('user', text);
        setVoiceState('thinking');
        try {
            const history = chatHistoryRef.current.slice(-10);
            const aiResponse = await getIntelligentResponse(text, context, history.slice(0, -1));
            if (id !== recordingId.current) return;
            addMsg('assistant', aiResponse);
            setVoiceState('speaking');
            onVoiceSuccess(text, aiResponse);
            speak(aiResponse);
        } catch (err: any) {
            if (id !== recordingId.current) return;
            setError(err.message || 'AI request failed.');
            setVoiceState('idle');
        }
    }, [context, onVoiceSuccess]);

    const handleLiveEnd = useCallback((id: number) => {
        const text = finalTextRef.current.trim();
        setLiveTranscript('');
        if (!text) { setError(language === 'ar' ? 'لم يُكتشف كلام' : 'No speech captured.'); setVoiceState('idle'); return; }
        runAI(text, id);
    }, [runAI, language]);

    const handleBlobEnd = useCallback(async (blob: Blob, id: number) => {
        if (id !== recordingId.current) return;
        setVoiceState('transcribing');
        try {
            const text = await transcribeAudio(blob);
            if (id !== recordingId.current) return;
            if (!text?.trim()) { setError('No speech detected.'); setVoiceState('idle'); return; }
            runAI(text, id);
        } catch (err: any) {
            if (id !== recordingId.current) return;
            setError(err.message || 'Transcription failed.');
            setVoiceState('idle');
        }
    }, [runAI]);

    // ── SpeechRecognition setup ───────────────────────────────────
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setIsLiveSupported(false); return; }
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
        recognition.onresult = (event: any) => {
            if (stateRef.current !== 'recording') return;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                const txt = r[0]?.transcript || '';
                if (r.isFinal) { finalTextRef.current = `${finalTextRef.current} ${txt}`.trim(); }
                else { interim += txt; }
            }
            setLiveTranscript(interim.trim());
        };
        recognition.onerror = (e: any) => {
            if (e.error === 'aborted') return;
            clearTimers();
            if (stateRef.current === 'recording' || stateRef.current === 'transcribing') {
                setError(`Mic error: ${e.error}`); setVoiceState('idle'); setTimer(0); setLiveTranscript('');
            }
        };
        recognition.onend = () => {
            clearTimers();
            const reason = stopReasonRef.current; stopReasonRef.current = null;
            const id = recordingId.current;
            if (reason === 'send') { handleLiveEnd(id); }
            else if (reason === 'cancel') { setVoiceState('idle'); setTimer(0); setLiveTranscript(''); }
            else if (stateRef.current === 'recording' || stateRef.current === 'transcribing') { handleLiveEnd(id); }
        };
        recognitionRef.current = recognition;
        setIsLiveSupported(true);
        return () => { try { recognition.abort(); } catch {} };
    }, [language, handleLiveEnd, clearTimers]);

    // ── startRecording ────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        if (stateRef.current !== 'idle') return;
        recordingId.current = Date.now();
        const id = recordingId.current;
        setError(null); setLiveTranscript('');
        finalTextRef.current = ''; stopReasonRef.current = null; clearTimers();
        setVoiceState('recording'); setTimer(0);
        timerRef.current = setInterval(() => setTimer(t => +(t + 0.1).toFixed(1)), 100);
        if (isLiveSupported && recognitionRef.current) {
            try { recognitionRef.current.start(); return; } catch {}
        }
        try {
            audioChunks.current = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/wav'];
            const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
            mediaRec.current = new MediaRecorder(stream, { mimeType: mime });
            mediaRec.current.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
            mediaRec.current.onstop = () => {
                if (stopReasonRef.current === 'cancel') { stopReasonRef.current = null; return; }
                const blob = new Blob(audioChunks.current, { type: mime });
                if (blob.size < 500) { setError('No audio.'); setVoiceState('idle'); return; }
                handleBlobEnd(blob, id);
            };
            mediaRec.current.start(100);
        } catch (err: any) {
            clearTimers(); setVoiceState('idle');
            setError(err.message?.includes('ermission') ? 'Mic access denied.' : 'Mic unavailable.');
        }
    }, [isLiveSupported, handleBlobEnd, clearTimers]);

    // ── stopRecording / cancelRecording ───────────────────────────
    const stopRecording = useCallback(() => {
        if (stateRef.current !== 'recording') return;
        stopReasonRef.current = 'send'; setVoiceState('transcribing'); clearTimers();
        if (isLiveSupported && recognitionRef.current) {
            const id = recordingId.current;
            stopTimerRef.current = setTimeout(() => { stopReasonRef.current = null; handleLiveEnd(id); }, 2000);
            killRecognition(false);
        } else { killMedia(); }
    }, [isLiveSupported, handleLiveEnd, clearTimers, killRecognition, killMedia]);

    const cancelRecording = useCallback(() => {
        if (stateRef.current !== 'recording') return;
        recordingId.current = Date.now(); stopReasonRef.current = 'cancel';
        clearTimers(); killRecognition(true); killMedia();
        setVoiceState('idle'); setTimer(0); setLiveTranscript(''); stopReasonRef.current = null;
    }, [clearTimers, killRecognition, killMedia]);

    const handleMicClick = useCallback(() => {
        if (stateRef.current === 'idle') startRecording();
        else if (stateRef.current === 'recording') stopRecording();
    }, [startRecording, stopRecording]);

    // ── text input submit ─────────────────────────────────────────
    const handleTextSubmit = useCallback(() => {
        const text = textInput.trim();
        if (!text || stateRef.current !== 'idle') return;
        setTextInput('');
        recordingId.current = Date.now();
        setError(null);
        runAI(text, recordingId.current);
    }, [textInput, runAI]);

    // ── keyboard ──────────────────────────────────────────────────
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.code === 'Escape' && stateRef.current === 'recording') { e.preventDefault(); cancelRecording(); }
        };
        window.addEventListener('keydown', down);
        return () => window.removeEventListener('keydown', down);
    }, [cancelRecording]);

    useEffect(() => () => {
        clearTimers(); killRecognition(true); killMedia();
        if (ttsSupported) window.speechSynthesis.cancel();
    }, []);

    // ── render ────────────────────────────────────────────────────
    const isBusy = voiceState !== 'idle';
    const stateLabel = voiceState === 'recording' ? L.recording
        : voiceState === 'transcribing' ? L.transcribing
        : voiceState === 'thinking'     ? L.thinking
        : (voiceState === 'speaking' && isTTSActive) ? L.speaking
        : voiceState === 'speaking'     ? L.speaking
        : L.ready;

    return (
        <div className="w-full fade-up">
            {/* Header strip */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-[var(--color-text)] tracking-tight">{L.title}</h2>
                    <p className="text-[13px] text-[var(--color-text-muted)] mt-1">{L.subtitle}</p>
                </div>
                {chatHistory.length > 0 && (
                    <button
                        onClick={() => { setChatHistory([]); chatHistoryRef.current = []; }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-divider)] text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:border-[var(--color-error)]/40 transition-all"
                    >
                        <RotateCcw size={11} />
                        {L.clearChat}
                    </button>
                )}
            </div>

            <div className="grid lg:grid-cols-12 gap-6 items-start">

                {/* ── Left: Mic + Controls ── */}
                <div className="lg:col-span-4 flex flex-col gap-4">

                    {/* Orb card */}
                    <div className="glass-card border border-[var(--color-divider)] rounded-3xl p-6 flex flex-col items-center gap-5 shadow-[var(--shadow-lg)]">
                        <div className="float-slow">
                            <JellyOrb state={voiceState} />
                        </div>

                        {/* Mic button */}
                        <motion.button
                            onClick={isTTSActive ? stopSpeaking : handleMicClick}
                            whileHover={!isBusy || voiceState === 'recording' || isTTSActive ? { scale: 1.04 } : {}}
                            whileTap={{ scale: 0.95 }}
                            disabled={isBusy && voiceState !== 'recording' && !isTTSActive}
                            className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-[var(--shadow-md)] transition-all ${
                                voiceState === 'recording' ? 'bg-red-500 ring-4 ring-red-400/30'
                                : isTTSActive              ? 'bg-purple-600 ring-4 ring-purple-400/30'
                                : voiceState === 'idle'    ? 'bg-[var(--color-primary)]'
                                : 'bg-gray-300/30 opacity-40 cursor-not-allowed'
                            }`}
                        >
                            {voiceState === 'recording' ? (
                                <Waveform active />
                            ) : isTTSActive ? (
                                <Volume2 size={26} className="text-white" />
                            ) : (
                                <Mic size={28} className="text-white" />
                            )}
                        </motion.button>

                        {/* State + stop/cancel + TTS */}
                        <div className="flex flex-col items-center gap-3 w-full">
                            <div className="flex items-center gap-2">
                                <motion.span
                                    className={`w-2 h-2 rounded-full ${voiceState !== 'idle' ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-primary)] opacity-25'}`}
                                    animate={voiceState !== 'idle' ? { scale: [1, 1.4, 1] } : {}}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-text)]">{stateLabel}</span>
                            </div>
                            {voiceState === 'idle' && (
                                <span className="text-[11px] text-[var(--color-text-muted)] text-center">{L.hint}</span>
                            )}
                            <AnimatePresence>
                                {voiceState === 'recording' && (
                                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2">
                                        <button onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-[11px] font-semibold rounded-full shadow-sm">
                                            <Square size={10} />{L.stop}
                                        </button>
                                        <button onClick={cancelRecording} className="px-3 py-1.5 border border-[var(--color-divider)] text-[var(--color-text-muted)] text-[11px] font-semibold rounded-full">
                                            {L.cancel}
                                        </button>
                                    </motion.div>
                                )}
                                {isTTSActive && (
                                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                        <button onClick={stopSpeaking}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-[11px] font-semibold rounded-full shadow-md hover:bg-purple-700 transition-colors"
                                        >
                                            <VolumeX size={11} />{L.stopReading}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {voiceState === 'recording' && timer > 0 && (
                                <span className="text-[10px] font-mono text-red-500">{timer}s</span>
                            )}
                            {isTTSActive && (
                                <div className="flex items-center gap-1.5">
                                    {[0.4,0.7,1,0.7,0.4,0.8,0.5].map((h,i) => (
                                        <motion.div key={i} className="w-[3px] rounded-full bg-purple-500"
                                            animate={{ scaleY: [h, 1, h*0.4, 1, h] }}
                                            transition={{ duration: 0.7, delay: i*0.07, repeat: Infinity, ease: 'easeInOut' }}
                                            style={{ height: 18 }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)]"
                            >
                                <span className="text-[11px] font-medium leading-snug">{error}</span>
                                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-[11px] shrink-0">✕</button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Suggested questions */}
                    <div className="glass-card border border-[var(--color-divider)] rounded-2xl p-4 shadow-[var(--shadow-sm)]">
                        <div className="flex items-center gap-2 mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">
                            <Sparkles size={11} className="text-[var(--color-primary)]" />
                            {L.suggestions}
                        </div>
                        {loadingSuggestions ? (
                            <div className="space-y-2">
                                {[1,2,3,4].map(i => <div key={i} className="h-7 bg-[var(--color-divider)] rounded-full animate-pulse opacity-50" />)}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {suggestions.map((q, i) => (
                                    <motion.button
                                        key={i}
                                        onClick={() => { if (!isBusy) { setTextInput(q); } }}
                                        whileHover={{ x: 3 }}
                                        disabled={isBusy}
                                        className="flex items-center gap-2 text-left px-3 py-2 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-primary-highlight)] hover:text-[var(--color-primary)] text-[11px] font-medium text-[var(--color-text-muted)] transition-all disabled:opacity-40"
                                    >
                                        <ChevronRight size={11} className="shrink-0 opacity-60" />
                                        {q}
                                    </motion.button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Chat ── */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    {/* Chat history */}
                    <div className="glass-card border border-[var(--color-divider)] rounded-3xl shadow-[var(--shadow-lg)] flex flex-col overflow-hidden" style={{ minHeight: 440 }}>
                        {/* Chat header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider)]">
                            <div className="flex items-center gap-2">
                                <motion.span className="w-2 h-2 rounded-full bg-[var(--color-success)]"
                                    animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
                                />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-text-muted)]">{L.chatTitle}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-widest opacity-40">
                                {isLiveSupported && <span className="text-[var(--color-success)]">{L.liveBadge}</span>}
                                <span>llama-3.3-70b</span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar" style={{ maxHeight: 360 }}>
                            {chatHistory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-20 py-16">
                                    <Sparkles size={32} strokeWidth={1} />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">{L.emptyChat}</span>
                                </div>
                            ) : (
                                chatHistory.map(msg => (
                                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] ${msg.role === 'user'
                                            ? 'bg-[var(--color-primary)] text-white rounded-2xl rounded-br-md'
                                            : 'bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-2xl rounded-bl-md border border-[var(--color-divider)]'
                                        } px-4 py-3`}>
                                            <div className="text-[10px] font-semibold uppercase tracking-widest opacity-60 mb-1">
                                                {msg.role === 'user' ? L.you : L.ai} · {msg.ts}
                                            </div>
                                            <p className="text-[13px] leading-relaxed">{msg.content}</p>
                                        </div>
                                    </motion.div>
                                ))
                            )}

                            {/* Thinking indicator */}
                            {voiceState === 'thinking' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-divider)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                                        <Loader2 size={13} className="animate-spin text-[var(--color-primary)]" />
                                        <span className="text-[12px] text-[var(--color-text-muted)]">{L.thinking}</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Live transcript preview */}
                            {voiceState === 'recording' && liveTranscript && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
                                    <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-2xl rounded-br-md px-4 py-3 max-w-[80%]">
                                        <p className="text-[13px] text-[var(--color-primary)] italic">{liveTranscript}<span className="animate-pulse">|</span></p>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={chatEndRef} />
                        </div>

                        {/* Text input */}
                        <div className="px-5 py-4 border-t border-[var(--color-divider)] bg-[var(--color-surface-2)]/50">
                            <div className="flex items-center gap-3">
                                <input
                                    value={textInput}
                                    onChange={e => setTextInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
                                    disabled={isBusy}
                                    placeholder={L.inputPlaceholder}
                                    className="flex-1 bg-transparent text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none disabled:opacity-40"
                                />
                                <motion.button
                                    onClick={handleTextSubmit}
                                    whileTap={{ scale: 0.93 }}
                                    disabled={!textInput.trim() || isBusy}
                                    className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-sm transition-opacity hover:opacity-90"
                                >
                                    <Send size={14} />
                                </motion.button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Voice;
