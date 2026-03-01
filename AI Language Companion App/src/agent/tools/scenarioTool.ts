/**
 * NAVI Agent Framework — Scenario & Location Switch Tools
 *
 * Tools for changing the avatar's scenario and location context.
 */

import type { ToolDefinition } from '../core/toolRegistry';
import type { AvatarContextController } from '../avatar/contextController';
import type { LocationIntelligence } from '../location/locationIntelligence';

export function createSwitchScenarioTool(
  avatarController: AvatarContextController,
): ToolDefinition {
  return {
    name: 'switch_scenario',
    description: 'Switch the avatar to a different scenario context (restaurant, hospital, etc).',
    paramSchema: {
      message: { type: 'string', required: true, description: 'Scenario description or name' },
    },
    requiredModels: [],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = (params.message as string).toLowerCase();
      const scenarios = avatarController.getScenarios();

      // Find matching scenario
      let matchedScenario: string | null = null;
      for (const [key, config] of Object.entries(scenarios)) {
        if (message.includes(key) || message.includes(config.label.toLowerCase())) {
          matchedScenario = key;
          break;
        }
      }

      if (matchedScenario) {
        avatarController.applyOverride({ scenario: matchedScenario });
        const config = scenarios[matchedScenario];
        return {
          switched: true,
          scenario: matchedScenario,
          label: config.label,
          suggestions: config.auto_suggestions,
        };
      }

      return {
        switched: false,
        availableScenarios: Object.entries(scenarios).map(([key, config]) => ({
          key,
          label: config.label,
        })),
      };
    },
  };
}

export function createSwitchLocationTool(
  avatarController: AvatarContextController,
  locationIntelligence: LocationIntelligence,
): ToolDefinition {
  return {
    name: 'switch_location',
    description: 'Switch the avatar to a different location.',
    paramSchema: {
      message: { type: 'string', required: true, description: 'Location description or city name' },
    },
    requiredModels: [],
    costTier: 'light',

    async execute(params: Record<string, unknown>): Promise<unknown> {
      const message = params.message as string;

      // Apply location override to avatar
      avatarController.applyOverride({ location: message });

      return {
        switched: true,
        location: message,
        language: locationIntelligence.getPrimaryLanguage(),
        dialect: locationIntelligence.getDialect(),
      };
    },
  };
}
