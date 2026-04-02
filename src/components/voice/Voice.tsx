import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Activity, Command, Volume2, Radio } from 'lucide-react';
import JellyOrb from './JellyOrb';
import { getIntelligentResponse, transcribeAudio } from '../../lib/groq';

const Voice = () => {
    const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                handleAudioSequence(audioBlob);
            };
            mediaRecorder.current.start();
            setState('recording');
        } catch (err) { console.error(err); }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && state === 'recording') {
            mediaRecorder.current.stop();
            mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
        }
    };

    const handleAudioSequence = async (blob: Blob) => {
        setState('transcribing');
        try {
            const text = await transcribeAudio(blob);
            setTranscript(text);
            setState('thinking');
            const aiResponse = await getIntelligentResponse(text);
            setResponse(aiResponse);
            setState('speaking');
            setTimeout(() => setState('idle'), 3000);
        } catch (err) { setState('idle'); }
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
        };
    }, [state]);

    return (
        <div className="max-w-6xl mx-auto py-12">
            <div className="grid lg:grid-cols-12 gap-20 items-center">
                
                {/* Visualizer Station */}
                <div className="lg:col-span-5 flex flex-col items-center gap-16 jelly-float bg-[var(--color-surface-offset)] border border-[var(--color-border)] p-16 rounded-sm shadow-2xl neon-glow scanline relative">
                    <div className="absolute top-4 left-4 p-2 opacity-10">
                        <Radio size={14} className="text-[var(--color-primary)]" />
                    </div>
                    
                    <div className="relative group">
                        <div className="absolute -inset-10 bg-[var(--color-primary)]/5 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <JellyOrb state={state} />
                    </div>

                    <div className="flex flex-col items-center gap-8 w-full z-10">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', damping: 15 }}
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            className={`w-36 h-36 rounded-full flex items-center justify-center transition-all shadow-2xl relative ${
                                state === 'recording' ? 'bg-red-500 shadow-red-500/40 after:absolute after:inset-0 after:rounded-full after:bg-red-500 after:animate-ping after:opacity-20' : 'bg-[var(--color-primary)] shadow-[var(--color-primary)]/20'
                            }`}
                        >
                            {state === 'recording' ? <MicOff size={44} className="text-white" /> : <Mic size={44} className="text-white" />}
                        </motion.button>
                        
                        <div className="flex flex-col items-center gap-4">
                             <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${state === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-[var(--color-primary)] opacity-40'}`} />
                                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-[var(--color-text)]">
                                    {state === 'recording' ? 'Source_Transmitting' : 'Neural_Listen_Auto'}
                                </span>
                             </div>
                             <span className="text-[9px] font-bold opacity-30 mt-2">LINKED_X82_STABLE</span>
                        </div>
                    </div>
                </div>

                {/* Analytical Hub */}
                <div className="lg:col-span-7 flex flex-col gap-10">
                    <div className="bg-[var(--color-surface-2)] border border-[var(--color-divider)] p-12 rounded-sm shadow-xl neon-glow relative scanline">
                        <div className="flex items-center gap-4 mb-10 opacity-30">
                            <Activity size={14} className="text-[var(--color-primary)]" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Decoded_Waveform_Buffer</span>
                        </div>
                        <p className="font-serif text-2xl italic leading-relaxed text-[var(--color-text)] min-h-[100px]">
                            {transcript || <span className="opacity-10 text-3xl">Waiting for audio packet synchronization...</span>}
                        </p>
                    </div>

                    <div className="bg-[var(--color-surface)] border border-[var(--color-divider)] p-12 rounded-sm shadow-2xl neon-glow jelly-float flex flex-col min-h-[300px]" style={{ animationDelay: '2s' }}>
                        <div className="flex items-center justify-between mb-10 border-b border-[var(--color-divider)] pb-6 opacity-60">
                            <div className="flex items-center gap-4">
                                <Command size={14} className="text-[var(--color-primary)]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.5em]">AI_Synthesized_Intel</span>
                            </div>
                            <div className="text-[10px] font-mono lowercase opacity-40">llama.v4.scout.secure</div>
                        </div>
                        
                        <div className="font-sans text-xl font-bold leading-loose text-[var(--color-text)] tracking-tight">
                            {response ? (
                                <motion.p 
                                    initial={{ opacity: 0, y: 5 }} 
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ type: 'spring', damping: 20 }}
                                >{response}</motion.p>
                            ) : (
                                <div className="space-y-4 opacity-5">
                                    <div className="h-4 w-full bg-current rounded-sm" />
                                    <div className="h-4 w-5/6 bg-current rounded-sm" />
                                    <div className="h-4 w-4/6 bg-current rounded-sm" />
                                </div>
                            )}
                        </div>

                        {/* Status Footer for Consistency */}
                        <div className="mt-auto pt-16 flex items-center justify-between opacity-20 text-[9px] font-mono font-bold uppercase tracking-[0.2em]">
                             <div className="flex items-center gap-4">
                                <span>STREAM_STABLE</span>
                                <span>NEURAL_HUB_01</span>
                             </div>
                             <span>SECURE_ENCRYPTED</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Voice;
