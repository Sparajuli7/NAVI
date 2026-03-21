/**
 * CharacterAvatar — Emoji-based avatar with gradient ring + country flag badge.
 *
 * Replaces the SVG/avataaars-based AvatarDisplay at all call sites.
 * Gender is read from appStore.userPreferences.avatar_gender (no prop-drilling needed).
 *
 * Emoji is derived from template_id + gender — natively gendered, offline, OS-rendered.
 * Country flag badge uses Unicode regional indicator trick.
 *
 * Animations (Framer Motion):
 *   idle       — gentle float up/down (continuous)
 *   speaking   — scale pulse (continuous)
 *   generating — rotate sway (continuous)
 *   success    — bounce (once)
 *   none       — static
 */
import React, { useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { useAppStore } from '../../stores/appStore';

// ─── Emoji map ─────────────────────────────────────────────────────────────

const TEMPLATE_EMOJI: Record<string, { female: string; male: string; neutral: string }> = {
  street_food_guide:   { female: '👩‍🍳', male: '👨‍🍳', neutral: '🧑‍🍳' },
  form_helper:         { female: '👩‍💼', male: '👨‍💼', neutral: '🧑‍💼' },
  pronunciation_tutor: { female: '👩‍🏫', male: '👨‍🏫', neutral: '🧑‍🏫' },
  travel_companion:    { female: '👩‍✈️', male: '👨‍✈️', neutral: '🧑‍✈️' },
  social_guide:        { female: '👩', male: '👨', neutral: '🧑' },
};

function resolveEmoji(templateId?: string | null, gender?: string): string {
  const key = gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'neutral';
  if (templateId && TEMPLATE_EMOJI[templateId]) {
    return TEMPLATE_EMOJI[templateId][key];
  }
  if (gender === 'female') return '👩';
  if (gender === 'male') return '👨';
  return '🧑';
}

function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '';
  return cc.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(c.charCodeAt(0) + 127397),
  );
}

// ─── Size maps ─────────────────────────────────────────────────────────────

const SIZE_PX: Record<string, number> = { xs: 32, sm: 44, md: 56, lg: 80, xl: 112 };
const EMOJI_FONT: Record<string, string> = {
  xs: '16px', sm: '22px', md: '28px', lg: '44px', xl: '60px',
};
const FLAG_FONT: Record<string, string> = {
  xs: '10px', sm: '13px', md: '15px', lg: '20px', xl: '28px',
};

// ─── Types ─────────────────────────────────────────────────────────────────

export type CharacterAvatarAnimation = 'idle' | 'speaking' | 'generating' | 'success' | 'none';

export interface CharacterAvatarProps {
  character?: {
    /** Full Character type uses avatar_color */
    avatar_color?: { primary: string; secondary: string; accent?: string };
    /** Onboarding + bubble types use colors */
    colors?: { primary: string; secondary: string; accent?: string };
    template_id?: string | null;
    location_country?: string;
    name?: string;
  };
  /** Override gender — if omitted, reads from appStore.userPreferences.avatar_gender */
  gender?: 'male' | 'female' | 'non-binary' | 'no_preference';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animationState?: CharacterAvatarAnimation;
  onClick?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function CharacterAvatar({
  character,
  gender,
  size = 'md',
  animationState = 'idle',
  onClick,
}: CharacterAvatarProps) {
  const storeGender = useAppStore((s) => s.userPreferences.avatar_gender);
  const resolvedGender = gender ?? storeGender;

  const colors = character?.avatar_color ?? character?.colors ?? {
    primary: '#6BBAA7',
    secondary: '#D4A853',
  };
  const emoji = resolveEmoji(character?.template_id, resolvedGender);
  const flag = countryFlag(character?.location_country ?? '');
  const px = SIZE_PX[size] ?? 56;

  const controls = useAnimation();

  useEffect(() => {
    controls.stop();
    if (animationState === 'idle') {
      controls.start({
        y: [0, -6, 0],
        transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      });
    } else if (animationState === 'speaking') {
      controls.start({
        scale: [1, 1.04, 1],
        transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
      });
    } else if (animationState === 'generating') {
      controls.start({
        rotate: [0, 8, -8, 0],
        transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' },
      });
    } else if (animationState === 'success') {
      controls.start({
        y: [0, -12, 0],
        transition: { duration: 0.4, repeat: 0, ease: 'easeOut' },
      });
    }
  }, [animationState, controls]);

  return (
    <motion.div
      animate={controls}
      style={{
        width: px,
        height: px,
        flexShrink: 0,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
    >
      {/* Gradient ring */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 2px ${colors.primary}40`,
        }}
      >
        <span style={{ fontSize: EMOJI_FONT[size], lineHeight: 1, userSelect: 'none' }}>
          {emoji}
        </span>
      </div>

      {/* Country flag badge */}
      {flag && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            fontSize: FLAG_FONT[size],
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
