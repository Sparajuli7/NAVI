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
import type { AvatarTemplate } from '../../types/character';
import type { ScenarioContext, DialectInfo } from '../../types/config';
import { agentBus } from '../core/eventBus';
import { promptLoader } from '../prompts/promptLoader';
import { estimateTokens } from '../../utils/tokenEstimator';

// Import existing configs from the app
import avatarTemplatesRaw from '../../config/avatarTemplates.json';
import scenarioContextsRaw from '../../config/scenarioContexts.json';
import dialectMapRaw from '../../config/dialectMap.json';
import userPreferenceSchemaRaw from '../../config/userPreferenceSchema.json';

// ─── Config Types ──────────────────────────────────────────────
// AvatarTemplate, ScenarioContext, and DialectInfo are imported from
// src/types/character.ts and src/types/config.ts respectively.

/** Extended dialect config with optional scripts field (used by contextController) */
interface DialectConfig extends DialectInfo {
  scripts?: string[];
}

// ─── Controller ────────────────────────────────────────────────

export class AvatarContextController {
  private activeProfile: AvatarProfile | null = null;
  private activeOverride: AvatarContextOverride = {};

  // Config registries — loaded from JSON, swappable at runtime
  private templates: AvatarTemplate[] = avatarTemplatesRaw as AvatarTemplate[];
  private scenarios: Record<string, ScenarioContext> = scenarioContextsRaw as Record<string, ScenarioContext>;
  private dialects: Record<string, DialectConfig> = dialectMapRaw as Record<string, DialectConfig>;
  private prefSchema: Record<string, unknown> = userPreferenceSchemaRaw;

  // ── Profile Management ──────────────────────────────────────

