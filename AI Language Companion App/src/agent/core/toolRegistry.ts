/**
 * NAVI Agent Framework — Tool Registry
 *
 * Central registry where all tools register themselves.
 * The router queries this to find the right tool for a request.
 * Tools are simple functions with metadata — no classes, no inheritance.
 *
 * Design decision: Tools are plain async functions, not class instances.
 * This keeps them testable, composable, and easy to swap.
 */

import type { ToolName, ToolRequest, ToolResult } from './types';

export interface ToolDefinition {
  /** Unique tool name */
  name: ToolName;
  /** Human-readable description (used for routing hints) */
  description: string;
  /** What parameters this tool expects */
  paramSchema: Record<string, { type: string; required: boolean; description: string }>;
  /** Which model capabilities this tool needs */
  requiredModels: string[];
  /** The actual execution function */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
  /** Estimated cost: 'light' = no model, 'medium' = small model, 'heavy' = LLM inference */
  costTier: 'light' | 'medium' | 'heavy';
}

class ToolRegistry {
  private tools = new Map<ToolName, ToolDefinition>();

  register(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${definition.name}`);
    }
    this.tools.set(definition.name, definition);
  }

  get(name: ToolName): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: ToolName): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  listNames(): ToolName[] {
    return Array.from(this.tools.keys());
  }

  /** Get tools filtered by cost tier */
  listByCost(tier: ToolDefinition['costTier']): ToolDefinition[] {
    return this.list().filter((t) => t.costTier === tier);
  }

  /** Check if all required models for a tool are available */
  getRequiredModels(name: ToolName): string[] {
    return this.tools.get(name)?.requiredModels ?? [];
  }

  /** Remove a tool (useful for testing or dynamic reconfiguration) */
  unregister(name: ToolName): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }
}

/** Singleton tool registry */
export const toolRegistry = new ToolRegistry();
