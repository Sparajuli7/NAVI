import React from 'react';
import { motion } from 'motion/react';

interface BlockyAvatarProps {
  character: {
    name: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
    };
    accessory?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  onClick?: () => void;
}

const sizeMap = {
  xs: 28,
  sm: 36,
  md: 72,
  lg: 120,
  xl: 180
};

export function BlockyAvatar({ character, size = 'md', animate = true, onClick }: BlockyAvatarProps) {
  const dimension = sizeMap[size];
  const Component = animate ? motion.div : 'div';
  
  return (
    <Component
      className={`relative flex-shrink-0 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ width: dimension, height: dimension }}
      onClick={onClick}
      {...(animate ? {
        animate: {
          y: [0, -2, 0],
        },
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }
      } : {})}
    >
      {/* Simple blocky character made with divs - Minecraft style */}
      <div className="relative w-full h-full">
        {/* Gold ring/glow around character */}
        <div className="absolute inset-0 rounded-lg ring-2 ring-primary/40 shadow-[0_0_20px_rgba(212,168,83,0.2)]" />
        
        {/* Character body */}
        <div 
          className="absolute inset-0 rounded-lg overflow-hidden shadow-lg"
          style={{ background: character.colors.primary }}
        >
          {/* Head */}
          <div 
            className="absolute top-[10%] left-1/2 -translate-x-1/2 rounded-md shadow-md"
            style={{ 
              width: '45%', 
              height: '35%',
              background: character.colors.secondary
            }}
          >
            {/* Eyes */}
            <div className="absolute top-[35%] left-[25%] w-[15%] h-[15%] bg-black rounded-sm" />
            <div className="absolute top-[35%] right-[25%] w-[15%] h-[15%] bg-black rounded-sm" />
            
            {/* Smile */}
            <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[40%] h-[8%] bg-black/80 rounded-sm" />
            
            {/* Cheek blush (subtle) */}
            {size !== 'xs' && size !== 'sm' && (
              <>
                <div 
                  className="absolute bottom-[30%] left-[15%] w-[20%] h-[12%] rounded-full opacity-30"
                  style={{ background: character.colors.accent }}
                />
                <div 
                  className="absolute bottom-[30%] right-[15%] w-[20%] h-[12%] rounded-full opacity-30"
                  style={{ background: character.colors.accent }}
                />
              </>
            )}
          </div>
          
          {/* Body */}
          <div 
            className="absolute bottom-[15%] left-1/2 -translate-x-1/2 rounded-md shadow-md"
            style={{ 
              width: '55%', 
              height: '40%',
              background: character.colors.accent
            }}
          >
            {/* Body detail (pocket or design) */}
            {size !== 'xs' && size !== 'sm' && (
              <div 
                className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[30%] h-[20%] rounded-sm opacity-20"
                style={{ background: character.colors.secondary }}
              />
            )}
          </div>
          
          {/* Accessory indicator */}
          {character.accessory && size !== 'xs' && size !== 'sm' && (
            <div className="absolute top-[8%] right-[20%] text-xl drop-shadow-md">
              {character.accessory}
            </div>
          )}
        </div>
      </div>
    </Component>
  );
}