/**
 * NAVI Agent Framework — Agent Router
 *
 * Routes user intents to the correct tool(s).
 * Uses keyword matching + context for routing decisions.
 *
 * Design decision: The router is rule-based, not LLM-based.
 * An LLM router would be more flexible but costs inference tokens
 * on every request. Since NAVI runs on-device with limited compute,
 * we use deterministic routing and only fall back to LLM when
 * the intent is ambiguous. This saves battery and latency.
 *
 * Future: Can be upgraded to a small classifier model if needed.
 */

import type { ToolName, ToolRequest, ExecutionContext, ToolResult } from './types';
import { executeTool, createExecutionContext } from './executionEngine';
import { toolRegistry } from './toolRegistry';

export interface RouteDecision {
  /** Primary tool to execute */
  tool: ToolName;
  /** Parameters to pass */
  params: Record<string, unknown>;
  /** Confidence of the routing decision (0-1) */
  confidence: number;
  /** Why this route was chosen */
  reason: string;
}

interface RoutingRule {
  tool: ToolName;
  /** Keywords that trigger this route */
  keywords: string[];
  /** Required context keys in params */
  contextKeys?: string[];
  /** Priority when multiple rules match (higher = preferred) */
  priority: number;
}

const ROUTING_RULES: RoutingRule[] = [
  {
    tool: 'camera_read',
    keywords: ['scan', 'photo', 'image', 'picture', 'camera', 'read this', 'what does this say', 'menu', 'sign', 'document', 'form'],
    contextKeys: ['imageData'],
    priority: 10,
  },
  {
    tool: 'pronounce',
    keywords: ['pronounce', 'pronunciation', 'how to say', 'how do you say', 'say this', 'sound', 'speak', 'practice saying'],
    priority: 9,
  },
  {
    tool: 'translate',
    keywords: ['translate', 'translation', 'what does', 'mean', 'how to write'],
    priority: 8,
  },
  {
    tool: 'teach_slang',
    keywords: ['slang', 'gen z', 'gen alpha', 'young people say', 'cool way', 'street talk', 'informal'],
    priority: 8,
  },
  {
    tool: 'explain_culture',
    keywords: ['culture', 'cultural', 'custom', 'tradition', 'etiquette', 'rude', 'polite', 'appropriate', 'taboo'],
    priority: 7,
  },
  {
    tool: 'generate_phrase',
    keywords: ['teach me', 'phrase', 'how to order', 'what to say', 'useful phrases', 'common phrases'],
    priority: 7,
  },
  {
    tool: 'switch_scenario',
    keywords: ['restaurant', 'hospital', 'market', 'office', 'bar', 'nightlife', 'school', 'transit', 'government'],
    priority: 6,
  },
  {
    tool: 'switch_location',
    keywords: ['change location', 'switch to', 'going to', 'traveling to', 'moving to', 'now in'],
    priority: 6,
  },
  {
    tool: 'memory_recall',
    keywords: ['remember', 'recall', 'what did I', 'earlier', 'last time', 'you said'],
    priority: 5,
  },
];

export function routeIntent(
  userMessage: string,
  contextParams: Record<string, unknown> = {},
): RouteDecision {
  const lower = userMessage.toLowerCase();
  const matches: Array<{ rule: RoutingRule; score: number }> = [];

  for (const rule of ROUTING_RULES) {
    // Check if the tool is registered
    if (!toolRegistry.has(rule.tool)) continue;

    let keywordHits = 0;
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword)) keywordHits++;
    }

    if (keywordHits === 0) continue;

    // Check context requirements
    if (rule.contextKeys) {
      const hasContext = rule.contextKeys.some((key) => key in contextParams);
      if (!hasContext && rule.contextKeys.length > 0) {
        // Reduce score if context is missing but keywords match
        keywordHits *= 0.5;
      }
    }

    const score = (keywordHits / rule.keywords.length) * rule.priority;
    matches.push({ rule, score });
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  if (matches.length > 0) {
    const best = matches[0];
    const decision = {
      tool: best.rule.tool,
      params: { message: userMessage, ...contextParams },
      confidence: Math.min(best.score / 10, 1),
      reason: `Matched keywords for ${best.rule.tool} (score: ${best.score.toFixed(2)})`,
    };
    console.log(`[NAVI:router] ${decision.reason} | confidence: ${decision.confidence.toFixed(2)}`);
    return decision;
  }

  // Default to general chat
  console.log(`[NAVI:router] No specific tool matched — routing to chat | confidence: 0.50`);
  return {
    tool: 'chat',
    params: { message: userMessage, ...contextParams },
    confidence: 0.5,
    reason: 'No specific tool matched — routing to general chat',
  };
}

/**
 * Full request lifecycle: route → build request → execute → return result
 */
export async function handleUserInput(
  userMessage: string,
  contextParams: Record<string, unknown> = {},
  constraintOverrides?: Partial<ExecutionContext['constraints']>,
): Promise<{ decision: RouteDecision; result: ToolResult }> {
  // forceChat bypasses routing — used when a tool returned structured data instead of a response
  const decision = contextParams.forceChat
    ? { tool: 'chat' as const, confidence: 1, params: { message: userMessage, ...contextParams } }
    : routeIntent(userMessage, contextParams);

  const request: ToolRequest = {
    tool: decision.tool,
    params: decision.params,
    requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  const context = createExecutionContext(constraintOverrides);
  const result = await executeTool(request, context);

  return { decision, result };
}
