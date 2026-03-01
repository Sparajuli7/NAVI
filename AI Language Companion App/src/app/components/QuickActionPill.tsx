import React from 'react';
import { motion } from 'motion/react';

interface QuickActionPillProps {
  icon: string;
  label: string;
  onClick: () => void;
}

export function QuickActionPill({ icon, label, onClick }: QuickActionPillProps) {
  return (
    <motion.button
      className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full text-sm text-foreground hover:border-primary/30 hover:bg-card/80 transition-colors whitespace-nowrap"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </motion.button>
  );
}
