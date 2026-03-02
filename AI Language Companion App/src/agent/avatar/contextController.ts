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
  vocabulary_focus: string[];
  tone_shift: string;
  formality_adjustment: number;
  auto_suggestions: string[];
  pronunciation_priority: string[];
}

interface DialectConfig {
  language: string;
  dialect: string;
  formality_default: string;
  cultural_notes: string;
  slang_era: Record<string, string>;
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
    const template = this.templates.find((t) => t.id === templateId);
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
    layers.push(this.buildLocationLayer(effectiveLocation, profile.ageGroup));

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

    // Layer 9: Learning context
    if (options?.learningContext) {
      layers.push(options.learningContext);
    }

    // Layer 10: Conversation goals
    if (options?.conversationGoals) {
      layers.push(options.conversationGoals);
    }

    // Layer 11: Core rules (always last)
    layers.push(this.buildCoreRules());

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

  private buildLocationLayer(location: string, ageGroup: string): string {
    // Find dialect info by matching location against dialect keys
    let dialectConfig: DialectConfig | null = null;
    let dialectKey: string | null = null;

    for (const [key, config] of Object.entries(this.dialects)) {
      const city = key.split('/')[1];
      if (city && location.toLowerCase().includes(city.toLowerCase())) {
        dialectConfig = config;
        dialectKey = key;
        break;
      }
    }

    let layer = `Location: ${location}.`;
    if (dialectConfig) {
      layer += ` Speak in ${dialectConfig.dialect}, not standard/textbook.`;
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
    }

    return layer;
  }

  private buildScenarioLayer(scenario: string, formalityShift?: number): string {
    const config = this.scenarios[scenario];
    if (!config) return '';

    let layer = promptLoader.get('systemLayers.scenario.template', {
      label: config.label,
      vocabulary: config.vocabulary_focus.join(', '),
      tone: config.tone_shift,
    });

    if (formalityShift !== undefined) {
      const totalShift = config.formality_adjustment + formalityShift;
      if (totalShift > 1) layer += ' ' + promptLoader.get('systemLayers.scenario.more_formal');
      else if (totalShift < -1) layer += ' ' + promptLoader.get('systemLayers.scenario.more_casual');
    }

    return layer;
  }

  private buildCoreRules(): string {
    return promptLoader.get('coreRules.rules');
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
