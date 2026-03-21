/**
 * NAVI Agent Framework — Avatar Context Controller
 *
 * Controls the avatar's behavior by merging multiple context layers:
 * 1. Base avatar profile (from template or custom)
 * 2. User preferences
 * 3. Location + dialect context
 * 4. Scenario context
 * 5. Memory context
 * 6. Runtime overrides
 *
 * All behavior is driven by JSON config files, not hardcoded logic.
 * To change how an avatar behaves, edit the config — not the code.
 *
 * Design decision: Config-driven behavior.
 * The product team needs to tweak avatar personalities, slang levels,
 * formality, etc. without touching TypeScript. Everything that controls
 * behavior reads from JSON configs that can be edited externally.
 * This also makes A/B testing trivial — just swap config files.
 */

import type { AvatarProfile, AvatarContextOverride } from '../core/types';
import { agentBus } from '../core/eventBus';
import { promptLoader } from '../prompts/promptLoader';

// Import existing configs from the app
import avatarTemplatesRaw from '../../config/avatarTemplates.json';
import scenarioContextsRaw from '../../config/scenarioContexts.json';
import dialectMapRaw from '../../config/dialectMap.json';
import userPreferenceSchemaRaw from '../../config/userPreferenceSchema.json';

// ─── Config Types (matching existing JSON shapes) ──────────────

interface AvatarTemplate {
  id: string;
  emoji: string;
  label: string;
  base_personality: string;
  default_style: string;
  default_formality: string;
  vocabulary_focus: string[];
  scenario_hint: string;
}

interface ScenarioConfig {
  label: string;
  emoji?: string;
  vocabulary_focus: string[];
  tone_shift: string;
  formality_adjustment: number;
  tone_guidance?: string;
  cultural_guardrails?: string;
  debrief_focus?: string;
  auto_suggestions: string[];
  pronunciation_priority: string[];
}

interface DialectConfig {
  language: string;
  dialect: string;
  formality_default: string;
  cultural_notes: string;
  slang_era: Record<string, string>;
  scripts?: string[];
}

// ─── Controller ────────────────────────────────────────────────

export class AvatarContextController {
  private activeProfile: AvatarProfile | null = null;
  private activeOverride: AvatarContextOverride = {};

  // Config registries — loaded from JSON, swappable at runtime
  private templates: AvatarTemplate[] = avatarTemplatesRaw as AvatarTemplate[];
  private scenarios: Record<string, ScenarioConfig> = scenarioContextsRaw as Record<string, ScenarioConfig>;
  private dialects: Record<string, DialectConfig> = dialectMapRaw as Record<string, DialectConfig>;
  private prefSchema: Record<string, unknown> = userPreferenceSchemaRaw;

  // ── Profile Management ──────────────────────────────────────

  /** Create an avatar from a template ID */
  createFromTemplate(
    templateId: string,
    location: string,
    overrides?: Partial<AvatarProfile>,
  ): AvatarProfile {
    const template = this.templates.find((t) => t.id === templateId) ?? this.templates[0];
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const profile: AvatarProfile = {
      id: `avatar_${Date.now()}`,
      name: template.label,
      ageGroup: '30s',
      dialect: '',
      profession: template.id,
      culturalContext: '',
      slangLevel: template.default_formality === 'casual' ? 0.7 : 0.3,
      personality: template.base_personality,
      energyLevel: 'medium',
      humorStyle: 'warm',
      location,
      scenario: template.scenario_hint.split(',')[0]?.trim() ?? '',
      speaksLike: `${template.default_style} ${template.label.toLowerCase()}`,
      visual: {
        primaryColor: '#6BBAA7',
        secondaryColor: '#D4A853',
        accentColor: '#F5F0EB',
        accessory: template.emoji,
        emoji: template.emoji,
      },
      ...overrides,
    };

    this.setActiveProfile(profile);
    return profile;
  }

