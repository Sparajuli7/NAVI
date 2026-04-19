/**
 * NAVI Agent Framework — Execution Engine
 *
 * Deterministic execution of tool requests with:
 * - Budget enforcement (tokens, recursion depth, timeout)
 * - Execution tracing for debugging
 * - Event emission for UI updates
 * - No autonomous loops — every chain is explicitly bounded
 *
 * Design decision: The engine does NOT decide which tool to call.
 * That's the router's job. The engine just executes what it's told,
 * enforces constraints, and reports results. This separation keeps
 * the engine deterministic and testable.
 */

import type {
  ToolRequest,
  ToolResult,
  ExecutionConstraints,
  ExecutionContext,
} from './types';
import { toolRegistry } from './toolRegistry';
import { agentBus } from './eventBus';

const DEFAULT_CONSTRAINTS: ExecutionConstraints = {
  maxRecursionDepth: 3,
  maxTokenBudget: 4096,
  timeoutMs: 120_000,
  allowChaining: false,
};

export function createExecutionContext(
  overrides?: Partial<ExecutionConstraints>,
): ExecutionContext {
  return {
    constraints: { ...DEFAULT_CONSTRAINTS, ...overrides },
    depth: 0,
    tokensUsed: 0,
    trace: [],
  };
}

export async function executeTool(
  request: ToolRequest,
  context: ExecutionContext,
): Promise<ToolResult> {
  const startTime = Date.now();

  // Check recursion depth
  if (context.depth >= context.constraints.maxRecursionDepth) {
    const result: ToolResult = {
      requestId: request.requestId,
      tool: request.tool,
      success: false,
      data: null,
      error: `Max recursion depth (${context.constraints.maxRecursionDepth}) exceeded`,
      durationMs: 0,
    };
    context.trace.push(result);
    agentBus.emit('tool:error', { request, result });
    return result;
  }

  // Check token budget
  if (context.tokensUsed >= context.constraints.maxTokenBudget) {
    const result: ToolResult = {
      requestId: request.requestId,
      tool: request.tool,
      success: false,
      data: null,
      error: `Token budget (${context.constraints.maxTokenBudget}) exhausted`,
      durationMs: 0,
    };
    context.trace.push(result);
    agentBus.emit('execution:budget_warning', { request, tokensUsed: context.tokensUsed });
    return result;
  }

  // Look up the tool
  const tool = toolRegistry.get(request.tool);
  if (!tool) {
    const result: ToolResult = {
      requestId: request.requestId,
      tool: request.tool,
      success: false,
      data: null,
      error: `Tool not found: ${request.tool}`,
      durationMs: 0,
    };
    context.trace.push(result);
    return result;
  }

  agentBus.emit('tool:start', { tool: request.tool, requestId: request.requestId });

  // Execute with timeout
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Tool timeout after ${context.constraints.timeoutMs}ms`)),
        context.constraints.timeoutMs,
      );
    });

    context.depth += 1;
    const data = await Promise.race([
      tool.execute(request.params),
      timeoutPromise,
    ]);
    context.depth -= 1;

    const durationMs = Date.now() - startTime;
    const result: ToolResult = {
      requestId: request.requestId,
      tool: request.tool,
      success: true,
      data,
      durationMs,
    };

    context.trace.push(result);
    agentBus.emit('tool:complete', { request, result });
    return result;
  } catch (err) {
    context.depth -= 1;
    const durationMs = Date.now() - startTime;

    const isTimeout = err instanceof Error && err.message.includes('timeout');
    if (isTimeout) {
      agentBus.emit('execution:timeout', { tool: request.tool, durationMs });
    }

    const result: ToolResult = {
      requestId: request.requestId,
      tool: request.tool,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
    };

    console.error(`[NAVI:exec] ✗ tool=${request.tool} error=${result.error} took ${durationMs}ms`);
    context.trace.push(result);
    agentBus.emit('tool:error', { request, result });
    return result;
  }
}

/** Execute multiple tools in sequence, stopping on first failure */
export async function executeChain(
  requests: ToolRequest[],
  context: ExecutionContext,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const request of requests) {
    const result = await executeTool(request, context);
    results.push(result);
    if (!result.success) break;
  }
  return results;
}
