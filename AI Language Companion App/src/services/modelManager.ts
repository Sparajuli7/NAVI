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

  const eng = await initEngine();

  await eng.reload(modelId, undefined, {
    initProgressCallback: (report: webllm.InitProgressReport) => {
      const progress = Math.round(report.progress * 100);
      setModelProgress(progress);
      onProgress?.(progress, report.text);

      if (report.progress >= 1) {
        setModelStatus('ready');
        setModelProgress(100);
      } else {
        setModelStatus('downloading');
      }
    },
  });

  setModelStatus('ready');
  setModelProgress(100);
  return eng;
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
