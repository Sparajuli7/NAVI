import { describe, it, expect } from 'vitest';
import { validatePersonalityDetails, formatPersonalityDetailsForPrompt } from './personalityDetails';

describe('validatePersonalityDetails', () => {
  it('rejects thin or missing fields', () => {
    expect(validatePersonalityDetails(null)).toBeNull();
    expect(validatePersonalityDetails({ strong_opinion: 'short' })).toBeNull();
  });

  it('accepts rich concrete fields', () => {
    const pd = validatePersonalityDetails({
      strong_opinion: 'Anyone who puts ketchup on pho should be banned from Vietnam.',
      funny_anecdote: 'Last week a tourist asked me for directions to the Eiffel Tower while standing under it, and I walked them there anyway.',
      sensory_anchor: 'The morning smell of wet pavement and grilled meat under the market awnings.',
      pet_peeve: 'People who yell English slowly at shopkeepers.',
      recurring_character: 'Mrs. Tran who runs the corner pho stall and judges everyone.',
      favorite_spot: 'The alley behind Ben Thanh after 10pm',
      unpopular_take: 'Tourist menus are sometimes the honest choice when you are tired.',
    });
    expect(pd).not.toBeNull();
    expect(pd!.recurring_character).toMatch(/Mrs\. Tran/);
  });

  it('formats prompt with Praktika note', () => {
    const pd = validatePersonalityDetails({
      strong_opinion: 'Anyone who puts ketchup on pho should be banned from Vietnam.',
      funny_anecdote: 'Last week a tourist asked me for directions to the Eiffel Tower while standing under it, and I walked them there anyway.',
      sensory_anchor: 'The morning smell of wet pavement and grilled meat under the market awnings.',
      pet_peeve: 'People who yell English slowly at shopkeepers.',
      recurring_character: 'Mrs. Tran who runs the corner pho stall and judges everyone.',
    })!;
    const text = formatPersonalityDetailsForPrompt(pd);
    expect(text).toMatch(/YOUR PERSONALITY/);
    expect(text).toMatch(/user's language/);
  });
});