  /** Create an avatar from a free-text description (LLM-generated) */
  createFromDescription(
    description: string,
    llmGeneratedProfile: Partial<AvatarProfile>,
    location: string,
  ): AvatarProfile {
    const profile: AvatarProfile = {
      id: `avatar_${Date.now()}`,
      name: 'Custom Guide',
      ageGroup: '30s',
      dialect: '',
      profession: 'guide',
      culturalContext: description,
      slangLevel: 0.5,
      personality: description,
      energyLevel: 'medium',
      humorStyle: 'warm',
      location,
      scenario: '',
      speaksLike: 'a friendly local',
      visual: {
        primaryColor: '#6BBAA7',
        secondaryColor: '#D4A853',
        accentColor: '#F5F0EB',
        accessory: '🌍',
        emoji: '🌍',
      },
      ...llmGeneratedProfile,
    };

    this.setActiveProfile(profile);
    return profile;
  }

  setActiveProfile(profile: AvatarProfile): void {
    this.activeProfile = profile;
    this.activeOverride = {};
    agentBus.emit('avatar:context_change', { type: 'profile_set', profile });
  }

  getActiveProfile(): AvatarProfile | null {
    return this.activeProfile;
  }

  // ── Context Overrides ───────────────────────────────────────

  /** Apply temporary overrides without changing the base profile */
  applyOverride(override: AvatarContextOverride): void {
    this.activeOverride = { ...this.activeOverride, ...override };
    agentBus.emit('avatar:context_change', { type: 'override', override: this.activeOverride });
  }

  clearOverrides(): void {
    this.activeOverride = {};
    agentBus.emit('avatar:context_change', { type: 'override_cleared' });
  }

  // ── Context Assembly (the core function) ────────────────────

  /**
   * Build the full system prompt by merging all context layers.
   * This replaces the existing systemBuilder.ts with a more modular approach.
   *
   * Returns a structured prompt string ready for LLM injection.
   */
  buildSystemPrompt(options?: {
    userPreferences?: Record<string, unknown>;
    memoryContext?: string;
    conversationHistory?: string;
    warmthInstruction?: string;
    learningContext?: string;
    conversationGoals?: string;
    situationContext?: string;
    userNativeLanguage?: string;
    userMode?: 'learn' | 'guide' | 'friend' | null;
    dialectKey?: string;
    isFirstEverMessage?: boolean;
  }): string {
    if (!this.activeProfile) {
      return 'You are a helpful language assistant.';
    }

    const profile = this.activeProfile;
    const override = this.activeOverride;
    const layers: string[] = [];

    // Layer 1: Identity
    layers.push(this.buildIdentityLayer(profile));

    // Layer 2: User preferences
    if (options?.userPreferences) {
      layers.push(this.buildPreferenceLayer(options.userPreferences));
    }

    // Layer 3: Location + dialect
    const effectiveLocation = override.location ?? profile.location;
    const userLang = options?.userNativeLanguage || 'English';
    // If an explicit dialectKey is provided, use it to look up dialect directly (fixes language mismatch bug)
    const dialectKey = options?.dialectKey ?? profile.dialect;
    layers.push(this.buildLocationLayer(effectiveLocation, profile.ageGroup, userLang, dialectKey));

    // Layer 2.5: Language enforcement (injected after location, before everything else)
    const locationForEnforcement = effectiveLocation;
    const dialectForEnforcement = this.resolveDialect(locationForEnforcement, dialectKey);
    if (dialectForEnforcement) {
      try {
        const enforcementLayer = promptLoader.get('systemLayers.languageEnforcement.template', {
          language: dialectForEnforcement.language,
          dialect: dialectForEnforcement.dialect,
        });
        layers.push(enforcementLayer);
      } catch {
        // languageEnforcement not in config — skip
      }
    }

    // Layer 4: Scenario
    const effectiveScenario = override.scenario ?? profile.scenario;
    if (effectiveScenario) {
      layers.push(this.buildScenarioLayer(effectiveScenario, override.formalityShift));
    }

    // Layer 5: Memory context
    if (options?.memoryContext) {
      layers.push(options.memoryContext);
    }

    // Layer 6: Override personality modifier
    if (override.personalityModifier) {
      layers.push(`Personality adjustment: ${override.personalityModifier}`);
    }

    // Layer 7: Additional injected context
    if (override.additionalContext) {
      layers.push(override.additionalContext);
    }

    // Layer 8: Relationship/warmth instruction
    if (options?.warmthInstruction) {
      layers.push(options.warmthInstruction);
    }

    // Layer 9: Situation model (proactive assessment of user needs)
    if (options?.situationContext) {
      layers.push(options.situationContext);
    }

    // Layer 10: Learning context
    if (options?.learningContext) {
      layers.push(options.learningContext);
    }

    // Layer 11: Conversation goals
    if (options?.conversationGoals) {
      layers.push(options.conversationGoals);
    }

    // Layer 11.5: Mode instruction (learn / guide / friend)
    if (options?.userMode) {
      try {
        const modeInstruction = promptLoader.get(`systemLayers.modeInstructions.${options.userMode}`, {
          userNativeLanguage: userLang,
        });
        layers.push(modeInstruction);
      } catch {
        // mode key not found — skip
      }
    }

    // Layer 11.6: Scenario opener (first message in a scenario — replaces generic gauging)
    if (options?.isFirstEverMessage && effectiveScenario) {
      const scenarioConfig = this.scenarios[effectiveScenario];
      if (scenarioConfig) {
        try {
          const openerLayer = promptLoader.get('systemLayers.modeInstructions.scenarioOpener', {
            scenarioLabel: scenarioConfig.label,
          });
          layers.push(openerLayer);
        } catch {
          // scenarioOpener not in config — skip
        }
      }
    }

    // Layer 11.7: Conversation naturalness
    try {
      const naturalnessLayer = promptLoader.get('systemLayers.conversationNaturalness');
      if (naturalnessLayer) layers.push(naturalnessLayer);
    } catch {
      // not in config — skip
    }

    // Layer 12: Few-shot examples (show ideal tone)
    const fewShot = promptLoader.get('coreRules.fewShotExamples');
    if (fewShot) layers.push(fewShot);

    // Layer 13: Core rules
    layers.push(this.buildCoreRules(userLang));

    // Layer 14: Internal monologue instruction
    layers.push('BEFORE responding, think through these in your head (do NOT output them):\n- What is my current mood/energy right now?\n- Did the user make any language mistakes I should address?\n- What is happening around us in this place right now?\n- What does this person actually need from me in this moment?\nThen respond naturally in character. Only output your spoken dialogue.');

    // Layer 15: Reinforcement (always LAST — LLMs pay most attention to the end)
    const reinforcement = promptLoader.get('coreRules.reinforcement', {
      name: profile.name,
      userNativeLanguage: userLang,
    });
    if (reinforcement) layers.push(reinforcement);

    const assembled = layers.join('\n\n');
    console.log(`[NAVI:avatar] buildSystemPrompt layers=${layers.length} avatar=${profile.name} location=${override.location ?? profile.location} scenario=${(override.scenario ?? profile.scenario) || 'none'}`);
    return assembled;
  }

