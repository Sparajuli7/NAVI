/**
 * LiveAvatar — brings a character's photorealistic portrait to life.
 *
 * The app already generates a free portrait (Pollinations/FLUX) per character and
 * stores it in IndexedDB; this component finally surfaces it and makes it feel
 * present and reactive, so it looks like a real person interacting with the user —
 * with zero new dependencies and no network cost (pure CSS/Framer Motion).
 *
 * States (driven by conversation + TTS signals):
 *   idle       — slow breathing + gentle head-sway + periodic blink
 *   listening  — leans in attentively (user recording / typing)
 *   thinking   — eyes-up drift + slower breathing (LLM generating)
 *   speaking   — fast mouth/jaw bob + equalizer, synced to TTS playback
 *   reacting   — one-shot delighted bounce (e.g. user nailed a phrase)
 *
 * When no portrait exists, it falls back to the emoji CharacterAvatar so every
 * character always has a live presence.
 */
import { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { CharacterAvatar, type CharacterAvatarProps } from './CharacterAvatar';
import { countryFlag } from '../../utils/countryFlag';

export type LiveAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'reacting';

export interface LiveAvatarProps {
  imageSrc?: string | null;
  state: LiveAvatarState;
  sizePx?: number;
  /** Fallback emoji shape + colors/flag source when no portrait is available. */
  character?: CharacterAvatarProps['character'];
  gender?: CharacterAvatarProps['gender'];
  onClick?: () => void;
}

/** Accent color per state — also used by the presence header's status dot. */
export const RING_COLOR: Record<LiveAvatarState, string> = {
  idle: '#6BBAA7',
  listening: '#D4A853',
  thinking: '#8B7FD4',
  speaking: '#6BBAA7',
  reacting: '#7BD48B',
};

/** Map a live state to the emoji-avatar animation for the no-portrait fallback. */
const FALLBACK_ANIM: Record<LiveAvatarState, CharacterAvatarProps['animationState']> = {
  idle: 'idle',
  listening: 'idle',
  thinking: 'generating',
  speaking: 'speaking',
  reacting: 'success',
};

export function LiveAvatar({
  imageSrc,
  state,
  sizePx = 112,
  character,
  gender,
  onClick,
}: LiveAvatarProps) {
  const frame = useAnimationControls();   // head sway / bob / tilt / reaction
  const breath = useAnimationControls();  // subtle scale "breathing"
  const lid = useAnimationControls();     // blink squash
  const shade = useAnimationControls();   // blink darkening

  // ── Per-state motion of the whole head ──────────────────────────────────────
  useEffect(() => {
    frame.stop();
    switch (state) {
      case 'idle':
        frame.start({
          y: [0, -4, 0], rotate: [-1, 1, -1],
          transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'listening':
        frame.start({
          y: 3, scale: 1.03, rotate: 0,
          transition: { duration: 0.5, ease: 'easeOut' },
        });
        break;
      case 'thinking':
        frame.start({
          y: [-2, -6, -2], rotate: [-2.5, 2.5, -2.5],
          transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'speaking':
        frame.start({
          y: [0, -2.5, 0, -1.5, 0], scale: [1, 1.012, 1],
          transition: { duration: 0.32, repeat: Infinity, ease: 'easeInOut' },
        });
        break;
      case 'reacting':
        frame.start({
          y: [0, -12, 0], scale: [1, 1.06, 1], rotate: [0, -3, 3, 0],
          transition: { duration: 0.6, ease: 'easeOut' },
        });
        break;
    }
  }, [state, frame]);

  // ── Breathing (softened while speaking, which has its own bob) ───────────────
  useEffect(() => {
    breath.stop();
    const amount = state === 'speaking' ? 1.008 : state === 'thinking' ? 1.035 : 1.03;
    const duration = state === 'thinking' ? 5.5 : 4;
    breath.start({
      scale: [1, amount, 1],
      transition: { duration, repeat: Infinity, ease: 'easeInOut' },
    });
  }, [state, breath]);

  // ── Blink loop (independent of state, paused while reacting) ─────────────────
  useEffect(() => {
    if (state === 'reacting') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const blinkOnce = async () => {
      if (cancelled) return;
      await Promise.all([
        lid.start({ scaleY: [1, 0.88, 1], transition: { duration: 0.14, ease: 'easeInOut' } }),
        shade.start({ opacity: [0, 0.28, 0], transition: { duration: 0.14, ease: 'easeInOut' } }),
      ]);
      if (cancelled) return;
      timer = setTimeout(blinkOnce, 3200 + Math.random() * 3200);
    };

    timer = setTimeout(blinkOnce, 1500 + Math.random() * 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state, lid, shade]);

  const ring = RING_COLOR[state];
  const flag = countryFlag(character?.location_country ?? '');

  // ── No portrait → animated emoji fallback ───────────────────────────────────
  if (!imageSrc) {
    return (
      <div style={{ display: 'inline-flex' }}>
        <CharacterAvatar
          character={character}
          gender={gender}
          size={sizePx >= 96 ? 'xl' : 'lg'}
          animationState={FALLBACK_ANIM[state]}
          onClick={onClick}
        />
      </div>
    );
  }

  return (
    <motion.div
      animate={frame}
      onClick={onClick}
      style={{
        width: sizePx,
        height: sizePx,
        position: 'relative',
        flexShrink: 0,
        cursor: onClick ? 'pointer' : undefined,
        transformOrigin: 'center bottom',
      }}
    >
      {/* Status glow ring */}
      <motion.div
        animate={
          state === 'speaking'
            ? { boxShadow: [`0 0 0 3px ${ring}55`, `0 0 18px 4px ${ring}aa`, `0 0 0 3px ${ring}55`] }
            : state === 'thinking' || state === 'listening'
              ? { boxShadow: [`0 0 0 3px ${ring}44`, `0 0 12px 2px ${ring}88`, `0 0 0 3px ${ring}44`] }
              : { boxShadow: `0 0 0 3px ${ring}66` }
        }
        transition={{ duration: state === 'speaking' ? 0.5 : 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${ring}, ${ring}00)`,
          padding: 3,
        }}
      >
        {/* Blink squash wrapper */}
        <motion.div
          animate={lid}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            transformOrigin: 'center 42%',
            position: 'relative',
            background: '#0A0A0F',
          }}
        >
          {/* Breathing portrait */}
          <motion.img
            src={imageSrc}
            alt=""
            animate={breath}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              userSelect: 'none',
              pointerEvents: 'none',
              transformOrigin: 'center 40%',
            }}
            draggable={false}
          />
          {/* Blink darkening */}
          <motion.div
            animate={shade}
            style={{
              position: 'absolute',
              inset: 0,
              background: '#000',
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
          {/* Speaking mouth-region glow */}
          {state === 'speaking' && (
            <motion.div
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 0.3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '38%',
                background: `radial-gradient(ellipse at center top, ${ring}66, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Country flag badge */}
      {flag && (
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            fontSize: Math.max(14, sizePx * 0.2),
            lineHeight: 1,
            userSelect: 'none',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        >
          {flag}
        </span>
      )}

      {/* Speaking equalizer / thinking dots */}
      {(state === 'speaking' || state === 'thinking') && (
        <div
          style={{
            position: 'absolute',
            bottom: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 3,
            alignItems: 'flex-end',
            height: 10,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              animate={
                state === 'speaking'
                  ? { height: [3, 9, 4, 8, 3] }
                  : { opacity: [0.3, 1, 0.3] }
              }
              transition={{
                duration: state === 'speaking' ? 0.5 : 1.1,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * (state === 'speaking' ? 0.08 : 0.18),
              }}
              style={{
                width: 3,
                height: 3,
                borderRadius: 2,
                background: ring,
                display: 'block',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
