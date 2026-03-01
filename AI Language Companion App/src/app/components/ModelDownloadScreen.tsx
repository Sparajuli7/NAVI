import React from 'react';
import { motion } from 'motion/react';
import type { ModelStatus } from '../../types/inference';

interface ModelDownloadScreenProps {
  progress: number;
  status: ModelStatus;
  progressText?: string;
}

const STATUS_LABEL: Record<ModelStatus, string> = {
  not_loaded:  'Preparing your AI companion...',
  downloading: 'Downloading your AI companion...',
  loading:     'Loading into GPU...',
  ready:       'Ready!',
  error:       'Something went wrong. Retrying...',
};

export function ModelDownloadScreen({ progress, status, progressText }: ModelDownloadScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 relative overflow-hidden">
      {/* Ambient gradient — matches onboarding */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <div className="relative z-10 w-full max-w-sm text-center">
        {/* Logo */}
        <motion.h1
          className="text-3xl mb-2 uppercase tracking-[0.15em] text-primary"
          style={{ fontFamily: 'var(--font-display)' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          NAVI
        </motion.h1>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 my-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-primary rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>

        {/* Status label */}
        <p className="text-foreground text-lg mb-6">
          {STATUS_LABEL[status]}
        </p>

        {/* Progress bar */}
        <div className="w-full bg-border rounded-full h-2 mb-3 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${Math.max(progress, 1)}%` }}
            transition={{ ease: 'linear', duration: 0.3 }}
          />
        </div>

        <p className="text-primary font-medium mb-6">{progress}%</p>

        {/* Detailed progress text (model shard names, shader compilation, etc.) */}
        {progressText && (
          <p className="text-xs text-muted-foreground mb-4 px-4 truncate">
            {progressText}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          This only happens once. After this, NAVI works offline.
        </p>
      </div>
    </div>
  );
}
