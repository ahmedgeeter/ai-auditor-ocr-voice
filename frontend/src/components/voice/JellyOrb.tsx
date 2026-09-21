import React from 'react';
import { motion } from 'framer-motion';

const JellyOrb = ({ state }: { state: string }) => {
  const orbStates: Record<string, any> = {
    idle: { 
      scale: 1, 
      rotate: 0, 
      borderRadius: "50% 50% 50% 50% / 50% 50% 50% 50%",
      transition: { type: 'spring', damping: 20, stiffness: 100 }
    },
    recording: { 
      scale: 1.2, 
      rotate: [0, 2, -2, 0],
      borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
      transition: { repeat: Infinity, duration: 1.5, type: 'spring', damping: 8, stiffness: 120 }
    },
    transcribing: { 
      scale: 0.85, 
      rotate: 360,
      borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
      transition: { repeat: Infinity, duration: 3, ease: "linear" }
    },
    thinking: { 
      scale: 1.1, 
      rotate: [0, 360],
      borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
      transition: { repeat: Infinity, duration: 10, ease: "linear" }
    },
    speaking: { 
      scale: [1, 1.15, 1], 
      borderRadius: "45% 55% 55% 45% / 45% 45% 55% 55%",
      transition: { repeat: Infinity, duration: 0.4, type: 'spring', damping: 10, stiffness: 200 }
    },
  };

  return (
    <div className="relative w-72 h-72">
      {/* Glow Layer */}
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ repeat: Infinity, duration: 5 }}
        className="absolute inset-0 bg-[var(--color-primary)] rounded-full blur-[90px] -z-10"
      />

      {/* Main Orb */}
      <motion.div
        animate={orbStates[state] || orbStates.idle}
        className="w-full h-full jelly-orb relative overflow-hidden shadow-[0_0_80px_rgba(61,156,138,0.2)]"
      >
        {/* Internal Swirls for depth */}
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 blur-2xl rounded-full translate-y-[-30%]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-black/30 blur-xl rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.05)_100%)]" />
      </motion.div>
    </div>
  );
};

export default JellyOrb;
