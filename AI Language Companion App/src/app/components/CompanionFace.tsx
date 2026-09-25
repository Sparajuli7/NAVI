import React from 'react';

const SIZE_PX: Record<string, number> = { xs: 32, sm: 40, md: 56, lg: 80, xl: 112 };
const INITIALS_FONT: Record<string, string> = {
  xs: '11px', sm: '14px', md: '18px', lg: '28px', xl: '40px',
};

export interface CompanionFaceProps {
  imageUrl?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  accentColor?: { primary: string; secondary: string };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CompanionFace({
  imageUrl,
  name,
  size = 'md',
  className,
  accentColor,
}: CompanionFaceProps) {
  const colors = accentColor ?? { primary: '#6BBAA7', secondary: '#D4A853' };
  const px = typeof size === 'number' ? size : (SIZE_PX[size] ?? 56);
  const fontSize = typeof size === 'number'
    ? `${Math.max(10, Math.round(px * 0.32))}px`
    : (INITIALS_FONT[size] ?? '18px');
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <div
        className={className}
        style={{
          width: px,
          height: px,
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${colors.primary}66`,
          boxShadow: `0 0 0 1px ${colors.primary}20`,
        }}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: px,
        height: px,
        flexShrink: 0,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 0 2px ${colors.primary}40`,
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight: 600,
          color: '#F5F0EB',
          letterSpacing: '0.04em',
          userSelect: 'none',
          fontFamily: 'var(--font-display)',
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    </div>
  );
}