  // ── Layer Builders ──────────────────────────────────────────

  private buildIdentityLayer(profile: AvatarProfile): string {
    const slangKey = profile.slangLevel > 0.6
      ? 'slang_high'
      : profile.slangLevel > 0.3
        ? 'slang_medium'
        : 'slang_low';
    const slangInstruction = promptLoader.get(`systemLayers.identity.${slangKey}`);

    const identity = promptLoader.get('systemLayers.identity.template', {
      name: profile.name,
      personality: profile.personality,
      speaksLike: profile.speaksLike,
      energyLevel: profile.energyLevel,
      humorStyle: profile.humorStyle,
    });

    return `${identity} ${slangInstruction}`;
  }

  private buildPreferenceLayer(prefs: Record<string, unknown>): string {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(prefs)) {
      const schema = this.prefSchema[key] as { prompt_injection?: string } | undefined;
      if (schema?.prompt_injection) {
        const valStr = Array.isArray(val) ? val.join(', ') : String(val);
        lines.push(schema.prompt_injection.replace('{value}', valStr));
      }
    }
    return lines.length > 0 ? lines.join(' ') : '';
  }

  /** Resolve dialect config from explicit key or location string */
  private resolveDialect(location: string, dialectKey?: string): DialectConfig | null {
    // If explicit dialectKey given, use it directly (authoritative)
    if (dialectKey && this.dialects[dialectKey]) {
      return this.dialects[dialectKey];
    }
    // Fall back to city string matching
    for (const [key, config] of Object.entries(this.dialects)) {
      const city = key.split('/')[1];
      if (city && location.toLowerCase().includes(city.toLowerCase())) {
        return config;
      }
    }
    return null;
  }

  private buildLocationLayer(location: string, ageGroup: string, userNativeLanguage: string, dialectKey?: string): string {
    const dialectConfig = this.resolveDialect(location, dialectKey);

    let layer = `Location: ${location}.`;
    if (dialectConfig) {
      layer += ` You are a native ${dialectConfig.language} speaker. Your language is ${dialectConfig.language} (${dialectConfig.dialect}).`;
      layer += ` SPEAK IN ${dialectConfig.language.toUpperCase()} — use ${dialectConfig.dialect}, not standard/textbook.`;
      layer += ` Speak in ${dialectConfig.language} (${dialectConfig.dialect}) — this is your default and your opening. Use ${userNativeLanguage} only when you have gauged the user needs support (they ask for translation, say they don't understand, or you've confirmed they're a beginner) — not before.`;
      if (dialectConfig.cultural_notes) {
        layer += ` ${dialectConfig.cultural_notes}`;
      }
      // Map age group to generation
      const genMap: Record<string, string> = {
        teen: 'gen_z', '20s': 'gen_z',
        '30s': 'millennial', '40s': 'millennial',
        '50s': 'older', '60s+': 'older',
      };
      const generation = genMap[ageGroup] ?? 'millennial';
      const slang = dialectConfig.slang_era[generation];
      if (slang) {
        layer += ` Use age-appropriate slang: ${slang}`;
      }
      // Script note — for languages with non-Latin scripts, always provide both script + romanization
      if (dialectConfig.scripts && dialectConfig.scripts.length > 0) {
        layer += ` Always write phrases in both ${dialectConfig.scripts[0]} script AND romanized transliteration side by side.`;
      }
    } else {
      // No dialect config — infer language from location name
      layer += ` Speak in the local language of ${location}. Your default is the local language from the first message. Use ${userNativeLanguage} only when the user clearly needs support or asks for help — not as a default.`;
    }

    return layer;
  }

  private buildScenarioLayer(scenario: string, formalityShift?: number): string {
    const config = this.scenarios[scenario];
    if (!config) return '';

    // Use the richer scenarioLock template if available, fall back to basic scenario template
    let layer: string;
    try {
      layer = promptLoader.get('systemLayers.scenarioLock', {
        scenarioLabel: config.label,
        vocabulary: config.vocabulary_focus.join(', '),
        toneGuidance: config.tone_guidance ?? config.tone_shift,
        culturalGuardrails: config.cultural_guardrails ?? '',
      });
    } catch {
      layer = promptLoader.get('systemLayers.scenario.template', {
        label: config.label,
        vocabulary: config.vocabulary_focus.join(', '),
        tone: config.tone_shift,
      });
    }

    if (formalityShift !== undefined) {
      const totalShift = config.formality_adjustment + formalityShift;
      if (totalShift > 1) layer += ' ' + promptLoader.get('systemLayers.scenario.more_formal');
      else if (totalShift < -1) layer += ' ' + promptLoader.get('systemLayers.scenario.more_casual');
    }

    return layer;
  }

  private buildCoreRules(userNativeLanguage: string): string {
    return promptLoader.get('coreRules.rules', { userNativeLanguage });
  }

  // ── Config Management (for runtime swapping) ────────────────

  /** Get available avatar templates */
  getTemplates(): AvatarTemplate[] {
    return [...this.templates];
  }

  /** Get available scenarios */
  getScenarios(): Record<string, ScenarioConfig> {
    return { ...this.scenarios };
  }

  /** Get available dialects */
  getDialects(): Record<string, DialectConfig> {
    return { ...this.dialects };
  }

  /** Hot-swap templates at runtime (for testing/A-B testing) */
  loadTemplates(templates: AvatarTemplate[]): void {
    this.templates = templates;
  }

  /** Hot-swap scenarios at runtime */
  loadScenarios(scenarios: Record<string, ScenarioConfig>): void {
    this.scenarios = scenarios;
  }

  /** Hot-swap dialects at runtime */
  loadDialects(dialects: Record<string, DialectConfig>): void {
    this.dialects = dialects;
  }

  /** Get the full merged context as a debug-friendly object */
  getDebugContext(): Record<string, unknown> {
    return {
      profile: this.activeProfile,
      override: this.activeOverride,
      templateCount: this.templates.length,
      scenarioCount: Object.keys(this.scenarios).length,
      dialectCount: Object.keys(this.dialects).length,
    };
  }
}
