import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface QuickActionPillProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'cta' | 'gold';
}

export function QuickActionPill({ icon: Icon, label, onClick, variant = 'default' }: QuickActionPillProps) {
  const variantClasses = {
    default: 'bg-card border-border text-foreground hover:border-primary/30',
    cta: 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/15',
    gold: 'bg-[#D4A853]/10 border-[#D4A853]/40 text-[#D4A853] hover:bg-[#D4A853]/15',
  }[variant];

  const iconClasses = {
    default: 'text-muted-foreground',
    cta: 'text-primary',
    gold: 'text-[#D4A853]',
  }[variant];

  return (
    <motion.button
      className={`inline-flex items-center gap-2 px-4 py-2 border rounded-full text-sm transition-colors whitespace-nowrap ${variantClasses}`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon className={`w-4 h-4 ${iconClasses}`} />
      <span>{label}</span>
    </motion.button>
  );
}
