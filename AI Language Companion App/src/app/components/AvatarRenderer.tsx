/**
 * AvatarRenderer — Cartoon SVG avatar using the `avataaars` library.
 * Uses AvatarPrefs (which stores avataaars-compatible prop values directly)
 * and adds animated states via Framer Motion.
 *
 * Replaces BlockyAvatar for the main conversation view.
 * BlockyAvatar is kept for contexts not yet migrated.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Avatar from 'avataaars';
import type { AvatarPrefs } from '../../utils/avatarPrefs';
import { DEFAULT_PREFS } from '../../utils/avatarPrefs';

export type AvatarState = 'idle' | 'generating' | 'speaking' | 'success' | 'thinking';

interface AvatarRendererProps {
  /** AvatarPrefs from the user's customization */
  prefs?: AvatarPrefs;
  /** Accent color for subtle tint overlay */
  accentColor?: string;
  /** Current animation state */
  state?: AvatarState;
  /** Size in pixels */
  size?: number;
  /** Character name (for aria label) */
  name?: string;
}

// Map state to mouth type
function mouthForState(state: AvatarState, baseMouth: string): string {
  switch (state) {
    case 'speaking': return 'Serious';
    case 'success': return 'Smile';
    case 'thinking': return 'Twinkle';
    case 'generating': return 'Concerned';
    default: return baseMouth;
  }
}

// Map state to eye type
function eyeForState(state: AvatarState, baseEye: string, blinking: boolean): string {
  if (blinking) return 'Close';
  switch (state) {
    case 'success': return 'Happy';
    case 'thinking': return 'Side';
    default: return baseEye;
  }
}

export function AvatarRenderer({
  prefs,
  accentColor,
  state = 'idle',
  size = 160,
  name = 'Companion',
}: AvatarRendererProps) {
  const [blinking, setBlinking] = useState(false);
  const p = prefs ?? DEFAULT_PREFS;

  // Random blink every 3–5 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 2000;
      timer = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, []);

  const mouthType = mouthForState(state, p.mouthType);
  const eyeType = eyeForState(state, p.eyeType, blinking);

  // Animation variants per state
  const variants = {
    idle: {
      y: [0, -4, 0],
      transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
    },
    generating: {
      rotate: [-1, 1, -1],
      transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const },
    },
    speaking: {
      scale: [1, 1.025, 1],
      transition: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' as const },
    },
    success: {
      y: [0, -10, 0],
      transition: { duration: 0.5, times: [0, 0.4, 1], repeat: 2, ease: 'easeOut' as const },
    },
    thinking: {
      x: [0, 3, 0, -3, 0],
      transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
    },
  };

  return (
    <motion.div
      aria-label={name}
      style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}
      animate={state}
      variants={variants}
    >
      <Avatar
        style={{ width: '100%', height: '100%' }}
        avatarStyle="Circle"
        topType={p.topType}
        accessoriesType={p.accessoriesType}
        hairColor={p.hairColor}
        facialHairType={p.facialHairType}
        clotheType={p.clotheType}
        clotheColor={p.clotheColor}
        eyeType={eyeType}
        eyebrowType={p.eyebrowType}
        mouthType={mouthType}
        skinColor={p.skinColor}
      />
      {/* Subtle color tint overlay */}
      {accentColor && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `${accentColor}18`,
            pointerEvents: 'none',
          }}
        />
      )}
    </motion.div>
  );
}
