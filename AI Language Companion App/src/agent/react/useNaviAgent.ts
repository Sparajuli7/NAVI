/**
 * NAVI Agent Framework — React Hook
 *
 * Provides the NaviAgent instance to React components via a singleton.
 * Components use this hook instead of creating their own agent instances.
 *
 * Usage:
 *   const { agent, isReady, status } = useNaviAgent();
 *   const result = await agent.handleMessage('Hello!');
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { NaviAgent, createNaviAgent } from '../index';
import type { NaviAgentConfig, AgentEvent, LLMBackend } from '../index';

// Singleton agent instance (shared across all components)
let agentInstance: NaviAgent | null = null;

function getOrCreateAgent(config?: NaviAgentConfig): NaviAgent {
  if (!agentInstance) {
    agentInstance = createNaviAgent(config);
  }
  return agentInstance;
}

export interface UseNaviAgentReturn {
  /** The agent instance */
  agent: NaviAgent;
  /** Whether the agent has been initialized (memory, location loaded) */
  isInitialized: boolean;
  /** Whether the LLM model is loaded and ready */
  isLLMReady: boolean;
  /** Which LLM backend is active */
  backend: LLMBackend;
  /** Current model loading progress (0-100) */
  loadProgress: number;
  /** Loading status text */
  loadStatusText: string;
  /** Last agent event (for debugging) */
  lastEvent: AgentEvent | null;
  /** Initialize the agent (call once on app start) */
  initialize: () => Promise<void>;
  /** Load the LLM model (call after initialize) */
  loadLLM: () => Promise<void>;
}

export function useNaviAgent(config?: NaviAgentConfig): UseNaviAgentReturn {
  const agentRef = useRef<NaviAgent>(getOrCreateAgent(config));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLLMReady, setIsLLMReady] = useState(false);
  const [backend, setBackend] = useState<LLMBackend>(config?.backend ?? 'auto');
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatusText, setLoadStatusText] = useState('');
  const [lastEvent, setLastEvent] = useState<AgentEvent | null>(null);

  // Subscribe to agent events
  useEffect(() => {
    const agent = agentRef.current;

    const unsubModel = agent.on('model:status', (event) => {
      setLastEvent(event);
      const data = event.data as { status?: string; modelId?: string };
      if (data.status === 'ready') {
        setIsLLMReady(true);
      }
    });

    const unsubAll = agent.onAll((event) => {
      setLastEvent(event);
    });

    return () => {
      unsubModel();
      unsubAll();
    };
  }, []);

  const initialize = useCallback(async () => {
    const agent = agentRef.current;
    await agent.initialize();
    setIsInitialized(true);
    setBackend(agent.getBackend());
  }, []);

  const loadLLM = useCallback(async () => {
    const agent = agentRef.current;
    await agent.loadLLM((progress, text) => {
      setLoadProgress(progress);
      setLoadStatusText(text);
    });
    setIsLLMReady(true);
  }, []);

  return {
    agent: agentRef.current,
    isInitialized,
    isLLMReady,
    backend,
    loadProgress,
    loadStatusText,
    lastEvent,
    initialize,
    loadLLM,
  };
}

/** Reset the singleton (for testing) */
export function resetNaviAgent(): void {
  agentInstance = null;
}
