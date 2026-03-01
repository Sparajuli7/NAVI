import * as webllm from '@mlc-ai/web-llm';
import { useAppStore } from '../stores/appStore';

export const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const MODEL_ID_LITE = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

let engine: webllm.MLCEngine | null = null;

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export async function initEngine(): Promise<webllm.MLCEngine> {
  if (engine) return engine;
  engine = new webllm.MLCEngine();
  return engine;
}

export async function loadModel(
  modelId: string = MODEL_ID,
  onProgress?: (progress: number, text: string) => void,
): Promise<webllm.MLCEngine> {
  const { setModelStatus, setModelProgress } = useAppStore.getState();

  setModelStatus('downloading');
  setModelProgress(0);

  try {
    const eng = await initEngine();

    // initProgressCallback belongs on MLCEngineConfig (constructor/setInitProgressCallback),
    // not on ChatOptions passed to reload().
    eng.setInitProgressCallback((report: webllm.InitProgressReport) => {
      const progress = Math.round(report.progress * 100);
      setModelProgress(progress);
      onProgress?.(progress, report.text);

      // WebLLM reports two phases: fetching weights (downloading) then loading GPU shaders
      const isLoadingPhase =
        report.text.toLowerCase().includes('loading') ||
        report.text.toLowerCase().includes('shader') ||
        report.text.toLowerCase().includes('compil');

      if (report.progress >= 1) {
        setModelStatus('ready');
        setModelProgress(100);
      } else if (isLoadingPhase) {
        setModelStatus('loading');
      } else {
        setModelStatus('downloading');
      }
    });

    await eng.reload(modelId);

    setModelStatus('ready');
    setModelProgress(100);
    return eng;
  } catch (err) {
    setModelStatus('error');
    setModelProgress(0);
    engine = null;
    throw err;
  }
}

export function getEngine(): webllm.MLCEngine | null {
  return engine;
}

export function isModelReady(): boolean {
  return useAppStore.getState().modelStatus === 'ready' && engine !== null;
}

export function getModelStatus() {
  return useAppStore.getState().modelStatus;
}

export function unloadModel(): void {
  engine = null;
  useAppStore.getState().setModelStatus('not_loaded');
  useAppStore.getState().setModelProgress(0);
}
