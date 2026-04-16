import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, LayoutList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PhraseDetailSheet } from './PhraseDetailSheet';
import type { PhraseMastery, TrackedPhrase } from '../../agent/core/types';
import type { GeneratedCharacter } from '../../types/character';

interface GraphPhrase {
  id: string;
  text: string;
  mastery: PhraseMastery;
  category: string;
  position: { x: number; y: number };
  connections: string[];
  details: {
    foreign: string;
    phonetic: string;
    meaning: string;
    context: string;
    history: boolean[];
    nextReview: string;
  };
  /** Source phrase for practice callback */
  practiceText?: string;
  /** Set when node is built from learner store */
  sourceTracked?: TrackedPhrase;
}

function countryFlagFromCode(code: string): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function stableJitter(s: string, spread: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000) * spread;
}

function formatNextReviewLabel(nextReviewAt: number, mastery: PhraseMastery): string {
  if (mastery === 'mastered') return 'Mastered';
  const diff = nextReviewAt - Date.now();
  if (diff <= 0) return 'Review now';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (days >= 1) return `Review in ${days} day${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `Review in ${hours} hour${hours > 1 ? 's' : ''}`;
  return 'Review tomorrow';
}

function practiceHistoryFromTracked(tp: TrackedPhrase): boolean[] {
  const attempts = Math.min(8, Math.max(1, tp.attemptCount));
  const struggles = Math.min(attempts, tp.struggleCount ?? 0);
  const successes = Math.max(0, attempts - struggles);
  const row: boolean[] = [];
  for (let i = 0; i < successes; i++) row.push(true);
  for (let i = 0; i < struggles; i++) row.push(false);
  return row.slice(0, 8);
}

function trackedToGraphPhrases(phrases: TrackedPhrase[]): GraphPhrase[] {
  const n = phrases.length;
  return phrases.map((tp, idx) => {
    const angle = (idx / Math.max(n, 1)) * Math.PI * 2;
    const radius = 22 + stableJitter(tp.phrase, 18);
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const cat = (tp.learnedAt || 'Your phrases').toUpperCase();
    return {
      id: `tp_${tp.firstSeen}_${idx}`,
      text: tp.phrase,
      mastery: tp.mastery,
      category: cat,
      position: { x, y },
      connections: [],
      practiceText: tp.phrase,
      sourceTracked: tp,
      details: {
        foreign: tp.phrase,
        phonetic: tp.pronunciation ?? '',
        meaning: tp.meaning ?? '',
        context: tp.learnedAt
          ? `You picked this up while in ${tp.learnedAt}.`
          : 'Saved from your chats with NAVI.',
        history: practiceHistoryFromTracked(tp),
        nextReview: formatNextReviewLabel(tp.nextReviewAt, tp.mastery),
      },
    };
  });
}

function resolveDemoRegion(
  location: string,
  countryCode?: string
): 'Vietnam' | 'France' | 'Japan' {
  const lower = `${location} ${countryCode ?? ''}`.toLowerCase();
  if (
    lower.includes('vietnam') ||
    lower.includes('hanoi') ||
    lower.includes('saigon') ||
    lower.includes('ho chi') ||
    lower.includes('vn')
  ) {
    return 'Vietnam';
  }
  if (
    lower.includes('france') ||
    lower.includes('paris') ||
    lower.includes('lyon') ||
    lower.includes('marseille') ||
    lower.includes('fr')
  ) {
    return 'France';
  }
  if (
    lower.includes('japan') ||
    lower.includes('tokyo') ||
    lower.includes('osaka') ||
    lower.includes('kyoto') ||
    lower.includes('jp')
  ) {
    return 'Japan';
  }
  if (countryCode?.toUpperCase() === 'VN') return 'Vietnam';
  if (countryCode?.toUpperCase() === 'FR') return 'France';
  if (countryCode?.toUpperCase() === 'JP') return 'Japan';
  return 'Vietnam';
}

type DemoPack = {
  flag: string;
  language: string;
  phrases: Omit<GraphPhrase, 'id' | 'position' | 'connections'>[];
};

const DEMO_PHRASES: Record<'Vietnam' | 'France' | 'Japan', DemoPack> = {
  Vietnam: {
    flag: '🇻🇳',
    language: 'Vietnamese',
    phrases: [
      {
        text: 'Tính tiền',
        mastery: 'mastered',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'Tính tiền giùm',
          phonetic: 'Tin tee-en zoom',
          meaning: 'Can I get the bill?',
          context:
            'Use this casual phrase at local restaurants. Many locals also use a writing gesture in the air.',
          history: [true, true, false, true, true, true],
          nextReview: 'Mastered',
        },
      },
      {
        text: 'Cảm ơn',
        mastery: 'mastered',
        category: 'GREETINGS',
        details: {
          foreign: 'Cảm ơn',
          phonetic: 'Kahm un',
          meaning: 'Thank you',
          context: 'Add "nhiều" at the end for "thank you very much".',
          history: [true, true, true, true, true, true],
          nextReview: 'Mastered',
        },
      },
      {
        text: 'Xin lỗi',
        mastery: 'practiced',
        category: 'GREETINGS',
        details: {
          foreign: 'Xin lỗi',
          phonetic: 'Sin loy',
          meaning: 'Sorry / Excuse me',
          context: 'Apologize or get attention politely — essential in busy markets.',
          history: [true, false, true, true, false, true],
          nextReview: 'Review in 3 days',
        },
      },
      {
        text: 'Bao nhiêu?',
        mastery: 'learning',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'Bao nhiêu tiền?',
          phonetic: 'Bow nyew tee-en',
          meaning: 'How much does it cost?',
          context: 'Essential at markets; vendors appreciate the effort.',
          history: [true, false, false, true, false],
          nextReview: 'Review tomorrow',
        },
      },
      {
        text: 'Không cay',
        mastery: 'new',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'Không cay',
          phonetic: 'Khome kai',
          meaning: 'Not spicy',
          context: 'Say when ordering if you want a milder version.',
          history: [false, false],
          nextReview: 'Review now',
        },
      },
      {
        text: 'Ở đâu?',
        mastery: 'learning',
        category: 'DIRECTIONS',
        details: {
          foreign: '...ở đâu?',
          phonetic: 'Uh dow',
          meaning: 'Where is...?',
          context: 'Put the place name before this phrase to ask directions.',
          history: [true, false, true, false],
          nextReview: 'Review in 2 days',
        },
      },
      {
        text: 'Ngon quá',
        mastery: 'practiced',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'Ngon quá!',
          phonetic: 'Ngon kwa',
          meaning: 'Delicious!',
          context: 'Compliment the cook or vendor — they will notice.',
          history: [true, true, false, true, true],
          nextReview: 'Review in 4 days',
        },
      },
      {
        text: 'Tôi không hiểu',
        mastery: 'practiced',
        category: 'ASKING FOR HELP',
        details: {
          foreign: 'Tôi không hiểu',
          phonetic: 'Toy khome hee-ew',
          meaning: "I don't understand",
          context: 'Polite way to ask someone to repeat or simplify.',
          history: [true, true, true, false, true],
          nextReview: 'Review in 5 days',
        },
      },
    ],
  },
  France: {
    flag: '🇫🇷',
    language: 'French',
    phrases: [
      {
        text: 'Bonjour',
        mastery: 'mastered',
        category: 'GREETINGS',
        details: {
          foreign: 'Bonjour',
          phonetic: 'bon-ZHOOR',
          meaning: 'Hello / Good day',
          context: 'Greet when entering shops — it is expected in France.',
          history: [true, true, true, true, true, true],
          nextReview: 'Mastered',
        },
      },
      {
        text: 'Merci',
        mastery: 'mastered',
        category: 'GREETINGS',
        details: {
          foreign: 'Merci beaucoup',
          phonetic: 'mehr-SEE bo-KOO',
          meaning: 'Thank you very much',
          context: 'Use "merci" alone in casual situations.',
          history: [true, true, true, true, true],
          nextReview: 'Mastered',
        },
      },
      {
        text: "L'addition",
        mastery: 'practiced',
        category: 'FOOD & DRINK',
        details: {
          foreign: "L'addition, s'il vous plaît",
          phonetic: 'lah-dee-SYON seel voo PLEH',
          meaning: 'The bill, please',
          context: 'Polite at restaurants; wait for the server to bring it.',
          history: [true, false, true, true, true],
          nextReview: 'Review in 3 days',
        },
      },
      {
        text: 'Excusez-moi',
        mastery: 'practiced',
        category: 'GREETINGS',
        details: {
          foreign: 'Excusez-moi',
          phonetic: 'ex-kew-zay-MWAH',
          meaning: 'Excuse me',
          context: 'Attention or a light apology.',
          history: [true, true, false, true, true],
          nextReview: 'Review in 2 days',
        },
      },
      {
        text: 'Où est...?',
        mastery: 'learning',
        category: 'DIRECTIONS',
        details: {
          foreign: 'Où est...?',
          phonetic: 'oo eh',
          meaning: 'Where is...?',
          context: 'Follow with the place you need.',
          history: [true, false, true, false],
          nextReview: 'Review tomorrow',
        },
      },
      {
        text: 'Je ne comprends pas',
        mastery: 'new',
        category: 'ASKING FOR HELP',
        details: {
          foreign: 'Je ne comprends pas',
          phonetic: 'zhuh nuh kom-PRAHN pah',
          meaning: "I don't understand",
          context: 'Ask for a repeat or slower speech.',
          history: [false, false],
          nextReview: 'Review now',
        },
      },
      {
        text: "C'est délicieux",
        mastery: 'learning',
        category: 'FOOD & DRINK',
        details: {
          foreign: "C'est délicieux",
          phonetic: 'seh day-lee-SYUH',
          meaning: "It's delicious",
          context: 'Great compliment after a meal.',
          history: [true, false, true],
          nextReview: 'Review in 1 day',
        },
      },
      {
        text: 'Combien?',
        mastery: 'practiced',
        category: 'FOOD & DRINK',
        details: {
          foreign: "C'est combien?",
          phonetic: 'seh kom-BYEN',
          meaning: 'How much is it?',
          context: 'Use when shopping; add "ça" for "how much is this?"',
          history: [true, true, false, true],
          nextReview: 'Review in 4 days',
        },
      },
    ],
  },
  Japan: {
    flag: '🇯🇵',
    language: 'Japanese',
    phrases: [
      {
        text: 'こんにちは',
        mastery: 'mastered',
        category: 'GREETINGS',
        details: {
          foreign: 'こんにちは',
          phonetic: 'kon-nee-chee-wah',
          meaning: 'Hello / Good afternoon',
          context: 'Use "ohayō" in the morning and "konbanwa" in the evening.',
          history: [true, true, true, true, true, true],
          nextReview: 'Mastered',
        },
      },
      {
        text: 'ありがとう',
        mastery: 'practiced',
        category: 'GREETINGS',
        details: {
          foreign: 'ありがとうございます',
          phonetic: 'ah-ree-GAH-toh goh-zai-MAHS',
          meaning: 'Thank you (polite)',
          context: 'Casual "arigatō" with friends.',
          history: [true, true, false, true, true, false],
          nextReview: 'Review in 2 days',
        },
      },
      {
        text: 'すみません',
        mastery: 'practiced',
        category: 'GREETINGS',
        details: {
          foreign: 'すみません',
          phonetic: 'soo-mee-mah-sen',
          meaning: 'Excuse me / Sorry',
          context: 'Apology, attention, or polite request.',
          history: [true, false, true, true, true],
          nextReview: 'Review in 3 days',
        },
      },
      {
        text: 'お会計',
        mastery: 'learning',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'お会計お願いします',
          phonetic: 'oh-kai-keh oh-neh-gai-shee-mahs',
          meaning: 'Check, please',
          context: 'Often paired with a small cross gesture with the hands.',
          history: [true, false, false, true],
          nextReview: 'Review tomorrow',
        },
      },
      {
        text: 'いくらですか',
        mastery: 'new',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'いくらですか？',
          phonetic: 'ee-koo-rah dess-kah',
          meaning: 'How much is it?',
          context: 'Point at the item while asking.',
          history: [false, false],
          nextReview: 'Review now',
        },
      },
      {
        text: 'どこですか',
        mastery: 'learning',
        category: 'DIRECTIONS',
        details: {
          foreign: '...はどこですか？',
          phonetic: 'wah doh-koh dess-kah',
          meaning: 'Where is...?',
          context: 'Place name + this phrase.',
          history: [true, false, true, false],
          nextReview: 'Review in 1 day',
        },
      },
      {
        text: 'おいしい',
        mastery: 'practiced',
        category: 'FOOD & DRINK',
        details: {
          foreign: 'おいしいです',
          phonetic: 'oh-ee-SHEE dess',
          meaning: "It's delicious",
          context: 'Compliment the meal.',
          history: [true, true, true, false, true],
          nextReview: 'Review in 5 days',
        },
      },
      {
        text: 'わかりません',
        mastery: 'new',
        category: 'ASKING FOR HELP',
        details: {
          foreign: 'わかりません',
          phonetic: 'wah-kah-ree-mah-sen',
          meaning: "I don't understand",
          context: 'Signals you need help or repetition.',
          history: [false],
          nextReview: 'Review now',
        },
      },
    ],
  },
};

function buildDemoGraph(region: 'Vietnam' | 'France' | 'Japan'): GraphPhrase[] {
  const pack = DEMO_PHRASES[region];
  const n = pack.phrases.length;
  return pack.phrases.map((p, idx) => {
    const angle = (idx / n) * Math.PI * 2;
    const radius = 25 + stableJitter(p.text, 15);
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    return {
      ...p,
      id: `demo_${region}_${idx}`,
      position: { x, y },
      connections: [],
      practiceText: p.details.foreign,
    };
  });
}

function wireCategoryConnections(phrases: GraphPhrase[]): void {
  phrases.forEach((phrase) => {
    const sameCategory = phrases
      .filter((p) => p.category === phrase.category && p.id !== phrase.id)
      .slice(0, 2);
    phrase.connections = sameCategory.map((p) => p.id);
  });
}

const masteryColors: Record<PhraseMastery, string> = {
  new: '#EF4444',
  learning: '#F59E0B',
  practiced: '#6BBAA7',
  mastered: '#D4A853',
};

type FilterType = 'all' | 'struggling' | 'due' | 'mastered';

export interface KnowledgeGraphScreenProps {
  onBack: () => void;
  /** Optional: open list-style phrase deck */
  onOpenFlashcards?: () => void;
  character: GeneratedCharacter;
  location: string;
  countryCode?: string;
  /** Learner-tracked phrases; when empty, location-based demo phrases are shown */
  trackedPhrases: TrackedPhrase[];
  /** Display name for target language (subtitle) */
  languageLabel?: string;
  onPracticePhrase?: (phrase: string) => void;
}

export function KnowledgeGraphScreen({
  onBack,
  onOpenFlashcards,
  character: _character,
  location,
  countryCode,
  trackedPhrases,
  languageLabel,
  onPracticePhrase,
}: KnowledgeGraphScreenProps) {
  void _character;
  const [selectedPhrase, setSelectedPhrase] = useState<GraphPhrase | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const usingLiveData = trackedPhrases.length > 0;

  const { graphPhrases, flag, languageTitle } = useMemo(() => {
    if (usingLiveData) {
      const list = trackedToGraphPhrases(trackedPhrases);
      wireCategoryConnections(list);
      const flagEmoji = countryFlagFromCode(countryCode ?? '');
      return {
        graphPhrases: list,
        flag: flagEmoji || '🌐',
        languageTitle: languageLabel ?? 'Your phrases',
      };
    }
    const region = resolveDemoRegion(location, countryCode);
    const pack = DEMO_PHRASES[region];
    const list = buildDemoGraph(region);
    wireCategoryConnections(list);
    return {
      graphPhrases: list,
      flag: pack.flag,
      languageTitle: pack.language,
    };
  }, [trackedPhrases, location, countryCode, languageLabel, usingLiveData]);

  const filteredPhrases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return graphPhrases.filter((phrase) => {
      if (q) {
        const blob = `${phrase.text} ${phrase.details.foreign} ${phrase.details.meaning}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (activeFilter === 'all') return true;
      if (usingLiveData) {
        const tp = phrase.sourceTracked;
        if (activeFilter === 'struggling')
          return tp ? (tp.struggleCount ?? 0) > 0 : false;
        if (activeFilter === 'due') {
          if (!tp) return false;
          return tp.nextReviewAt <= Date.now() && tp.mastery !== 'mastered';
        }
        if (activeFilter === 'mastered') return phrase.mastery === 'mastered';
        return true;
      }
      if (activeFilter === 'struggling')
        return phrase.mastery === 'new' || phrase.mastery === 'learning';
      if (activeFilter === 'due')
        return (
          phrase.details.nextReview !== 'Mastered' &&
          (phrase.details.nextReview === 'Review now' ||
            phrase.details.nextReview === 'Review tomorrow')
        );
      if (activeFilter === 'mastered') return phrase.mastery === 'mastered';
      return true;
    });
  }, [graphPhrases, activeFilter, searchQuery, usingLiveData, trackedPhrases]);

  const dueCount = useMemo(() => {
    if (usingLiveData) {
      return trackedPhrases.filter(
        (p) => p.nextReviewAt <= Date.now() && p.mastery !== 'mastered'
      ).length;
    }
    return graphPhrases.filter(
      (p) =>
        p.details.nextReview !== 'Mastered' &&
        (p.details.nextReview === 'Review now' || p.details.nextReview === 'Review tomorrow')
    ).length;
  }, [graphPhrases, trackedPhrases, usingLiveData]);

  const categories = useMemo(
    () => Array.from(new Set(graphPhrases.map((p) => p.category))),
    [graphPhrases]
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-20 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 hover:bg-muted/50 rounded-lg transition-colors -ml-2"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="text-center min-w-0 flex-1 px-2">
          <h1 className="font-serif text-lg text-foreground truncate">My Dictionary</h1>
          <p className="text-[11px] text-muted-foreground truncate">{languageTitle}</p>
        </div>

        <div className="flex items-center gap-1">
          {onOpenFlashcards && (
            <button
              type="button"
              onClick={onOpenFlashcards}
              className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
              title="Card deck"
            >
              <LayoutList className="w-5 h-5 text-primary" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
            title="Search phrases"
          >
            <Search className="w-5 h-5 text-primary" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-card/80 shrink-0">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}

      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-border/50 bg-card/50 shrink-0">
        {(['all', 'struggling', 'due', 'mastered'] as FilterType[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter
                ? 'bg-primary text-primary-foreground'
                : 'border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {filter === 'all' && 'All'}
            {filter === 'struggling' && 'Struggling'}
            {filter === 'due' && 'Due Now'}
            {filter === 'mastered' && 'Mastered'}
          </button>
        ))}
      </div>

      {!usingLiveData && (
        <p className="text-[11px] text-center text-muted-foreground px-4 py-1.5 shrink-0 border-b border-border/30">
          Sample phrases for {languageTitle} — chat with NAVI to build your real phrase map.
        </p>
      )}

      <div
        className="flex-1 relative min-h-0 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(107, 186, 167, 0.03) 0%, transparent 70%)',
        }}
      >
        {categories.map((category) => {
          const categoryPhrases = filteredPhrases.filter((p) => p.category === category);
          if (categoryPhrases.length === 0) return null;

          const avgX =
            categoryPhrases.reduce((sum, p) => sum + p.position.x, 0) / categoryPhrases.length;
          const avgY =
            categoryPhrases.reduce((sum, p) => sum + p.position.y, 0) / categoryPhrases.length;

          return (
            <div
              key={category}
              className="absolute pointer-events-none"
              style={{
                left: `${avgX}%`,
                top: `${avgY}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="rounded-full blur-3xl"
                style={{
                  width: '220px',
                  height: '220px',
                  background: 'rgba(107, 186, 167, 0.05)',
                }}
              />
              <p className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 text-[10px] font-medium tracking-wider text-primary/70 whitespace-nowrap">
                {category}
              </p>
            </div>
          );
        })}

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {filteredPhrases.map((phrase) =>
            phrase.connections.map((connId) => {
              const connectedPhrase = filteredPhrases.find((p) => p.id === connId);
              if (!connectedPhrase) return null;
              return (
                <line
                  key={`${phrase.id}-${connId}`}
                  x1={phrase.position.x}
                  y1={phrase.position.y}
                  x2={connectedPhrase.position.x}
                  y2={connectedPhrase.position.y}
                  stroke="#6BBAA7"
                  strokeWidth="0.15"
                  opacity={0.25}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          )}
        </svg>

        {filteredPhrases.map((phrase) => (
          <motion.button
            key={phrase.id}
            type="button"
            className="absolute"
            style={{
              left: `${phrase.position.x}%`,
              top: `${phrase.position.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
            onClick={() => setSelectedPhrase(phrase)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-md"
                style={{
                  width: '56px',
                  height: '56px',
                  background: masteryColors[phrase.mastery],
                  opacity: 0.35,
                }}
              />
              <div
                className="relative w-14 h-14 rounded-full bg-card border-2 flex items-center justify-center overflow-hidden"
                style={{
                  borderColor: masteryColors[phrase.mastery],
                  boxShadow: `0 0 12px ${masteryColors[phrase.mastery]}40`,
                }}
              >
                <p className="text-[10px] font-serif text-foreground text-center px-1 leading-tight line-clamp-2 max-w-full break-words">
                  {phrase.text.split(/\s+/).slice(0, 2).join(' ')}
                </p>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border text-[10px] leading-none">
                {flag}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {dueCount > 0 && (
        <motion.div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="px-4 py-2 bg-amber-500 text-white rounded-full text-xs font-medium shadow-lg">
            {dueCount} phrase{dueCount > 1 ? 's' : ''} due for review
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {selectedPhrase && (
          <PhraseDetailSheet
            phrase={selectedPhrase.details}
            mastery={selectedPhrase.mastery}
            onClose={() => setSelectedPhrase(null)}
            onPractice={() => {
              const t = selectedPhrase.practiceText ?? selectedPhrase.text;
              onPracticePhrase?.(t);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
