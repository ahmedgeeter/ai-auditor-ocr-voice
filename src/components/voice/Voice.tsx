import { useState, useRef, useEffect, useCallback } from 'react';
import { getIntelligentResponse, transcribeAudio, generateSuggestions } from '../../lib/groq';

interface VoiceProps {
  context?: string;
  isDark?: boolean;
  onVoiceSuccess?: (input: string, output: string) => void;
}

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking';
interface ChatMsg { 
  id: number; 
  role: 'user' | 'assistant'; 
  content: string; 
  ts: string; 
}

const isArabicText = (text: string) => {
  if (!text?.trim()) return false;
  const arabicMatches = text.match(/[\u0600-\u06FF]/g) || [];
  return arabicMatches.length >= Math.max(8, Math.floor(text.length * 0.15));
};

const hasLatinText = (text: string) => /[A-Za-z]/.test(text || '');

export default function Voice({ context, isDark = false, onVoiceSuccess }: VoiceProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [uiLang, setUiLang] = useState<'en' | 'ar'>('en');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [textInput, setTextInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true); // TTS toggle
  const [isPaused, setIsPaused] = useState(false); // Pause state for TTS
  const chatEndRef = useRef<HTMLDivElement>(null);

  const stateRef = useRef<VoiceState>('idle');
  const mediaRec = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef('');
  const recordingId = useRef(0);
  const stopReasonRef = useRef<'send' | 'cancel' | null>(null);
  const chatHistoryRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const theme = {
    bg: isDark ? 'bg-slate-800' : 'bg-white',
    bgSecondary: isDark ? 'bg-slate-700' : 'bg-slate-100',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    borderSecondary: isDark ? 'border-slate-600' : 'border-slate-100',
  };

  const copy = {
    en: {
      title: 'Voice Assistant',
      subtitle: 'Ask questions about the analyzed document',
      voiceOn: 'Voice On',
      voiceOff: 'Voice Off',
      suggestedQuestions: 'Suggested Questions',
      suggestionHint: 'Generated from extracted document signals',
      conversation: 'Conversation',
      clear: 'Clear',
      startHint: 'Tap Start to begin recording',
      recordHint: 'Recording in progress',
      transcribingHint: 'Converting speech to text...',
      thinkingHint: 'AI is processing...',
      speakingHint: 'Assistant is speaking',
      start: 'Start',
      send: 'Send',
      cancel: 'Cancel',
      stop: 'Stop',
      pause: 'Pause',
      resume: 'Resume',
      noMessages: 'Start by speaking or typing a question',
      you: 'You',
      ai: 'AI',
      readAloud: 'Read aloud',
      thinking: 'Thinking...',
      inputPlaceholder: 'Ask anything about the document...',
      analyzeContextMissing: 'No document context found. Results may be generic.',
      noSpeechCaptured: 'No speech captured.',
      noSpeechDetected: 'No speech detected.',
      micDenied: 'Microphone access denied.',
      micUnavailable: 'Microphone unavailable.',
      aiRequestFailed: 'AI request failed.',
      transcriptionFailed: 'Transcription failed.',
      noArabicVoice: 'Arabic voice is not available on this device/browser.',
    },
    ar: {
      title: 'المساعد الصوتي',
      subtitle: 'اسأل عن المستند الذي تم تحليله',
      voiceOn: 'الصوت مفعل',
      voiceOff: 'الصوت متوقف',
      suggestedQuestions: 'أسئلة مقترحة',
      suggestionHint: 'تم توليدها من إشارات المستند المستخرجة',
      conversation: 'المحادثة',
      clear: 'مسح',
      startHint: 'اضغط بدء لبدء التسجيل',
      recordHint: 'جاري التسجيل',
      transcribingHint: 'جاري تحويل الصوت إلى نص...',
      thinkingHint: 'جاري المعالجة...',
      speakingHint: 'المساعد يتحدث الآن',
      start: 'بدء',
      send: 'إرسال',
      cancel: 'إلغاء',
      stop: 'إيقاف',
      pause: 'إيقاف مؤقت',
      resume: 'استئناف',
      noMessages: 'ابدأ بالتحدث أو كتابة سؤال',
      you: 'أنت',
      ai: 'الذكاء الاصطناعي',
      readAloud: 'قراءة بصوت',
      thinking: 'يفكر...',
      inputPlaceholder: 'اكتب أي سؤال عن المستند...',
      analyzeContextMissing: 'لا يوجد سياق مستند. قد تكون الإجابات عامة.',
      noSpeechCaptured: 'لم يتم التقاط صوت.',
      noSpeechDetected: 'لم يتم اكتشاف صوت.',
      micDenied: 'تم رفض إذن الميكروفون.',
      micUnavailable: 'الميكروفون غير متاح.',
      aiRequestFailed: 'فشل طلب الذكاء الاصطناعي.',
      transcriptionFailed: 'فشل تحويل الصوت إلى نص.',
      noArabicVoice: 'لا يوجد صوت عربي متاح على هذا الجهاز أو المتصفح.',
    }
  }[uiLang];

  useEffect(() => { stateRef.current = voiceState; }, [voiceState]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // Load suggestions
  useEffect(() => {
    if (!context) {
      setSuggestions(
        uiLang === 'ar'
          ? ['ما أهم نقاط القوة؟', 'هل توجد علامات خطر؟', 'ما مدى ملاءمة المرشح؟', 'اقترح أسئلة مقابلة']
          : ['What are the key qualifications?', 'Any red flags?', 'Rate candidate fit', 'Suggest interview questions']
      );
      return;
    }
    generateSuggestions(context, uiLang).then(s => setSuggestions(s));
  }, [context, uiLang]);

  function getPreferredVoice(lang: 'en' | 'ar') {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices?.length) return null;

    if (lang === 'ar') {
      return (
        voices.find(v => /^ar(-|_)/i.test(v.lang) && /female|zina|amira|hoda/i.test(v.name)) ||
        voices.find(v => /^ar(-|_)/i.test(v.lang)) ||
        null
      );
    }

    return (
      voices.find(v => /^en(-|_)/i.test(v.lang) && /female|samantha|aria|jenny|zira/i.test(v.name)) ||
      voices.find(v => /^en(-|_)/i.test(v.lang)) ||
      null
    );
  }

  // TTS Functions
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }
    window.speechSynthesis.cancel();
    setIsPaused(false);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = uiLang === 'ar' ? 'ar-SA' : 'en-US';
    const preferredVoice = getPreferredVoice(uiLang);
    if (uiLang === 'ar' && !preferredVoice) {
      setError(copy.noArabicVoice);
      setVoiceState('idle');
      return;
    }
    if (preferredVoice) utter.voice = preferredVoice;
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    
    utter.onstart = () => { setIsSpeaking(true); setVoiceState('speaking'); };
    utter.onend = () => { setIsSpeaking(false); setIsPaused(false); setVoiceState('idle'); };
    utter.onerror = () => { setIsSpeaking(false); setIsPaused(false); setVoiceState('idle'); };
    
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [ttsEnabled, uiLang, getPreferredVoice, copy.noArabicVoice]);

  const stopSpeaking = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setVoiceState('idle');
  }, []);

  const pauseSpeaking = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, []);

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    const msg: ChatMsg = { 
      id: Date.now(), 
      role, 
      content, 
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    setChatHistory(prev => [...prev, msg]);
    chatHistoryRef.current = [...chatHistoryRef.current, { role, content }];
    return msg;
  };

  const runAI = useCallback(async (text: string, id: number) => {
    if (id !== recordingId.current) return;
    addMsg('user', text);
    setVoiceState('thinking');
    try {
      const history = chatHistoryRef.current.slice(-10);
      let aiResponseRaw = await getIntelligentResponse(text, context, history.slice(0, -1), uiLang);
      if (uiLang === 'ar' && (!isArabicText(aiResponseRaw) || hasLatinText(aiResponseRaw))) {
        aiResponseRaw = await getIntelligentResponse(`جاوب بالعربية فقط: ${text}`, context, history.slice(0, -1), 'ar');
      }
      const cleanedArabic = uiLang === 'ar'
        ? aiResponseRaw
            .replace(/\s+/g, ' ')
            .replace(/\b(assistant|ai|candidate|summary|recommendation)\b/gi, '')
            .trim()
        : aiResponseRaw;
      const aiResponse = uiLang === 'ar' && cleanedArabic.length > 0 ? cleanedArabic : aiResponseRaw;
      if (id !== recordingId.current) return;
      addMsg('assistant', aiResponse);
      onVoiceSuccess?.(text, aiResponse);
      speak(aiResponse);
    } catch (err: any) {
      if (id !== recordingId.current) return;
      setError(err.message || copy.aiRequestFailed);
      setVoiceState('idle');
    }
  }, [context, onVoiceSuccess, speak, copy.aiRequestFailed, uiLang]);

  const handleLiveEnd = useCallback((id: number) => {
    const text = finalTextRef.current.trim();
    setLiveTranscript('');
    if (!text) { 
      setError(copy.noSpeechCaptured); 
      setVoiceState('idle'); 
      return; 
    }
    runAI(text, id);
  }, [runAI, copy.noSpeechCaptured]);

  const handleBlobEnd = useCallback(async (blob: Blob, id: number) => {
    if (id !== recordingId.current) return;
    setVoiceState('transcribing');
    try {
      const text = await transcribeAudio(blob, uiLang);
      if (id !== recordingId.current) return;
      if (!text?.trim()) { 
        setError(copy.noSpeechDetected); 
        setVoiceState('idle'); 
        return; 
      }
      runAI(text, id);
    } catch (err: any) {
      if (id !== recordingId.current) return;
      setError(err.message || copy.transcriptionFailed);
      setVoiceState('idle');
    }
  }, [runAI, copy.noSpeechDetected, copy.transcriptionFailed, uiLang]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = uiLang === 'ar' ? 'ar-SA' : 'en-US';
    recognition.onresult = (event: any) => {
      if (stateRef.current !== 'recording') return;
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = r[0]?.transcript || '';
        if (r.isFinal) { 
          finalTextRef.current = `${finalTextRef.current} ${txt}`.trim(); 
        } else { 
          interim += txt; 
        }
      }
      setLiveTranscript(interim.trim());
    };
    recognition.onerror = (e: any) => {
      if (e.error === 'aborted') return;
      if (stateRef.current === 'recording') {
        setError(`Mic error: ${e.error}`); 
        setVoiceState('idle'); 
        setLiveTranscript('');
      }
    };
    recognition.onend = () => {
      const reason = stopReasonRef.current; 
      stopReasonRef.current = null;
      const id = recordingId.current;
      if (reason === 'send') { 
        handleLiveEnd(id); 
      } else if (reason === 'cancel') { 
        setVoiceState('idle'); 
        setLiveTranscript(''); 
      } else if (stateRef.current === 'recording') { 
        handleLiveEnd(id); 
      }
    };
    recognitionRef.current = recognition;
    return () => { 
      try { recognition.abort(); } catch {} 
    };
  }, [handleLiveEnd, uiLang, copy.noSpeechCaptured]);

  const startRecording = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
    recordingId.current = Date.now();
    const id = recordingId.current;
    setError(null); 
    setLiveTranscript('');
    finalTextRef.current = ''; 
    stopReasonRef.current = null;
    setVoiceState('recording');
    
    const useBrowserRecognition = uiLang === 'en';

    if (useBrowserRecognition && recognitionRef.current) {
      try { 
        recognitionRef.current.start(); 
        return; 
      } catch {}
    }
    
    try {
      audioChunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/wav'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
      mediaRec.current = new MediaRecorder(stream, { mimeType: mime });
      mediaRec.current.ondataavailable = e => { 
        if (e.data.size > 0) audioChunks.current.push(e.data); 
      };
      mediaRec.current.onstop = () => {
        if (stopReasonRef.current === 'cancel') { 
          stopReasonRef.current = null; 
          return; 
        }
        const blob = new Blob(audioChunks.current, { type: mime });
        if (blob.size < 500) { 
          setError(copy.noSpeechDetected); 
          setVoiceState('idle'); 
          return; 
        }
        handleBlobEnd(blob, id);
      };
      mediaRec.current.start(100);
    } catch (err: any) {
      setVoiceState('idle');
      setError(err.message?.includes('ermission') ? copy.micDenied : copy.micUnavailable);
    }
  }, [handleBlobEnd, copy.micDenied, copy.micUnavailable, uiLang]);

  const stopRecording = useCallback(() => {
    if (stateRef.current !== 'recording') return;
    stopReasonRef.current = 'send'; 
    setVoiceState('transcribing');
    if (uiLang === 'en' && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    } else if (mediaRec.current) {
      try { mediaRec.current.stop(); } catch {}
    }
  }, [uiLang]);

  const cancelRecording = useCallback(() => {
    if (stateRef.current !== 'recording') return;
    recordingId.current = Date.now(); 
    stopReasonRef.current = 'cancel';
    if (uiLang === 'en' && recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    if (mediaRec.current) {
      try { 
        mediaRec.current.stop(); 
        mediaRec.current.stream.getTracks().forEach(t => t.stop()); 
      } catch {}
    }
    setVoiceState('idle'); 
    setLiveTranscript(''); 
    stopReasonRef.current = null;
  }, [uiLang]);

  const handleTextSubmit = useCallback(() => {
    const text = textInput.trim();
    if (!text || stateRef.current !== 'idle') return;
    setTextInput('');
    recordingId.current = Date.now();
    setError(null);
    runAI(text, recordingId.current);
  }, [textInput, runAI]);

  const getOrbStyles = () => {
    switch (voiceState) {
      case 'recording':
        return {
          background: 'radial-gradient(circle at 30% 30%, #ef4444, #dc2626)',
          boxShadow: '0 0 60px rgba(239, 68, 68, 0.5), 0 0 100px rgba(239, 68, 68, 0.3)',
          transform: 'scale(1.15)',
        };
      case 'thinking':
        return {
          background: 'radial-gradient(circle at 30% 30%, #f59e0b, #d97706)',
          boxShadow: '0 0 50px rgba(245, 158, 11, 0.5)',
          transform: 'scale(1.05)',
        };
      case 'transcribing':
        return {
          background: 'radial-gradient(circle at 30% 30%, #10b981, #059669)',
          boxShadow: '0 0 50px rgba(16, 185, 129, 0.5)',
          transform: 'scale(0.95)',
        };
      case 'speaking':
        return {
          background: 'radial-gradient(circle at 30% 30%, #8b5cf6, #7c3aed)',
          boxShadow: '0 0 60px rgba(139, 92, 246, 0.5), 0 0 100px rgba(139, 92, 246, 0.3)',
          transform: 'scale(1.1)',
        };
      default:
        return {
          background: 'radial-gradient(circle at 30% 30%, #6366f1, #4f46e5)',
          boxShadow: '0 4px 30px rgba(99, 102, 241, 0.4)',
          transform: 'scale(1)',
        };
    }
  };

  const orbStyles = getOrbStyles();
  const isBusy = voiceState !== 'idle' && voiceState !== 'speaking';

  return (
    <div className="max-w-5xl mx-auto space-y-5" dir={uiLang === 'ar' ? 'rtl' : 'ltr'}>
      <div className={`rounded-2xl border ${theme.border} p-4 sm:p-5 ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900' : 'bg-gradient-to-br from-white to-slate-50'} shadow-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg sm:text-xl font-semibold ${theme.text}`}>{copy.title}</h2>
          <p className={`text-xs sm:text-sm ${theme.textMuted}`}>{copy.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center rounded-lg border ${theme.border} overflow-hidden ${isDark ? 'bg-slate-800/70' : 'bg-white'}`}>
            <button
              onClick={() => setUiLang('en')}
              className={`px-2.5 py-1 text-xs font-medium ${uiLang === 'en' ? 'bg-indigo-600 text-white' : `${theme.textMuted} ${theme.bg}`}`}
            >
              EN
            </button>
            <button
              onClick={() => setUiLang('ar')}
              className={`px-2.5 py-1 text-xs font-medium ${uiLang === 'ar' ? 'bg-indigo-600 text-white' : `${theme.textMuted} ${theme.bg}`}`}
            >
              AR
            </button>
          </div>

        {/* TTS Toggle Button */}
        <button
          onClick={() => {
            if (isSpeaking) stopSpeaking();
            setTtsEnabled(!ttsEnabled);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            ttsEnabled 
              ? isDark ? 'bg-violet-900/50 text-violet-300 border border-violet-700' : 'bg-violet-100 text-violet-700 border border-violet-200'
              : isDark ? 'bg-slate-700 text-slate-400 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {ttsEnabled ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              {copy.voiceOn}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              {copy.voiceOff}
            </>
          )}
        </button>
        </div>
      </div>
      </div>

      {!context && (
        <div className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-amber-900/20 border-amber-700/40 text-amber-300' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
          <p className="text-xs font-medium">{copy.analyzeContextMissing}</p>
        </div>
      )}

      {/* Floating Orb - Only when TTS is ON */}
      {ttsEnabled && (
        <div className="flex flex-col items-center mb-6 animate-fade-in">
          <div className="relative">
            {/* Outer glow ring */}
            <div 
              className="absolute inset-0 rounded-full transition-all duration-500"
              style={{
                background: voiceState === 'recording' 
                  ? 'rgba(239, 68, 68, 0.2)' 
                  : voiceState === 'speaking'
                  ? 'rgba(139, 92, 246, 0.2)'
                  : 'transparent',
                transform: 'scale(1.3)',
                filter: 'blur(20px)',
              }}
            />
            
            <div 
              className="relative w-24 h-24 rounded-full cursor-pointer transition-all duration-500 ease-out"
              onClick={voiceState === 'idle' ? startRecording : voiceState === 'recording' ? stopRecording : undefined}
              style={{
                ...orbStyles,
                animation: voiceState === 'recording' 
                  ? 'pulse-ring 1s ease-in-out infinite' 
                  : voiceState === 'thinking'
                  ? 'breathe 2s ease-in-out infinite'
                  : voiceState === 'speaking'
                  ? 'wave 1s ease-in-out infinite'
                  : 'float 3s ease-in-out infinite',
              }}
            >
              {/* Inner highlight */}
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 50%)',
                }}
              />
              
              {/* Icon in center */}
              <div className="absolute inset-0 flex items-center justify-center">
                {voiceState === 'idle' && (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
                {voiceState === 'recording' && (
                  <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                )}
                {(voiceState === 'transcribing' || voiceState === 'thinking') && (
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {voiceState === 'speaking' && (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </div>
            </div>
            
            {/* Ripple rings when recording */}
            {voiceState === 'recording' && (
              <>
                <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-30" />
                <div className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-20" style={{ animationDelay: '0.3s' }} />
              </>
            )}
          </div>
          
          {/* Status Text */}
          <p className={`mt-4 text-sm font-medium ${theme.textSecondary} transition-all duration-300`}>
            {voiceState === 'idle' && copy.startHint}
            {voiceState === 'recording' && copy.recordHint}
            {voiceState === 'transcribing' && copy.transcribingHint}
            {voiceState === 'thinking' && copy.thinkingHint}
            {voiceState === 'speaking' && copy.speakingHint}
          </p>

          {/* Control Buttons */}
          <div className="flex gap-2 mt-3">
            {voiceState === 'recording' && (
              <>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {copy.send}
                </button>
                <button
                  onClick={cancelRecording}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {copy.cancel}
                </button>
              </>
            )}

            {voiceState === 'speaking' && (
              <>
                <button
                  onClick={stopSpeaking}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  {copy.stop}
                </button>
                <button
                  onClick={isPaused ? resumeSpeaking : pauseSpeaking}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-all active:scale-95"
                >
                  {isPaused ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {copy.resume}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {copy.pause}
                    </>
                  )}
                </button>
              </>
            )}

            {voiceState === 'idle' && (
              <button
                onClick={startRecording}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-all active:scale-95"
              >
                {copy.start}
              </button>
            )}
          </div>

          {/* Live Transcript */}
          {voiceState === 'recording' && liveTranscript && (
            <div className="mt-3 px-4 py-2 bg-indigo-50 rounded-lg">
              <p className="text-sm text-indigo-700">{liveTranscript}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between animate-fade-in ${isDark ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
          </div>
          <button onClick={() => setError(null)} className={`${isDark ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600'} text-lg leading-none`}>×</button>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && chatHistory.length === 0 && (
        <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 sm:p-5 shadow-sm`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className={`text-xs font-semibold ${theme.textMuted} uppercase tracking-wide`}>{copy.suggestedQuestions}</p>
              <p className={`text-[11px] ${theme.textMuted} mt-1`}>{copy.suggestionHint}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => !isBusy && setTextInput(q)}
                disabled={isBusy}
                className={`text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border ${
                  isDark 
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-indigo-500 hover:text-indigo-300' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-sm'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className={`${theme.bg} rounded-2xl shadow-sm border ${theme.border} overflow-hidden`}>
        <div className={`p-4 border-b ${theme.borderSecondary} flex items-center justify-between`}>
          <h3 className={`text-sm font-semibold ${theme.text}`}>{copy.conversation}</h3>
          {chatHistory.length > 0 && (
            <button
              onClick={() => { setChatHistory([]); chatHistoryRef.current = []; }}
              className={`text-xs transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {copy.clear}
            </button>
          )}
        </div>

        <div className={`h-[22rem] overflow-y-auto p-4 space-y-4 ${isDark ? 'bg-slate-800/40' : 'bg-white/70'}`}>
          {chatHistory.length === 0 ? (
            <div className={`h-full flex items-center justify-center ${theme.textMuted}`}>
              <p className="text-sm">{copy.noMessages}</p>
            </div>
          ) : (
            chatHistory.map(msg => (
              <div 
                key={msg.id} 
                className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-md' 
                      : isDark ? 'bg-slate-700 text-slate-100 rounded-bl-md' : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}
                >
                  <p className="text-xs opacity-70 mb-1">{msg.role === 'user' ? copy.you : copy.ai} · {msg.ts}</p>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
                
                {/* Speak button for each message */}
                {ttsEnabled && (
                  <button
                    onClick={() => {
                      window.speechSynthesis.cancel();
                      const utter = new SpeechSynthesisUtterance(msg.content);
                      utter.lang = uiLang === 'ar' ? 'ar-SA' : 'en-US';
                      const preferredVoice = getPreferredVoice(uiLang);
                      if (uiLang === 'ar' && !preferredVoice) {
                        setError(copy.noArabicVoice);
                        return;
                      }
                      if (preferredVoice) utter.voice = preferredVoice;
                      utter.rate = 1;
                      utter.pitch = 1;
                      utter.volume = 1;
                      window.speechSynthesis.speak(utter);
                    }}
                    className={`p-1.5 rounded-full transition-all hover:scale-110 ${
                      msg.role === 'user'
                        ? isDark ? 'bg-indigo-900/50 text-indigo-400 hover:bg-indigo-900' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        : isDark ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={copy.readAloud}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}

          {/* Thinking */}
          {voiceState === 'thinking' && (
            <div className="flex justify-start">
              <div className={`rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: '150ms' }} />
                  <div className={`w-2 h-2 rounded-full animate-bounce ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: '300ms' }} />
                </div>
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{copy.thinking}</span>
              </div>
            </div>
          )}

          {/* Live transcript */}
          {voiceState === 'recording' && liveTranscript && (
            <div className="flex justify-end">
              <div className={`rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] ${isDark ? 'bg-indigo-900/30 border border-indigo-800' : 'bg-indigo-100 border border-indigo-200'}`}>
                <p className={`text-sm italic ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{liveTranscript}</p>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${theme.borderSecondary} ${isDark ? 'bg-slate-800' : 'bg-slate-50/80'}`}>
          <div className="flex gap-3">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleTextSubmit(); 
                } 
              }}
              disabled={isBusy}
              placeholder={copy.inputPlaceholder}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 ${
                isDark 
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || isBusy}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {copy.send}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1.15); box-shadow: 0 0 60px rgba(239, 68, 68, 0.5); }
          50% { transform: scale(1.2); box-shadow: 0 0 80px rgba(239, 68, 68, 0.7); }
        }
        
        @keyframes breathe {
          0%, 100% { transform: scale(1.05); box-shadow: 0 0 50px rgba(245, 158, 11, 0.4); }
          50% { transform: scale(1.1); box-shadow: 0 0 70px rgba(245, 158, 11, 0.6); }
        }
        
        @keyframes wave {
          0%, 100% { transform: scale(1.1); box-shadow: 0 0 60px rgba(139, 92, 246, 0.5); }
          25% { transform: scale(1.08) translateY(-2px); }
          75% { transform: scale(1.12) translateY(2px); }
        }
        
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
