/**
 * AvatarBuilder — compact inline picker for avatar customization during onboarding.
 * Shows swatches / pills for: skin tone, hair style, hair color, eye type, outfit color.
 * Calls onChange on every selection so the parent can update state + persist prefs.
 */
import React from 'react';
import type { AvatarPrefs } from '../../utils/avatarPrefs';

interface AvatarBuilderProps {
  prefs: AvatarPrefs;
  onChange: (next: AvatarPrefs) => void;
}

// ─── Option sets ──────────────────────────────────────────────────────────────

const SKIN_OPTIONS: Array<{ value: string; hex: string; label: string }> = [
  { value: 'Pale',      hex: '#FFDBB4', label: 'Pale'  },
  { value: 'Light',     hex: '#EDB98A', label: 'Light' },
  { value: 'Tanned',    hex: '#D08B5B', label: 'Tan'   },
  { value: 'Brown',     hex: '#AE5D29', label: 'Brown' },
  { value: 'DarkBrown', hex: '#694D3D', label: 'Dark'  },
  { value: 'Black',     hex: '#4A312C', label: 'Deep'  },
  { value: 'Yellow',    hex: '#F8D25C', label: 'Warm'  },
];

const HAIR_STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ShortHairShortWaved',  label: 'Wavy'     },
  { value: 'ShortHairShortFlat',   label: 'Flat'     },
  { value: 'ShortHairShortCurly',  label: 'Curly S'  },
  { value: 'ShortHairDreads01',    label: 'Dreads'   },
  { value: 'LongHairStraight',     label: 'Straight' },
  { value: 'LongHairBob',          label: 'Bob'      },
  { value: 'LongHairCurly',        label: 'Curly L'  },
  { value: 'LongHairBun',          label: 'Bun'      },
  { value: 'NoHair',               label: 'No Hair'  },
];

const HAIR_COLOR_OPTIONS: Array<{ value: string; hex: string; label: string }> = [
  { value: 'Black',       hex: '#2C1B18', label: 'Black'  },
  { value: 'BrownDark',   hex: '#4A312C', label: 'Espresso' },
  { value: 'Brown',       hex: '#724133', label: 'Brown'  },
  { value: 'Auburn',      hex: '#A55728', label: 'Auburn' },
  { value: 'Blonde',      hex: '#B58143', label: 'Blonde' },
  { value: 'BlondeGolden',hex: '#D6B370', label: 'Golden' },
  { value: 'Red',         hex: '#C93305', label: 'Red'    },
  { value: 'PastelPink',  hex: '#F59797', label: 'Pink'   },
  { value: 'Platinum',    hex: '#EDEDEC', label: 'Platinum' },
  { value: 'SilverGray',  hex: '#E8E1E1', label: 'Silver' },
];

const EYE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Default',   label: '😐' },
  { value: 'Happy',     label: '😊' },
  { value: 'Wink',      label: '😉' },
  { value: 'Surprised', label: '😲' },
  { value: 'Squint',    label: '🤨' },
  { value: 'Side',      label: '👀' },
  { value: 'Dizzy',     label: '😵' },
];

const OUTFIT_COLOR_OPTIONS: Array<{ value: string; hex: string; label: string }> = [
  { value: 'PastelBlue',   hex: '#B1E2FF', label: 'Sky'     },
  { value: 'PastelGreen',  hex: '#A7FAD5', label: 'Mint'    },
  { value: 'PastelYellow', hex: '#FFFFB1', label: 'Lemon'   },
  { value: 'PastelOrange', hex: '#FFDEB5', label: 'Peach'   },
  { value: 'PastelRed',    hex: '#FFAFB9', label: 'Rose'    },
  { value: 'Pink',         hex: '#FF488E', label: 'Pink'    },
  { value: 'Red',          hex: '#FF5C5C', label: 'Red'     },
  { value: 'Blue02',       hex: '#5199E4', label: 'Blue'    },
  { value: 'Gray02',       hex: '#929598', label: 'Gray'    },
  { value: 'Black',        hex: '#262E33', label: 'Black'   },
  { value: 'White',        hex: '#F8F8F8', label: 'White'   },
  { value: 'Heather',      hex: '#3C4F5C', label: 'Slate'   },
];

// ─── Row helpers ─────────────────────────────────────────────────────────────

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground mb-2">{children}</p>
  );
}

function SwatchRow({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: string; hex: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {options.map(({ value, hex, label }) => (
        <button
          key={value}
          title={label}
          onClick={() => onSelect(value)}
          className={`flex-shrink-0 w-8 h-8 rounded-full border-2 transition-all ${
            selected === value
              ? 'border-primary scale-110 shadow-md'
              : 'border-border hover:border-primary/50'
          }`}
          style={{ background: hex }}
        />
      ))}
    </div>
  );
}

function PillRow({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            selected === value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-foreground border-border hover:border-primary/40'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AvatarBuilder({ prefs, onChange }: AvatarBuilderProps) {
  const update = (patch: Partial<AvatarPrefs>) => onChange({ ...prefs, ...patch });

  return (
    <div className="space-y-4 text-left">
      <div>
        <RowLabel>Skin tone</RowLabel>
        <SwatchRow
          options={SKIN_OPTIONS}
          selected={prefs.skinColor}
          onSelect={(v) => update({ skinColor: v })}
        />
      </div>

      <div>
        <RowLabel>Hair style</RowLabel>
        <PillRow
          options={HAIR_STYLE_OPTIONS}
          selected={prefs.topType}
          onSelect={(v) => update({ topType: v })}
        />
      </div>
      <div>
        <RowLabel>Hair color</RowLabel>
        <SwatchRow
          options={HAIR_COLOR_OPTIONS}
          selected={prefs.hairColor}
          onSelect={(v) => update({ hairColor: v })}
        />
      </div>

      <div>
        <RowLabel>Eyes</RowLabel>
        <PillRow
          options={EYE_OPTIONS}
          selected={prefs.eyeType}
          onSelect={(v) => update({ eyeType: v })}
        />
      </div>

      <div>
        <RowLabel>Outfit color</RowLabel>
        <SwatchRow
          options={OUTFIT_COLOR_OPTIONS}
          selected={prefs.clotheColor}
          onSelect={(v) => update({ clotheColor: v })}
        />
      </div>
    </div>
  );
}
