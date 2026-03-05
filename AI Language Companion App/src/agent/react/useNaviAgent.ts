/**
 * NAVI Agent Framework — React Hook
 *
 * Provides the NaviAgent instance to React components via a singleton.
 * Components use this hook instead of creating their own agent instances.
 *
 * Syncs agent state with the existing Zustand appStore so legacy UI
 * components (ModelDownloadScreen, SettingsPanel) continue to work.
 *
 * Usage:
 *   const { agent, isReady } = useNaviAgent();
 *   const result = await agent.handleMessage('Hello!');
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { NaviAgent, createNaviAgent } from '../index';
import type { NaviAgentConfig, AgentEvent, LLMBackend } from '../index';
import { useAppStore } from '../../stores/appStore';

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
  /** Current Ollama model name (if using Ollama) */
  ollamaModel: string | null;
  /** Switch the active Ollama model */
  switchOllamaModel: (model: string) => Promise<void>;
}

export function useNaviAgent(config?: NaviAgentConfig): UseNaviAgentReturn {
  const agentRef = useRef<NaviAgent>(getOrCreateAgent(config));
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLLMReady, setIsLLMReady] = useState(() => agentRef.current.isLLMReady());
  const [backend, setBackend] = useState<LLMBackend>(config?.backend ?? 'auto');
  const [ollamaModel, setOllamaModel] = useState<string | null>(() => agentRef.current.getOllamaModelName());
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatusText, setLoadStatusText] = useState('');
  const [lastEvent, setLastEvent] = useState<AgentEvent | null>(null);

  // Subscribe to agent events and sync with Zustand appStore
  useEffect(() => {
    const agent = agentRef.current;

    const unsubModel = agent.on('model:status', (event) => {
      setLastEvent(event);
      const data = event.data as { status?: string; modelId?: string };
      if (data.status === 'ready') {
        setIsLLMReady(true);
        useAppStore.getState().setModelStatus('ready');
        useAppStore.getState().setModelProgress(100);
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
    setIsLLMReady(agent.isLLMReady());
    setOllamaModel(agent.getOllamaModelName());
  }, []);

  const loadLLM = useCallback(async () => {
    const agent = agentRef.current;
    const { setModelStatus, setModelProgress } = useAppStore.getState();

    setModelStatus('downloading');
    setModelProgress(0);

    try {
      await agent.loadLLM((progress, text) => {
        setLoadProgress(progress);
        setLoadStatusText(text);

        // Sync with Zustand appStore for legacy UI components
        setModelProgress(progress);
        const lowerText = text.toLowerCase();
        if (progress >= 100) {
          setModelStatus('ready');
        } else if (lowerText.includes('loading') || lowerText.includes('shader') || lowerText.includes('compil')) {
          setModelStatus('loading');
        } else {
          setModelStatus('downloading');
        }
      });
      setIsLLMReady(true);
      setModelStatus('ready');
      setModelProgress(100);
    } catch (err) {
      setModelStatus('error');
      setModelProgress(0);
      throw err;
    }
  }, []);

  const switchOllamaModel = useCallback(async (model: string) => {
    const agent = agentRef.current;
    const { setModelStatus, setModelProgress } = useAppStore.getState();

    setModelStatus('loading');
    setModelProgress(0);

    try {
      await agent.switchOllamaModel(model, (progress, text) => {
        setLoadProgress(progress);
        setLoadStatusText(text);
        setModelProgress(progress);
      });
      setOllamaModel(model);
      setIsLLMReady(true);
      setModelStatus('ready');
      setModelProgress(100);
    } catch (err) {
      setModelStatus('error');
      setModelProgress(0);
      throw err;
    }
  }, []);

  return {
    agent: agentRef.current,
    isInitialized,
    isLLMReady,
    backend,
    ollamaModel,
    loadProgress,
    loadStatusText,
    lastEvent,
    initialize,
    loadLLM,
    switchOllamaModel,
  };
}

/** Reset the singleton (for testing) */
export function resetNaviAgent(): void {
  agentInstance = null;
}
