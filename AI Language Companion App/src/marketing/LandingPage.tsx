import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  WifiOff,
  MapPin,
  MessageCircle,
  Sparkles,
  Camera,
  BookOpen,
  Check,
} from 'lucide-react';

/**
 * Public marketing landing page served at `/`.
 * Fully responsive (unlike the phone-framed app at `/app`). Uses the shared
 * theme tokens from theme.css so branding stays in sync with the app.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const openApp = () => navigate('/app');

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="ambient-gradient absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="ambient-gradient absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-secondary/10 blur-[120px]" />
      </div>

      <div className="relative">
        <Nav onOpen={openApp} />
        <Hero onOpen={openApp} />
        <HowItWorks />
        <UseCases />
        <Pricing onOpen={openApp} />
        <OfflinePromise onOpen={openApp} />
        <Footer />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Nav */

function Nav({ onOpen }: { onOpen: () => void }) {
  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <a href="/" className="text-2xl tracking-wide text-primary" style={{ fontFamily: 'var(--font-display)' }}>
        NAVI
      </a>
      <div className="flex items-center gap-6">
        <a href="#how" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block">
          How it works
        </a>
        <a href="#pricing" className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block">
          Pricing
        </a>
        <button
          onClick={onOpen}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Open app
        </button>
      </div>
    </nav>
  );
}

/* ----------------------------------------------------------------- Hero */

function Hero({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
      <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs uppercase tracking-widest text-secondary">
        <Sparkles className="h-3.5 w-3.5" /> Offline-first AI language companion
      </span>

      <h1
        className="mx-auto mt-6 max-w-4xl text-4xl leading-tight sm:text-6xl"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Your local friend,{' '}
        <em className="not-italic text-primary italic">anywhere in the world.</em>
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
        NAVI speaks the language, knows the slang, and explains the culture like a native —
        in the market, on the subway, in a waiting room. On your device, even with no signal.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
        >
          Start free <ArrowRight className="h-4 w-4" />
        </button>
        <a
          href="#pricing"
          className="rounded-full border border-border px-7 py-3.5 font-semibold text-foreground transition hover:border-muted-foreground"
        >
          See pricing
        </a>
      </div>

      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2 text-sm text-primary">
        <WifiOff className="h-4 w-4" />
        Runs on-device — private, offline, no data leaves your phone
      </div>
    </header>
  );
}

/* --------------------------------------------------------- How it works */

const STEPS = [
  {
    icon: Sparkles,
    title: 'Pick a companion',
    body: 'Describe the local friend you want. NAVI generates a native speaker with a name, personality, and cultural knowledge authentic to your destination.',
  },
  {
    icon: MapPin,
    title: 'Set the scene',
    body: "Heading to a market? Lost on the subway? Just landed? Tell your companion what's happening and they get you ready for it.",
  },
  {
    icon: MessageCircle,
    title: 'Start talking',
    body: 'Chat by text or voice. Your companion teaches phrases, translates what you hear, and explains the cultural subtext — in real time.',
  },
] as const;

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-3xl sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
        How it works
      </h2>
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-3xl border border-border bg-card p-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mb-2 text-sm text-primary/70">0{i + 1}</div>
            <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Use cases */

const CASES = [
  {
    emoji: '✈️',
    title: 'The traveler',
    body: "You're at the Grand Bazaar in Istanbul. The vendor is talking fast and you're worried about getting ripped off — with no internet.",
    quote: "How do I say 'your best price' without sounding like a tourist?",
  },
  {
    emoji: '📚',
    title: 'The learner',
    body: 'Moving to Seoul in two months. You want immersion, not flashcards — someone who talks to you like a real person, not a course.',
    quote: 'Stop translating for me. I want to understand what you said.',
  },
  {
    emoji: '🏥',
    title: 'The family',
    body: 'Navigating a hospital appointment in a language you barely speak. You need precise words, not guesses. Right now.',
    quote: 'I need to explain an allergy to a doctor in French.',
  },
] as const;

function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-3xl sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
        Built for real situations
      </h2>
      <div className="mt-14 grid gap-6 sm:grid-cols-3">
        {CASES.map((c) => (
          <div key={c.title} className="rounded-3xl border border-border bg-card p-8">
            <div className="mb-4 text-3xl">{c.emoji}</div>
            <h3 className="mb-3 text-lg font-semibold">{c.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            <blockquote
              className="mt-5 border-l-2 border-primary pl-4 text-sm italic text-foreground"
              style={{ fontFamily: 'var(--font-character)' }}
            >
              “{c.quote}”
            </blockquote>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Pricing */

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    tagline: 'The full companion, running privately on your device.',
    features: [
      'On-device AI (WebGPU) — private & offline',
      'Unlimited conversations',
      'Voice, camera translation & flashcards',
      'Memory that adapts to your level',
    ],
    cta: 'Start free',
    highlight: false,
  },
  {
    name: 'NAVI Plus',
    price: '$9',
    cadence: '/ month',
    tagline: 'Bigger, faster cloud models when you want more power.',
    features: [
      'Everything in Free',
      'Cloud models (smarter, faster replies)',
      'Monthly cloud message allowance',
      'Full cross-device account sync',
      'Priority new features',
    ],
    cta: 'Go Plus',
    highlight: true,
  },
  {
    name: 'Bring your own key',
    price: '$0',
    cadence: 'to us',
    tagline: 'Power users: connect your own provider key, pay them directly.',
    features: [
      'Everything in Free',
      'Use your own OpenRouter key',
      'Any model your key supports',
      'You control your own usage & billing',
    ],
    cta: 'Open app',
    highlight: false,
  },
] as const;

function Pricing({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-3xl sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
        Simple pricing
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-center text-muted-foreground">
        The full experience is free on your device. Upgrade only when you want cloud power.
      </p>

      <div className="mt-14 grid items-start gap-6 lg:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-3xl border p-8 ${
              t.highlight
                ? 'border-primary bg-card shadow-xl shadow-primary/10'
                : 'border-border bg-card'
            }`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-8 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                {t.price}
              </span>
              <span className="text-sm text-muted-foreground">{t.cadence}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{t.tagline}</p>

            <ul className="mt-6 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={onOpen}
              className={`mt-8 w-full rounded-full px-6 py-3 font-semibold transition ${
                t.highlight
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'border border-border text-foreground hover:border-muted-foreground'
              }`}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Plus billing is coming soon — the free on-device tier is fully available today.
      </p>
    </section>
  );
}

/* ------------------------------------------------------ Offline promise */

function OfflinePromise({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-[2rem] border border-border bg-gradient-to-br from-secondary/10 to-primary/10 px-6 py-16 text-center">
        <div className="mx-auto mb-5 flex flex-wrap justify-center gap-3 text-primary">
          <WifiOff className="h-7 w-7" />
          <Camera className="h-7 w-7" />
          <BookOpen className="h-7 w-7" />
        </div>
        <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
          No internet? No problem.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          NAVI runs entirely on your device using on-device AI — no server calls, no data sent
          anywhere, no dependency on WiFi or cellular. Your conversations stay yours.
        </p>
        <button
          onClick={onOpen}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Try NAVI now <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Footer */

function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-8 text-sm text-muted-foreground">
      <span>© {new Date().getFullYear()} NAVI</span>
      <div className="flex gap-6">
        <a href="#how" className="transition hover:text-foreground">How it works</a>
        <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
        <a href="/app" className="transition hover:text-foreground">Open app</a>
      </div>
    </footer>
  );
}
