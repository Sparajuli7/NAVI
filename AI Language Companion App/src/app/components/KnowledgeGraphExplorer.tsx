/**
 * Knowledge Graph Explorer
 *
 * Visual display of the user's learning memory graph, accessible
 * from the avatar's chat screen. Shows terms learned, their
 * relationships, encounter contexts, and mastery progression.
 *
 * Reads directly from KnowledgeGraphStore (not flat TrackedPhrase[]).
 * Designed as an expandable overlay (z-[44]) with three views:
 * - Terms grid: all terms with mastery colors, encounter badges, engagement bars
 * - Connections: selected term → related terms, scenario, avatar, location
 * - Timeline: conversations sorted by date with engagement heatmap
 */

import React, { useMemo, useState, useCallback } from 'react';
import { ArrowLeft, Search, X, Globe, User, MapPin, BookOpen, Flame, AlertTriangle, Zap, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  TermNode,
  ConversationNode,
  TopicNode,
  ScenarioNode,
  LocationNode,
  AvatarGraphNode,
  PhraseMastery,
  EncounterType,
  ConversationMood,
  FilterMode,
} from '../../agent/core/types';
import type { KnowledgeGraphStore } from '../../agent/memory/knowledgeGraph';

// ─── Props ──────────────────────────────────────────────────────

interface KnowledgeGraphExplorerProps {
  graph: KnowledgeGraphStore;
  onBack: () => void;
  onPracticePhrase?: (phrase: string) => void;
  characterName?: string;
}

// ─── Constants ──────────────────────────────────────────────────

const MASTERY_COLORS: Record<PhraseMastery, { bg: string; border: string; text: string; label: string }> = {
  new:       { bg: 'bg-red-500/10',    border: 'border-red-400',    text: 'text-red-400',    label: 'New' },
  learning:  { bg: 'bg-amber-500/10',  border: 'border-amber-400',  text: 'text-amber-400',  label: 'Learning' },
  practiced: { bg: 'bg-teal-500/10',   border: 'border-teal-400',   text: 'text-teal-400',   label: 'Practiced' },
  mastered:  { bg: 'bg-[#D4A853]/10',  border: 'border-[#D4A853]',  text: 'text-[#D4A853]',  label: 'Mastered' },
};

const ENCOUNTER_ICONS: Record<EncounterType, { icon: string; label: string }> = {
  scenario:  { icon: '🎭', label: 'In scenario' },
  organic:   { icon: '💬', label: 'Organic chat' },
  requested: { icon: '🙋', label: 'You asked' },
  corrected: { icon: '✏️', label: 'Corrected' },
  overheard: { icon: '👂', label: 'Overheard' },
};

const MOOD_ICONS: Record<ConversationMood, string> = {
  curious: '🧐', frustrated: '😤', confident: '😎', neutral: '😐', struggling: '😓',
};

type ViewMode = 'terms' | 'detail' | 'timeline';

// ─── Helpers ────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function engagementBar(score: number): string {
  const filled = Math.round(score * 5);
  return '●'.repeat(filled) + '○'.repeat(5 - filled);
}

// ─── Component ──────────────────────────────────────────────────

