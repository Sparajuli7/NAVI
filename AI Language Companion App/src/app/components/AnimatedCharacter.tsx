/**
 * AnimatedCharacter — Lottie-based animated avatar with CharacterAvatar fallback.
 *
 * Uses Lottie JSON files from /public/lottie/ for animated character states.
 * Falls back gracefully to CharacterAvatar (emoji) if:
 *   - lottie-react is not installed
 *   - Lottie JSON files don't exist in /public/lottie/
 *
 * To activate Lottie animations:
 *   1. Run: pnpm add lottie-react
 *   2. Download 4 Lottie JSON files from lottiefiles.com and place in public/lottie/:
 *      - char_idle.json      (character floating/idle)
 *      - char_speaking.json  (character talking)
 *      - char_thinking.json  (character thinking/generating)
 *      - char_success.json   (character celebrating)
 *
 * This is a drop-in replacement for CharacterAvatar at all call sites.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { CharacterAvatar } from './CharacterAvatar';
import type { CharacterAvatarProps, CharacterAvatarAnimation } from './CharacterAvatar';

// Lottie file paths in public/ directory
const LOTTIE_MAP: Record<CharacterAvatarAnimation, string> = {
  idle:       '/lottie/char_idle.json',
  speaking:   '/lottie/char_speaking.json',
  generating: '/lottie/char_thinking.json',
  success:    '/lottie/char_success.json',
  none:       '/lottie/char_idle.json',
};

// Size in pixels for the Lottie player container
const SIZE_PX: Record<string, number> = { xs: 32, sm: 44, md: 56, lg: 80, xl: 112 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieModule = { default: React.ComponentType<any> };

export type { CharacterAvatarProps as AnimatedCharacterProps };

export function AnimatedCharacter(props: CharacterAvatarProps) {
  const { size = 'md', animationState = 'idle' } = props;
  const px = SIZE_PX[size] ?? 56;

  const [LottiePlayer, setLottiePlayer] = useState<LottieModule['default'] | null>(null);
  const [animData, setAnimData] = useState<object | null>(null);
  const [lottieReady, setLottieReady] = useState(false);
  const prevAnimState = useRef(animationState);

  // Lazy-load lottie-react only once
  useEffect(() => {
    if (LottiePlayer) return;
    // Dynamic import — fails silently if lottie-react not installed
    import('lottie-react')
      .then((mod) => setLottiePlayer(() => mod.default))
      .catch(() => { /* lottie-react not installed — use CharacterAvatar fallback */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the appropriate Lottie JSON when animation state changes
  useEffect(() => {
    if (!LottiePlayer) return;
    if (animationState === prevAnimState.current && animData) return;
    prevAnimState.current = animationState;

    const path = LOTTIE_MAP[animationState] ?? LOTTIE_MAP.idle;
    fetch(path)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setAnimData(data);
          setLottieReady(true);
        } else {
          setLottieReady(false);
        }
      })
      .catch(() => setLottieReady(false));
  }, [LottiePlayer, animationState, animData]);

  // Fallback to emoji avatar if Lottie not available
  if (!lottieReady || !LottiePlayer || !animData) {
    return <CharacterAvatar {...props} />;
  }

  // At xs size (32px), skip animation overhead — use static emoji
  if (size === 'xs') {
    return <CharacterAvatar {...props} />;
  }

  const colors = props.character?.avatar_color ?? props.character?.colors ?? {
    primary: '#6BBAA7',
    secondary: '#D4A853',
  };

  function countryFlag(cc: string): string {
    if (!cc || cc.length !== 2) return '';
    return cc.toUpperCase().replace(/./g, (c) =>
      String.fromCodePoint(c.charCodeAt(0) + 127397),
    );
  }
  const flag = countryFlag(props.character?.location_country ?? '');

  return (
    <motion.div
      style={{ width: px, height: px, flexShrink: 0, position: 'relative' }}
      onClick={props.onClick}
      className={props.onClick ? 'cursor-pointer' : undefined}
      // Gentle float animation wrapping the Lottie player
      animate={
        animationState === 'idle'
          ? { y: [0, -4, 0], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
          : animationState === 'success'
          ? { y: [0, -10, 0], transition: { duration: 0.4, ease: 'easeOut' } }
          : {}
      }
    >
      {/* Gradient ring background */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          overflow: 'hidden',
          boxShadow: `0 0 0 2px ${colors.primary}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LottiePlayer
          animationData={animData}
          loop={animationState !== 'success'}
          autoplay
          style={{ width: '90%', height: '90%' }}
        />
      </div>

      {/* Country flag badge */}
      {flag && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            fontSize: size === 'sm' ? '13px' : size === 'lg' ? '20px' : size === 'xl' ? '28px' : '15px',
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          {flag}
        </span>
      )}
    </motion.div>
  );
}
