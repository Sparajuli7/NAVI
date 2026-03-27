/**
 * AIAvatarDisplay — 3-tier avatar renderer for NAVI companions.
 *
 * Tier 1 — AI Portrait (Pollinations.ai image, stored as base64 in IndexedDB)
 *           Loaded async on mount; shows when has_portrait = true and image loads.
 *
 * Tier 2 — DiceBear "notionists" (offline, deterministic SVG from characterId seed)
 *           Editorial illustration style; clearly human; works 100% offline.
 *           Shown immediately while Tier 1 is loading, or as permanent fallback.
 *
 * Tier 3 — avataaars (retired from primary path; not used here)
 *
 * Drop-in replacement for AvatarRenderer — same AvatarState type, same props shape
 * plus a required `characterId` for portrait loading and DiceBear seeding.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { loadAvatarImage } from '../../utils/storage';
import type { AvatarPrefs } from '../../utils/avatarPrefs';

export type AvatarState = 'idle' | 'generating' | 'speaking' | 'success' | 'thinking';

export interface AIAvatarDisplayProps {
  /** Character ID — used as DiceBear seed and IndexedDB portrait key */
  characterId: string;
  /** Avatar prefs for DiceBear color hints */
  prefs?: AvatarPrefs;
  /** Accent color for gradient ring */
  accentColor?: string;
  /** Current animation state */
  state?: AvatarState;
  /** Size in pixels */
  size?: number;
  /** Character name (for aria label) */
  name?: string;
}

// Map skinColor (avataaars value) to a DiceBear-compatible hex background color
const SKIN_TO_BG: Record<string, string> = {
  Pale:       'fce4d6',
  Light:      'f8d5c2',
  Tanned:     'e8b89a',
  Brown:      'c58c5c',
  DarkBrown:  '8d5524',
  Black:      '4a2912',
  Yellow:     'f5d6a0',
};

// Map hairColor (avataaars value) to DiceBear hair color hex
const HAIR_TO_HEX: Record<string, string> = {
  Black:        '2c1b18',
  BrownDark:    '4a3728',
  Brown:        '724133',
  Auburn:       '922338',
  Blonde:       'f8d568',
  BlondeGolden: 'f9c74f',
  Red:          'd9534f',
  PastelPink:   'f4a7b9',
  Platinum:     'e8e8e8',
  SilverGray:   'a0a0a0',
};

function generateDiceBearSvg(characterId: string, prefs?: AvatarPrefs): string {
  const backgroundColor = prefs?.skinColor ? SKIN_TO_BG[prefs.skinColor] : undefined;
  const hairColor = prefs?.hairColor ? HAIR_TO_HEX[prefs.hairColor] : undefined;

  const avatar = createAvatar(notionists, {
    seed: characterId,
    ...(backgroundColor ? { backgroundColor: [backgroundColor] } : {}),
    ...(hairColor ? { hairColor: [hairColor] } : {}),
  });

  return avatar.toString();
}

function svgToDataUrl(svg: string): string {
  // Encode SVG safely for use as img src
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

// Framer Motion variant maps for each state
const motionVariants = {
  idle: {
    y: [0, -4, 0],
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
  },
  generating: {
    rotate: [-2, 2, -2],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const },
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

// CSS filter per state
function filterForState(state: AvatarState): string {
  switch (state) {
    case 'thinking':   return 'grayscale(20%) brightness(0.95)';
    case 'generating': return 'saturate(1.1)';
    case 'success':    return 'brightness(1.1)';
    default:           return 'none';
  }
}

// Ring glow class per state
function ringClass(state: AvatarState): string {
  switch (state) {
    case 'speaking':   return 'ring-2 ring-teal-400/60 animate-pulse';
    case 'generating': return 'ring-2 ring-amber-400/50';
    case 'success':    return 'ring-2 ring-green-400/70';
    default:           return 'ring-1 ring-border/40';
  }
}

export function AIAvatarDisplay({
  characterId,
  prefs,
  accentColor,
  state = 'idle',
  size = 160,
  name = 'Companion',
}: AIAvatarDisplayProps) {
  const [portraitSrc, setPortraitSrc] = useState<string | null>(null);
  const [diceBearSrc] = useState<string>(() => {
    // Generate synchronously — DiceBear is offline
    try {
      const svg = generateDiceBearSvg(characterId, prefs);
      return svgToDataUrl(svg);
    } catch {
      return '';
    }
  });

  // Load portrait from IndexedDB on mount
  useEffect(() => {
    if (!characterId) return;
    loadAvatarImage(characterId)
      .then((base64) => {
        if (base64) setPortraitSrc(base64);
      })
      .catch(() => {/* silent */});
  }, [characterId]);

  const displaySrc = portraitSrc ?? diceBearSrc;
  const isPortrait = !!portraitSrc;

  return (
    <motion.div
      aria-label={name}
      style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}
      animate={state}
      variants={motionVariants}
    >
      {/* Main avatar image */}
      <div
        className={`w-full h-full rounded-full overflow-hidden ${ringClass(state)} transition-all duration-300`}
        style={{ filter: filterForState(state) }}
      >
        <AnimatePresence mode="wait">
          {displaySrc ? (
            <motion.img
              key={isPortrait ? 'portrait' : 'dicebear'}
              src={displaySrc}
              alt={name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: isPortrait ? 'cover' : 'contain',
                borderRadius: '50%',
              }}
            />
          ) : (
            /* Fallback: accent-colored circle with initial */
            <motion.div
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                width: '100%',
                height: '100%',
                background: accentColor
                  ? `linear-gradient(135deg, ${accentColor}88, ${accentColor}44)`
                  : 'linear-gradient(135deg, #6BBAA788, #D4A85344)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: size * 0.4,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtle accent color overlay ring */}
      {accentColor && (
        <div
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '50%',
            background: `conic-gradient(from 0deg, ${accentColor}40, transparent 60%, ${accentColor}20)`,
            pointerEvents: 'none',
            zIndex: -1,
          }}
        />
      )}

      {/* Thinking overlay — pulsing "···" bubble */}
      {state === 'thinking' && (
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            background: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '2px 6px',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          ···
        </div>
      )}

      {/* Success sparkle particles */}
      {state === 'success' && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accentColor ?? '#D4A853',
                top: '20%',
                left: '50%',
              }}
              animate={{
                x: [(i - 1) * 12, (i - 1) * 28],
                y: [0, -(20 + i * 8)],
                opacity: [1, 0],
                scale: [1, 0.5],
              }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}
