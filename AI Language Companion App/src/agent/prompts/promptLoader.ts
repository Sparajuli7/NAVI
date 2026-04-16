/**
 * NAVI Agent Framework — Prompt Loader
 *
 * Loads prompt templates from JSON config files and interpolates variables.
 * All prompt text lives in src/config/prompts/*.json — edit there, not here.
 *
 * Usage:
 *   promptLoader.get('toolPrompts.pronounce.template', { language: 'Korean', dialect: 'Seoul' })
 *   promptLoader.getRaw('warmthLevels.levels')
 *   promptLoader.loadConfig('toolPrompts', customConfig)  // A/B testing
 */

// Build-time JSON imports — same pattern as avatarTemplates.json, dialectMap.json, etc.
import coreRulesConfig from '../../config/prompts/coreRules.json';
import toolPromptsConfig from '../../config/prompts/toolPrompts.json';
import documentPromptsConfig from '../../config/prompts/documentPrompts.json';
import systemLayersConfig from '../../config/prompts/systemLayers.json';
import warmthLevelsConfig from '../../config/prompts/warmthLevels.json';
import memoryExtractionConfig from '../../config/prompts/memoryExtraction.json';
import characterGenConfig from '../../config/prompts/characterGen.json';
import learningProtocolsConfig from '../../config/prompts/learningProtocols.json';
import conversationSkillsConfig from '../../config/prompts/conversationSkills.json';
import worldEventsConfig from '../../config/worldEvents.json';

// ─── Types ───────────────────────────────────────────────────

type PromptConfig = Record<string, unknown>;

interface PromptConfigs {
  coreRules: PromptConfig;
  toolPrompts: PromptConfig;
  documentPrompts: PromptConfig;
  systemLayers: PromptConfig;
  warmthLevels: PromptConfig;
  memoryExtraction: PromptConfig;
  characterGen: PromptConfig;
  learningProtocols: PromptConfig;
  conversationSkills: PromptConfig;
  worldEvents: PromptConfig;
}

// ─── PromptLoader ────────────────────────────────────────────

class PromptLoader {
  private configs: PromptConfigs;

  constructor() {
    this.configs = {
      coreRules: coreRulesConfig as PromptConfig,
      toolPrompts: toolPromptsConfig as PromptConfig,
      documentPrompts: documentPromptsConfig as PromptConfig,
      systemLayers: systemLayersConfig as PromptConfig,
      warmthLevels: warmthLevelsConfig as PromptConfig,
      memoryExtraction: memoryExtractionConfig as PromptConfig,
      characterGen: characterGenConfig as PromptConfig,
      learningProtocols: learningProtocolsConfig as PromptConfig,
      conversationSkills: conversationSkillsConfig as PromptConfig,
      worldEvents: worldEventsConfig as PromptConfig,
    };
  }

  /**
   * Get a prompt string by dot-notation path, with optional variable interpolation.
   *
   * @param path - Dot-notation path, e.g. 'toolPrompts.pronounce.template'
   * @param variables - Variables to interpolate, e.g. { language: 'Korean' }
   * @returns Interpolated string
   *
   * @example
   * promptLoader.get('coreRules.rules')
   * promptLoader.get('toolPrompts.pronounce.template', { language: 'Korean', dialect: 'Seoul' })
   * promptLoader.get('systemLayers.identity.template', { name: 'Suki', personality: 'warm and friendly' })
   */
  get(path: string, variables?: Record<string, string>): string {
    const value = this.resolve(path);
    if (typeof value !== 'string') {
      throw new Error(`[PromptLoader] Path "${path}" does not resolve to a string. Got ${typeof value}`);
    }
    return variables ? this.interpolate(value, variables) : value;
  }

  /**
   * Get a raw config value by dot-notation path.
   * Returns the object/array/value as-is, without string interpolation.
   *
   * @example
   * promptLoader.getRaw('warmthLevels.levels') // returns the array of warmth tiers
   * promptLoader.getRaw('toolPrompts.pronounce') // returns { mode_header, template, temperature, max_tokens }
   */
  getRaw(path: string): unknown {
    return this.resolve(path);
  }

  /**
   * Hot-swap a config at runtime (for A/B testing or dynamic reloading).
   *
   * @example
   * promptLoader.loadConfig('toolPrompts', experimentalToolPrompts)
   */
  loadConfig(name: keyof PromptConfigs, config: PromptConfig): void {
    this.configs[name] = config;
  }

  /**
   * Interpolate {{variable}} placeholders in a string.
   * Leaves unmatched variables as-is (doesn't crash on missing vars).
   */
  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return key in variables ? variables[key] : match;
    });
  }

  // ── Private ────────────────────────────────────────────────

  private resolve(path: string): unknown {
    const parts = path.split('.');
    const configName = parts[0] as keyof PromptConfigs;
    const config = this.configs[configName];

    if (!config) {
      throw new Error(`[PromptLoader] Unknown config: "${configName}". Available: ${Object.keys(this.configs).join(', ')}`);
    }

    let current: unknown = config;
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined || typeof current !== 'object') {
        throw new Error(`[PromptLoader] Cannot resolve "${path}" — "${parts.slice(0, i).join('.')}" is not an object`);
      }
      current = (current as Record<string, unknown>)[parts[i]];
    }

    if (current === undefined) {
      throw new Error(`[PromptLoader] Path "${path}" not found`);
    }

    return current;
  }
}

/** Singleton prompt loader instance */
export const promptLoader = new PromptLoader();
export { PromptLoader };
