/** Check if the browser supports WebGPU (required for on-device LLM inference). */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}
