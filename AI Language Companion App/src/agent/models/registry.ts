/**
 * NAVI Agent Framework — Model Registry
 *
 * Central registry for all on-device model providers.
 * Each model type (LLM, TTS, STT, Vision, Embedding, Translation)
 * implements the ModelProvider interface and registers here.
 *
 * Design decision: Provider pattern with lazy loading.
 * Models are expensive to load. The registry tracks what's available
 * and what's loaded. Models are loaded on first use, not on app start.
 * Energy modes control which models get loaded and which stay dormant.
 *
 * This is where you swap models. Want to test a different LLM?
 * Register a new provider with the same capability. The rest of the
 * system doesn't care what model is behind the interface.
 */

import type { ModelCapability, ModelInfo, ModelProvider, EnergyProfile, EnergyMode } from '../core/types';
import { agentBus } from '../core/eventBus';

const ENERGY_PROFILES: Record<EnergyMode, EnergyProfile> = {
  performance: {
    mode: 'performance',
    maxConcurrentModels: 4,
    preferLiteModels: false,
    maxResponseTokens: 512,
    aggressiveCaching: true,
  },
  balanced: {
    mode: 'balanced',
    maxConcurrentModels: 2,
    preferLiteModels: false,
    maxResponseTokens: 400,
    aggressiveCaching: false,
  },
  power_saver: {
    mode: 'power_saver',
    maxConcurrentModels: 1,
    preferLiteModels: true,
    maxResponseTokens: 256,
    aggressiveCaching: false,
  },
};

export class ModelRegistry {
  private providers = new Map<string, ModelProvider>();
  private capabilityMap = new Map<ModelCapability, string[]>();
  private energyMode: EnergyMode = 'balanced';

  /** Register a model provider */
  register(provider: ModelProvider): void {
    const info = provider.info();
    this.providers.set(info.id, provider);

    // Track by capability
    const existing = this.capabilityMap.get(info.capability) ?? [];
    existing.push(info.id);
    this.capabilityMap.set(info.capability, existing);

    agentBus.emit('model:status', { modelId: info.id, status: info.status, action: 'registered' });
  }

  /** Get a provider by model ID */
  getProvider<T = unknown>(modelId: string): ModelProvider<T> | undefined {
    return this.providers.get(modelId) as ModelProvider<T> | undefined;
  }

  /** Get the first available (ready or loadable) provider for a capability */
  getByCapability<T = unknown>(capability: ModelCapability): ModelProvider<T> | undefined {
    const modelIds = this.capabilityMap.get(capability) ?? [];
    const profile = this.getEnergyProfile();

    // Prefer ready models
    for (const id of modelIds) {
      const provider = this.providers.get(id);
      if (provider?.isReady()) return provider as ModelProvider<T>;
    }

    // If preferLiteModels, sort by size ascending
    if (profile.preferLiteModels) {
      const sorted = modelIds
        .map((id) => this.providers.get(id))
        .filter((p): p is ModelProvider => p !== undefined)
        .sort((a, b) => a.info().sizeBytes - b.info().sizeBytes);
      return sorted[0] as ModelProvider<T> | undefined;
    }

    // Otherwise return first registered
    const firstId = modelIds[0];
    return firstId ? (this.providers.get(firstId) as ModelProvider<T>) : undefined;
  }

  /** Load a specific model */
  async loadModel(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    const provider = this.providers.get(modelId);
    if (!provider) throw new Error(`Model not found: ${modelId}`);

    agentBus.emit('model:status', { modelId, status: 'loading' });

    try {
      await provider.load(onProgress);
      agentBus.emit('model:status', { modelId, status: 'ready' });
    } catch (err) {
      agentBus.emit('model:status', { modelId, status: 'error', error: String(err) });
      throw err;
    }
  }

  /** Unload a model to free resources */
  async unloadModel(modelId: string): Promise<void> {
    const provider = this.providers.get(modelId);
    if (!provider) return;
    await provider.unload();
    agentBus.emit('model:status', { modelId, status: 'unloaded' });
  }

  /** Get info for all registered models */
  listModels(): ModelInfo[] {
    return Array.from(this.providers.values()).map((p) => p.info());
  }

  /** Get models by capability */
  listByCapability(capability: ModelCapability): ModelInfo[] {
    const ids = this.capabilityMap.get(capability) ?? [];
    return ids
      .map((id) => this.providers.get(id)?.info())
      .filter((info): info is ModelInfo => info !== undefined);
  }

  /** Check which models are currently loaded */
  getLoadedModels(): ModelInfo[] {
    return this.listModels().filter((m) => m.status === 'ready');
  }

  // ── Energy Management ────────────────────────────────────────

  setEnergyMode(mode: EnergyMode): void {
    this.energyMode = mode;

    const profile = ENERGY_PROFILES[mode];

    // Unload excess models if needed
    const loaded = this.getLoadedModels();
    if (loaded.length > profile.maxConcurrentModels) {
      // Unload non-required models first
      const toUnload = loaded
        .filter((m) => !m.required)
        .slice(profile.maxConcurrentModels);
      for (const model of toUnload) {
        this.unloadModel(model.id).catch(console.error);
      }
    }
  }

  getEnergyMode(): EnergyMode {
    return this.energyMode;
  }

  getEnergyProfile(): EnergyProfile {
    return ENERGY_PROFILES[this.energyMode];
  }

  /** Remove a provider (for testing/reconfiguration) */
  unregister(modelId: string): boolean {
    const provider = this.providers.get(modelId);
    if (!provider) return false;

    const info = provider.info();
    const ids = this.capabilityMap.get(info.capability);
    if (ids) {
      const idx = ids.indexOf(modelId);
      if (idx !== -1) ids.splice(idx, 1);
    }

    return this.providers.delete(modelId);
  }

  clear(): void {
    this.providers.clear();
    this.capabilityMap.clear();
  }
}
