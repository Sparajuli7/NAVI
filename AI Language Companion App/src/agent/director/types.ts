/**
 * Shared types for the director module.
 *
 * Extracted to break the circular dependency between ConversationDirector
 * and SessionPlanner — both modules need ConversationGoal and DirectorContext,
 * so they live here as the shared root.
 */

export type ConversationGoal =
  | 'introduce_new_vocab'
  | 'revisit_struggling'
  | 'review_due_phrases'
  | 'challenge_user'
  | 'celebrate_progress'
  | 'bridge_locations'
  | 'free_conversation'
  | 'assess_comfort_level'
  | 'avoid_recent_openers'
  | 'proactive_memory'
  | 'session_opener'
  | 'assess_user';

export interface DirectorContext {
  /** Goals selected for this message */
  goals: ConversationGoal[];
  /** Prompt text to inject into system prompt */
  promptInjection: string;
  /** Learning context string for the avatar */
  learningContext: string;
  /** Warmth instruction for the avatar */
  warmthInstruction: string;
  /** Situation model context for the avatar */
  situationContext: string;
}
