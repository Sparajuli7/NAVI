/**
 * AvatarDisplay — Bitmoji-style illustrated avatar using the avataaars library.
 *
 * Drop-in replacement for BlockyAvatar. Accepts the same `character` and `size`
 * props for backward compat, but actual appearance is driven by saved avatar prefs
 * (localStorage via avatarPrefs.ts).
 *
 * Animations (Framer Motion):
 *   idle     — gentle bob up and down (continuous loop)
 *   confused — slight head shake (plays once, returns to idle)
 *   happy    — quick bounce (plays once, returns to idle)
 *   none     — no animation
 */
import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — avataaars ships its own types but v2 has minor React 18 compat warnings
import AvatarComponent from 'avataaars';
import { loadAvatarPrefs } from '../../utils/avatarPrefs';
import type { AvatarPrefs } from '../../utils/avatarPrefs';

// Match the same size tokens as BlockyAvatar for drop-in compat
const sizeMap: Record<string, number> = {
  xs: 28,
  sm: 40,
  md: 80,
  lg: 120,
  xl: 180,
};

export type AvatarAnimation = 'idle' | 'confused' | 'happy' | 'none';

interface AvatarDisplayProps {
  /** Kept for backward compat with BlockyAvatar — avatar look comes from avatarPrefs */
  character?: {
    name?: string;
    colors?: { primary: string; secondary: string; accent: string };
    accessory?: string;
    personality?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** true = run idle bob (default). false = static. */
  animate?: boolean;
  /** Which animation to show when animate=true */
  animation?: AvatarAnimation;
  /** Override avatar prefs (used for live preview in the builder) */
  prefs?: AvatarPrefs;
  onClick?: () => void;
}

export function AvatarDisplay({
  character: _character,
  size = 'md',
  animate = true,
  animation = 'idle',
  prefs: prefsProp,
  onClick,
}: AvatarDisplayProps) {
  // Load prefs once on mount (unless a live override is provided)
  const [localPrefs] = useState(() => loadAvatarPrefs());
  const resolvedPrefs = prefsProp ?? localPrefs;

  const controls = useAnimation();
  const isFull = size === 'full';
  const dimension = isFull ? undefined : sizeMap[size];

  const containerStyle: React.CSSProperties = isFull
    ? { width: '100%', height: '100%' }
    : { width: dimension, height: dimension, flexShrink: 0 };

  // Start / change animation whenever `animate` or `animation` changes
  useEffect(() => {
    if (!animate) {
      controls.stop();
      return;
    }
    const startIdle = () =>
      controls.start({
        y: [0, -4, 0],
        x: 0,
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      });

    if (animation === 'idle' || animation === 'none') {
      if (animation === 'idle') startIdle();
      else controls.stop();
    } else if (animation === 'confused') {
      controls
        .start({
          x: [0, -5, 5, -5, 5, 0],
          y: 0,
          transition: { duration: 0.5, ease: 'easeInOut' },
        })
        .then(startIdle);
    } else if (animation === 'happy') {
      controls
        .start({
          y: [0, -12, 0, -6, 0],
          x: 0,
          transition: { duration: 0.4, ease: 'easeOut' },
        })
        .then(startIdle);
    }
  }, [animation, animate, controls]);

  return (
    <motion.div
      animate={controls}
      style={containerStyle}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      <AvatarComponent
        style={{ width: '100%', height: '100%', display: 'block' }}
        avatarStyle="Transparent"
        topType={resolvedPrefs.topType}
        accessoriesType={resolvedPrefs.accessoriesType}
        hairColor={resolvedPrefs.hairColor}
        facialHairType={resolvedPrefs.facialHairType}
        clotheType={resolvedPrefs.clotheType}
        clotheColor={resolvedPrefs.clotheColor}
        eyeType={resolvedPrefs.eyeType}
        eyebrowType={resolvedPrefs.eyebrowType}
        mouthType={resolvedPrefs.mouthType}
        skinColor={resolvedPrefs.skinColor}
      />
    </motion.div>
  );
}
