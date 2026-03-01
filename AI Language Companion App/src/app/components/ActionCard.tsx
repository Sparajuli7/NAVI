import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface ActionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  accentColor?: 'primary' | 'secondary';
  onClick?: () => void;
}

export function ActionCard({ 
  icon: Icon, 
  label, 
  description, 
  accentColor = 'primary',
  onClick 
}: ActionCardProps) {
  const colorClass = accentColor === 'primary' ? 'text-primary' : 'text-secondary';
  
  return (
    <motion.button
      className="bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/30 transition-all"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
    >
      <Icon className={`w-6 h-6 ${colorClass} mb-3`} />
      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.button>
  );
}
