/**
 * NAVI Agent Framework — ChatLLM Interface
 *
 * This is the contract that all LLM backends must satisfy.
 * Tools depend on this interface, not on any concrete provider.
 *
 * Implementations:
 * - LLMProvider     (WebLLM — runs in-browser via WebGPU, fully offline)
 * - OllamaProvider  (Ollama — runs on local machine, accessed via HTTP)
 *
 * Design decision: Separate interface from implementation.
 * The original LLMProvider mixed WebLLM-specific loading logic with
 * the chat interface. Tools only need .chat() — they don't care
 * whether the model runs in WebGPU or in a local Ollama server.
 * This interface lets us swap backends without touching any tool code.
 */

export interface ChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  onToken?: (token: string, full: string) => void;
}

export interface ChatLLM {
  /** Run a chat completion. Returns the full response text. */
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<string>;

  /** Whether this backend is ready for inference */
  isReady(): boolean;
}