  /** Create an avatar from a template ID */
  createFromTemplate(
    templateId: string,
    location: string,
    dialectKey?: string,
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
      dialect: dialectKey ?? '',
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
    const userLang = options?.userNativeLanguage || 'English';
    const dialectKey = options?.dialectKey ?? profile.dialect;
    const effectiveLocation = override.location ?? profile.location;
    const effectiveScenario = override.scenario ?? profile.scenario;
    const dialectConfig = this.resolveDialect(effectiveLocation, dialectKey);

    // ── Pre-compute all layer strings ───────────────────────────────
    // Each entry: [content, priority] — 0=MUST, 1=HIGH, 2=MEDIUM, 3=LOW
    // Layers in output order (position matters for coherence)
    const layerDefs: Array<[string, number]> = [];

    // L1: Identity (MUST)
    layerDefs.push([this.buildIdentityLayer(profile), 0]);

    // L2: User preferences (HIGH)
    if (options?.userPreferences) {
      const prefLayer = this.buildPreferenceLayer(options.userPreferences);
      if (prefLayer) layerDefs.push([prefLayer, 1]);
    }

    // L3: Location + dialect (MUST)
    layerDefs.push([this.buildLocationLayer(effectiveLocation, profile.ageGroup, userLang, dialectKey), 0]);

    // L3.5: Language enforcement (MUST — hard locks avatar language)
    if (dialectConfig) {
      const enforcement = promptLoader.get('systemLayers.languageEnforcement.template', {
        language: dialectConfig.language,
        dialect: dialectConfig.dialect,
      });
      layerDefs.push([enforcement, 0]);
    }

    // L4: Scenario (HIGH)
    if (effectiveScenario) {
      const scenarioLayer = this.buildScenarioLayer(effectiveScenario, override.formalityShift);
      if (scenarioLayer) layerDefs.push([scenarioLayer, 1]);
    }

    // L5: Memory context (MEDIUM)
    if (options?.memoryContext) layerDefs.push([options.memoryContext, 2]);

    // L6: Override personality modifier (LOW)
    if (override.personalityModifier) {
      layerDefs.push([`Personality adjustment: ${override.personalityModifier}`, 3]);
    }

    // L7: Additional injected context (LOW)
    if (override.additionalContext) layerDefs.push([override.additionalContext, 3]);

    // L8: Warmth instruction (HIGH)
    if (options?.warmthInstruction) layerDefs.push([options.warmthInstruction, 1]);

    // L9: Situation context (MEDIUM)
    if (options?.situationContext) layerDefs.push([options.situationContext, 2]);

    // L10: Learning context (MEDIUM)
    if (options?.learningContext) layerDefs.push([options.learningContext, 2]);

    // L11: Conversation goals (HIGH — contains learning stage, skills, pronunciation bank)
    if (options?.conversationGoals) layerDefs.push([options.conversationGoals, 1]);

    // L11.5: Mode instruction (MEDIUM)
    if (options?.userMode) {
      const modeLayer = promptLoader.get(`systemLayers.modeInstructions.${options.userMode}`, {
        userNativeLanguage: userLang,
      });
      layerDefs.push([modeLayer, 2]);
    }

    // L11.6: Scenario opener (MEDIUM — only on first message with active scenario)
    if (options?.isFirstEverMessage && effectiveScenario) {
      const scenarioConfig = this.scenarios[effectiveScenario];
      if (scenarioConfig) {
        const openerLayer = promptLoader.get('systemLayers.modeInstructions.scenarioOpener', {
          scenarioLabel: scenarioConfig.label,
        });
        layerDefs.push([openerLayer, 2]);
      }
    }

    // L11.7: Emotional mirroring (MEDIUM)
    const mirroringLayer = promptLoader.get('systemLayers.emotionalMirroring') as string;
    if (mirroringLayer) layerDefs.push([mirroringLayer, 2]);

    // L11.8: Conversation naturalness (MEDIUM)
    const naturalnessLayer = promptLoader.get('systemLayers.conversationNaturalness') as string;
    if (naturalnessLayer) layerDefs.push([naturalnessLayer, 2]);

    // L12: Few-shot examples (LOW)
    const fewShot = promptLoader.get('coreRules.fewShotExamples') as string;
    if (fewShot) layerDefs.push([fewShot, 3]);

    // L13: Core rules (HIGH — demoted from MUST to allow warmth/goals/memory to fit)
    layerDefs.push([this.buildCoreRules(userLang), 1]);

    // L14: Internal monologue (LOW)
    layerDefs.push(['BEFORE responding, think through in your head (do NOT output):\n- What does this person need right now?\n- Any language mistakes to gently address?\n- What is happening around us in this place?\nThen respond naturally in character.', 3]);

    // L15: Reinforcement (HIGH — demoted from MUST to fit within budget)
    const reinforcement = promptLoader.get('coreRules.reinforcement', {
      name: profile.name,
      userNativeLanguage: userLang,
    }) as string;
    if (reinforcement) layerDefs.push([reinforcement, 1]);

    // ── Token budget enforcement ─────────────────────────────────────
    // Budget: 3072 tokens (leaves ~512 for response + ~512 for history in a 4096 context window)
    const BUDGET = 3072;
    const selectedIndices = new Set<number>();

    // Pass 1: always include MUST layers (priority 0)
    layerDefs.forEach(([content, priority], i) => {
      if (content && priority === 0) selectedIndices.add(i);
    });
    let usedTokens = estimateTokens(
      layerDefs.filter((_, i) => selectedIndices.has(i)).map(([c]) => c).join('\n\n'),
    );

    // Passes 2-4: greedily add HIGH → MEDIUM → LOW while under budget
    for (const targetPriority of [1, 2, 3] as const) {
      for (let i = 0; i < layerDefs.length; i++) {
        const [content, priority] = layerDefs[i];
        if (!content || priority !== targetPriority) continue;
        const layerTokens = estimateTokens(content);
        if (usedTokens + layerTokens <= BUDGET) {
          selectedIndices.add(i);
          usedTokens += layerTokens;
        }
        // If layer doesn't fit: skip silently
      }
    }

    const assembled = layerDefs
      .filter((_, i) => selectedIndices.has(i))
      .map(([c]) => c)
      .join('\n\n');

    console.log(`[NAVI:avatar] buildSystemPrompt layers=${selectedIndices.size}/${layerDefs.length} tokens≈${usedTokens} avatar=${profile.name} location=${effectiveLocation} scenario=${effectiveScenario || 'none'}`);
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
      console.warn(
        `[NAVI:avatar] No dialect config found for location="${location}" dialectKey="${dialectKey ?? ''}". ` +
        'Avatar may open in wrong language. Check dialectMap.json or pass dialectKey explicitly.',
      );
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
  getScenarios(): Record<string, ScenarioContext> {
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
  loadScenarios(scenarios: Record<string, ScenarioContext>): void {
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
