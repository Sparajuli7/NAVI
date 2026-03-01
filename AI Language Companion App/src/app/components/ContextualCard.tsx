import React from 'react';
import { motion } from 'motion/react';

interface ContextualCardProps {
  title: string;
  imageUrl: string;
  progress?: number;
  onClick?: () => void;
}

export function ContextualCard({ title, imageUrl, progress, onClick }: ContextualCardProps) {
  return (
    <motion.button
      className="relative w-[200px] h-[120px] rounded-2xl overflow-hidden flex-shrink-0"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
    >
      <img 
        src={imageUrl} 
        alt={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-medium text-sm mb-1">{title}</p>
        {progress !== undefined && (
          <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </motion.button>
  );
}