export function KnowledgeGraphExplorer({ graph, onBack, onPracticePhrase, characterName }: KnowledgeGraphExplorerProps) {
  const [view, setView] = useState<ViewMode>('terms');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // ── Data from graph ─────────────────────────────────────────

  const terms = useMemo(() =>
    graph.getNodesByType<TermNode>('term')
      .sort((a, b) => b.lastPracticed - a.lastPracticed),
    [graph],
  );

  const conversations = useMemo(() =>
    graph.getNodesByType<ConversationNode>('conversation')
      .sort((a, b) => b.createdAt - a.createdAt),
    [graph],
  );

  const topics = useMemo(() =>
    graph.getNodesByType<TopicNode>('topic'),
    [graph],
  );

  const stats = useMemo(() => graph.getStats(), [graph]);

  // ── Filtered terms ──────────────────────────────────────────

  const filteredTerms = useMemo(() => {
    let result = terms;
    if (filter === 'struggling') result = result.filter(t => t.struggleCount > 0 && t.mastery !== 'mastered');
    if (filter === 'due') result = result.filter(t => t.nextReviewAt <= Date.now() && t.mastery !== 'mastered');
    if (filter === 'mastered') result = result.filter(t => t.mastery === 'mastered');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.phrase.toLowerCase().includes(q) ||
        (t.meaning ?? '').toLowerCase().includes(q) ||
        t.inferredReason.toLowerCase().includes(q),
      );
    }
    return result;
  }, [terms, filter, searchQuery]);

  // ── Selected term detail ────────────────────────────────────

  const selectedTerm = useMemo(() =>
    selectedTermId ? graph.getNode<TermNode>(selectedTermId) : null,
    [selectedTermId, graph],
  );

  const selectedConversations = useMemo(() =>
    selectedTermId ? graph.getConversationsForTerm(selectedTermId) : [],
    [selectedTermId, graph],
  );

  const selectedRelated = useMemo(() =>
    selectedTermId ? graph.getRelatedTerms(selectedTermId) : [],
    [selectedTermId, graph],
  );

  const handleTermClick = useCallback((termId: string) => {
    setSelectedTermId(termId);
    setView('detail');
  }, []);

  const handleBackToTerms = useCallback(() => {
    setSelectedTermId(null);
    setView('terms');
  }, []);

  // ── Filter counts ───────────────────────────────────────────

  const filterCounts = useMemo(() => ({
    all: terms.length,
    struggling: terms.filter(t => t.struggleCount > 0 && t.mastery !== 'mastered').length,
    due: terms.filter(t => t.nextReviewAt <= Date.now() && t.mastery !== 'mastered').length,
    mastered: terms.filter(t => t.mastery === 'mastered').length,
  }), [terms]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[44] bg-[var(--bg-primary,#0A0A0F)] overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between border-b border-white/10 bg-[var(--bg-primary,#0A0A0F)]/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={view === 'detail' ? handleBackToTerms : onBack}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} className="text-[#F5F0EB]" />
          </button>
          <div>
            <h2 className="text-[#F5F0EB] font-semibold text-base leading-tight">
              {view === 'detail' ? 'Term Detail' : view === 'timeline' ? 'Conversations' : 'Memory Graph'}
            </h2>
            <p className="text-[#F5F0EB]/50 text-xs">
              {stats.termCount} terms · {stats.conversationCount} conversations · {stats.topicCount} topics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <Search size={18} className="text-[#F5F0EB]/60" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 overflow-hidden"
          >
            <div className="py-2 flex items-center gap-2 border-b border-white/5">
              <Search size={16} className="text-[#F5F0EB]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search terms, meanings, reasons..."
                className="flex-1 bg-transparent text-[#F5F0EB] text-sm outline-none placeholder:text-[#F5F0EB]/30"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={14} className="text-[#F5F0EB]/40" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View tabs */}
      {view !== 'detail' && (
        <div className="px-4 pt-3 pb-1 flex gap-2">
          {(['terms', 'timeline'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                view === v ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-white/5 text-[#F5F0EB]/50'
              }`}
            >
              {v === 'terms' ? `Terms (${stats.termCount})` : `Timeline (${stats.conversationCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Filter tabs (terms view only) */}
      {view === 'terms' && (
        <div className="px-4 pt-2 pb-2 flex gap-2 overflow-x-auto">
          {(['all', 'struggling', 'due', 'mastered'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f ? 'bg-[#6BBAA7]/20 text-[#6BBAA7]' : 'bg-white/5 text-[#F5F0EB]/40'
              }`}
            >
              {f === 'all' ? 'All' : f === 'struggling' ? '⚡ Struggling' : f === 'due' ? '⏰ Due' : '🏆 Mastered'}
              {filterCounts[f] > 0 && ` (${filterCounts[f]})`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {/* Terms Grid View */}
        {view === 'terms' && (
          <div className="space-y-2 pt-2">
            {filteredTerms.length === 0 && (
              <div className="text-center py-12">
                <BookOpen size={40} className="mx-auto text-[#F5F0EB]/20 mb-3" />
                <p className="text-[#F5F0EB]/40 text-sm">
                  {terms.length === 0
                    ? 'Start chatting to build your memory graph'
                    : 'No terms match this filter'}
                </p>
              </div>
            )}
            {filteredTerms.map((term, i) => (
              <TermCard
                key={term.id}
                term={term}
                index={i}
                onTap={() => handleTermClick(term.id)}
                onPractice={onPracticePhrase}
              />
            ))}
          </div>
        )}

        {/* Term Detail View */}
        {view === 'detail' && selectedTerm && (
          <TermDetailView
            term={selectedTerm}
            conversations={selectedConversations}
            relatedTerms={selectedRelated}
            graph={graph}
            onPractice={onPracticePhrase}
            onTermClick={handleTermClick}
          />
        )}

        {/* Timeline View */}
        {view === 'timeline' && (
          <div className="space-y-3 pt-2">
            {conversations.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle size={40} className="mx-auto text-[#F5F0EB]/20 mb-3" />
                <p className="text-[#F5F0EB]/40 text-sm">No conversations recorded yet</p>
              </div>
            )}
            {conversations.map((conv, i) => (
              <ConversationCard key={conv.id} conv={conv} graph={graph} index={i} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Term Card ──────────────────────────────────────────────────

function TermCard({ term, index, onTap, onPractice }: {
  term: TermNode;
  index: number;
  onTap: () => void;
  onPractice?: (phrase: string) => void;
}) {
  const mc = MASTERY_COLORS[term.mastery];
  const enc = ENCOUNTER_ICONS[term.encounterType];
  const isDue = term.nextReviewAt <= Date.now() && term.mastery !== 'mastered';

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onTap}
      className={`w-full text-left rounded-xl border ${mc.border}/30 ${mc.bg} p-3 transition-all hover:border-opacity-60 active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Phrase */}
          <p className="text-[#F5F0EB] font-serif text-lg leading-tight truncate">{term.phrase}</p>
          {/* Pronunciation + meaning */}
          <p className="text-[#F5F0EB]/50 text-xs mt-0.5 truncate">
            {term.pronunciation && <span className="italic">{term.pronunciation}</span>}
            {term.pronunciation && term.meaning && <span> — </span>}
            {term.meaning && <span>{term.meaning}</span>}
          </p>
        </div>
        {/* Mastery badge */}
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${mc.bg} ${mc.text} border ${mc.border}/40 whitespace-nowrap`}>
          {mc.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-[#F5F0EB]/40">
        {/* Encounter type */}
        <span title={enc.label}>{enc.icon} {enc.label}</span>
        {/* Engagement */}
        <span className={mc.text} title={`Engagement: ${(term.metadata.engagementScore * 100).toFixed(0)}%`}>
          {engagementBar(term.metadata.engagementScore)}
        </span>
        {/* Attempts */}
        <span>{term.attemptCount}x practiced</span>
        {/* Struggle indicator */}
        {term.struggleCount > 0 && (
          <span className="text-amber-400">⚡{term.struggleCount} struggled</span>
        )}
        {/* Due badge */}
        {isDue && (
          <span className="text-red-400 font-semibold">⏰ Due</span>
        )}
      </div>

      {/* Reason */}
      {term.inferredReason && (
        <p className="text-[10px] text-[#F5F0EB]/30 mt-1 truncate italic">
          Why: {term.inferredReason}
        </p>
      )}

      {/* Practice button (tap stops propagation) */}
      {isDue && onPractice && (
        <button
          onClick={(e) => { e.stopPropagation(); onPractice(term.phrase); }}
          className="mt-2 w-full py-1.5 rounded-lg bg-[#D4A853]/20 text-[#D4A853] text-xs font-semibold hover:bg-[#D4A853]/30 transition-colors"
        >
          Practice now
        </button>
      )}
    </motion.button>
  );
}

// ─── Term Detail View ───────────────────────────────────────────

function TermDetailView({ term, conversations, relatedTerms, graph, onPractice, onTermClick }: {
  term: TermNode;
  conversations: ConversationNode[];
  relatedTerms: TermNode[];
  graph: KnowledgeGraphStore;
  onPractice?: (phrase: string) => void;
  onTermClick: (id: string) => void;
}) {
  const mc = MASTERY_COLORS[term.mastery];
  const enc = ENCOUNTER_ICONS[term.encounterType];
  const location = term.learnedAtLocation ? graph.getNode<LocationNode>(term.learnedAtLocation) : null;
  const scenario = term.learnedInScenario ? graph.getNode<ScenarioNode>(term.learnedInScenario) : null;
  const avatar = term.learnedFromAvatar ? graph.getNode<AvatarGraphNode>(term.learnedFromAvatar) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pt-4 space-y-4"
    >
      {/* Hero */}
      <div className={`rounded-2xl border ${mc.border}/30 ${mc.bg} p-5 text-center`}>
        <p className="text-[#F5F0EB] font-serif text-3xl">{term.phrase}</p>
        {term.pronunciation && (
          <p className="text-[#F5F0EB]/60 text-sm mt-1 italic">{term.pronunciation}</p>
        )}
        {term.meaning && (
          <p className="text-[#F5F0EB]/80 text-sm mt-2">{term.meaning}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${mc.bg} ${mc.text} border ${mc.border}/40`}>
            {mc.label}
          </span>
          <span className="text-[#F5F0EB]/40 text-xs">
            {enc.icon} {enc.label}
          </span>
        </div>
        {onPractice && (
          <button
            onClick={() => onPractice(term.phrase)}
            className="mt-4 px-6 py-2 rounded-xl bg-[#D4A853]/20 text-[#D4A853] text-sm font-semibold hover:bg-[#D4A853]/30 transition-colors"
          >
            Practice this phrase
          </button>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Practiced" value={`${term.attemptCount}x`} />
        <StatBox label="Struggled" value={`${term.struggleCount}x`} color={term.struggleCount > 0 ? 'text-amber-400' : undefined} />
        <StatBox label="Engagement" value={`${(term.metadata.engagementScore * 100).toFixed(0)}%`} color="text-[#6BBAA7]" />
      </div>

      {/* Why (inferred reason) */}
      {term.inferredReason && (
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[#F5F0EB]/50 text-[10px] uppercase tracking-wider mb-1">Why you learned this</p>
          <p className="text-[#F5F0EB]/80 text-sm">{term.inferredReason}</p>
        </div>
      )}

      {/* Context connections */}
      <div className="rounded-xl bg-white/5 p-3 space-y-2">
        <p className="text-[#F5F0EB]/50 text-[10px] uppercase tracking-wider mb-1">Context</p>
        {location && (
          <div className="flex items-center gap-2 text-[#F5F0EB]/60 text-xs">
            <MapPin size={14} className="text-[#6BBAA7]" />
            <span>Learned in <strong className="text-[#F5F0EB]/80">{location.city}</strong></span>
          </div>
        )}
        {scenario && (
          <div className="flex items-center gap-2 text-[#F5F0EB]/60 text-xs">
            <Globe size={14} className="text-[#D4A853]" />
            <span>During <strong className="text-[#F5F0EB]/80">{scenario.scenarioKey}</strong> scenario</span>
          </div>
        )}
        {avatar && (
          <div className="flex items-center gap-2 text-[#F5F0EB]/60 text-xs">
            <User size={14} className="text-[#F5F0EB]/50" />
            <span>Taught by <strong className="text-[#F5F0EB]/80">{avatar.name}</strong></span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[#F5F0EB]/60 text-xs">
          <BookOpen size={14} className="text-[#F5F0EB]/40" />
          <span>{term.language} · {term.script || 'Latin'}</span>
        </div>
      </div>

      {/* Related terms */}
      {relatedTerms.length > 0 && (
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[#F5F0EB]/50 text-[10px] uppercase tracking-wider mb-2">Related terms</p>
          <div className="flex flex-wrap gap-2">
            {relatedTerms.map(rt => {
              const rtc = MASTERY_COLORS[rt.mastery];
              return (
                <button
                  key={rt.id}
                  onClick={() => onTermClick(rt.id)}
                  className={`px-3 py-1 rounded-full text-xs border ${rtc.border}/30 ${rtc.bg} ${rtc.text} hover:border-opacity-60 transition-colors`}
                >
                  {rt.phrase}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Conversations where this term appeared */}
      {conversations.length > 0 && (
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[#F5F0EB]/50 text-[10px] uppercase tracking-wider mb-2">
            Appeared in {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-2">
            {conversations.slice(0, 5).map(conv => (
              <div key={conv.id} className="text-xs text-[#F5F0EB]/50 flex items-start gap-2">
                <span className="text-[#F5F0EB]/30 whitespace-nowrap">{timeAgo(conv.createdAt)}</span>
                <span className="text-[#F5F0EB]/60">{conv.summary.slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="rounded-xl bg-white/5 p-3 flex justify-between text-[10px] text-[#F5F0EB]/30">
        <span>First seen: {new Date(term.firstSeen).toLocaleDateString()}</span>
        <span>Last practiced: {timeAgo(term.lastPracticed)}</span>
      </div>
    </motion.div>
  );
}

// ─── Conversation Card ──────────────────────────────────────────

function ConversationCard({ conv, graph, index }: {
  conv: ConversationNode;
  graph: KnowledgeGraphStore;
  index: number;
}) {
  const mood = MOOD_ICONS[conv.mood] || '😐';
  const termsCount = conv.termsIntroduced.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      className="rounded-xl bg-white/5 border border-white/5 p-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[#F5F0EB]/80 text-sm truncate">{conv.summary.slice(0, 100)}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#F5F0EB]/40">
            <span>{timeAgo(conv.createdAt)}</span>
            <span>{conv.turnCount} turns</span>
            <span>{mood} {conv.mood}</span>
            {conv.scenario && <span>🎭 {conv.scenario}</span>}
            {termsCount > 0 && <span className="text-[#6BBAA7]">+{termsCount} terms</span>}
          </div>
        </div>
        {/* Engagement bar */}
        <div className="text-right ml-2">
          <div className="text-[10px] text-[#F5F0EB]/30 mb-0.5">engagement</div>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-3 rounded-sm ${
                  i < Math.round(conv.metadata.engagementScore * 5)
                    ? 'bg-[#6BBAA7]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stat Box ───────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-2.5 text-center">
      <p className={`text-lg font-semibold ${color || 'text-[#F5F0EB]'}`}>{value}</p>
      <p className="text-[10px] text-[#F5F0EB]/40 mt-0.5">{label}</p>
    </div>
  );
}

export default KnowledgeGraphExplorer;
