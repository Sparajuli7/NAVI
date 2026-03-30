/**
 * generateAvatarImage — fetches a one-time AI portrait from Pollinations.ai.
 *
 * Called once during onboarding after character generation. On success, the
 * base64 string is saved to IndexedDB via saveAvatarImage() and the character's
 * has_portrait flag is set to true. On any error, returns null silently so the
 * DiceBear fallback in AIAvatarDisplay remains the experience.
 *
 * Seed = characterId so regeneration is deterministic for the same character.
 */

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
// Realistic editorial portrait style — much better quality than Pixar 3D
const STYLE_PREFIX = 'editorial portrait photography, shallow depth of field, natural skin texture, soft studio lighting, ';
const STYLE_SUFFIX = ', looking slightly off-camera, warm authentic expression, photorealistic, sharp focus on face, bokeh background, professional headshot quality, 85mm lens';

/**
 * Fetch an AI portrait for the given portrait prompt.
 * @param portraitPrompt  Physical description (e.g. "35-year-old Vietnamese woman…")
 * @param characterId     Used as the seed so the same character always gets the same image
 * @returns base64 string (data URI ready) or null on failure
 */
export async function generateAvatarImage(
  portraitPrompt: string,
  characterId: string,
): Promise<string | null> {
  if (!portraitPrompt || !characterId) return null;

  const fullPrompt = `${STYLE_PREFIX}${portraitPrompt}${STYLE_SUFFIX}`;
  const encoded = encodeURIComponent(fullPrompt);
  // Derive a numeric seed from characterId (hash the timestamp portion)
  const seed = Math.abs(characterId.split('_').pop()?.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0) ?? 0) % 99999;
  const url = `${POLLINATIONS_BASE}/${encoded}?width=512&height=512&nologo=true&seed=${seed}&model=flux`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40_000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.size) return null;

    return await blobToBase64(blob);
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Two-step HF FLUX avatar generation from a user's appearance description.
 *
 * Step A: OpenRouter Llama 70B converts the raw description into a vivid
 *         image generation prompt.
 * Step B: HF FLUX.1-schnell generates the image → returned as a base64
 *         data URI so it persists across page refreshes.
 *
 * Returns '' on any failure — caller should fall back to AIAvatarDisplay.
 */
export async function generateAvatarImageFromDescription(description: string): Promise<string> {
  if (!description.trim()) return '';
  try {
    // Step A — convert description to image prompt via OpenRouter 70B
    const rawKeys = (import.meta.env.VITE_OPENROUTER_API_KEY as string) ?? '';
    const apiKey = rawKeys.split(',')[0].trim();
    if (!apiKey) return '';

    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: "You are an expert at writing prompts for AI image generation. Convert the user's character description into a detailed, vivid image generation prompt. Output ONLY the prompt text, no explanation, no preamble. Style: Pixar 3D animated character, friendly, expressive face, warm studio lighting, full portrait.",
          },
          { role: 'user', content: description },
        ],
      }),
    });
    if (!orRes.ok) return '';
    const orJson = await orRes.json() as { choices?: { message?: { content?: string } }[] };
    const imagePrompt = orJson.choices?.[0]?.message?.content?.trim() ?? '';
    if (!imagePrompt) return '';

    // Step B — generate image with HF FLUX.1-schnell
    const hfToken = (import.meta.env.VITE_HF_TOKEN as string) ?? '';
    if (!hfToken) return '';

    const hfRes = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: imagePrompt }),
      },
    );
    if (!hfRes.ok) return '';
    const blob = await hfRes.blob();
    if (!blob.size) return '';

    return await blobToBase64(blob);
  } catch {
    return '';
  }
}
