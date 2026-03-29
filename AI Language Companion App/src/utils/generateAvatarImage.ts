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
