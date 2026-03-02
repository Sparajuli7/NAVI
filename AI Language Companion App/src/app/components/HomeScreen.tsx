import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Plus, ArrowRight, Brain } from 'lucide-react';
import { BlockyAvatar } from './BlockyAvatar';

interface GeneratedCharacter {
  name: string;
  personality: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  accessory?: string;
}

interface HomeScreenProps {
  character: GeneratedCharacter | null;
  location: string;
  messageCount: number;
  lastMessagePreview: string;
  memoryCount: number;
  onContinueChat: () => void;
  onNewCompanion: () => void;
}

export function HomeScreen({
  character,
  location,
  messageCount,
  lastMessagePreview,
  memoryCount,
  onContinueChat,
  onNewCompanion,
}: HomeScreenProps) {
  // No character yet — show welcome state
  if (!character) {
    return (
      <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col items-center justify-center px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

        <div className="relative z-10 text-center max-w-sm">
          <motion.p
            className="text-foreground/70 text-lg mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Your local friend, anywhere in the world.
          </motion.p>

          <motion.button
            className="w-full px-8 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-3"
            onClick={onNewCompanion}
            whileTap={{ scale: 0.97 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Plus className="w-5 h-5" />
            Create your first companion
          </motion.button>
        </div>
      </div>
    );
  }

  // Character exists — show character card + conversation info
  return (
    <div className="min-h-[calc(100vh-57px)] bg-background flex flex-col px-6 py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 via-background to-teal-950/20 dark:from-purple-950/10 dark:via-background dark:to-teal-950/10" />

      <div className="relative z-10 flex-1 flex flex-col gap-6 max-w-sm mx-auto w-full">
        {/* Character card */}
        <motion.div
          className="bg-card border border-border rounded-2xl p-6 text-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <BlockyAvatar character={character} size="lg" animate={true} />
          <h2
            className="text-xl mt-4 text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {character.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{location}</p>
          <p className="text-sm text-foreground/70 mt-3 italic">
            "{character.personality}"
          </p>
        </motion.div>

        {/* Conversation stats */}
        {messageCount > 0 && (
          <motion.div
            className="bg-card border border-border rounded-2xl p-5"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground font-medium">
                {messageCount} message{messageCount !== 1 ? 's' : ''}
              </span>
              {memoryCount > 0 && (
                <>
                  <span className="text-border">|</span>
                  <Brain className="w-4 h-4 text-secondary" />
                  <span className="text-sm text-foreground font-medium">
                    {memoryCount} memor{memoryCount !== 1 ? 'ies' : 'y'}
                  </span>
                </>
              )}
            </div>
            {lastMessagePreview && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {lastMessagePreview}
              </p>
            )}
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-auto">
          {messageCount > 0 && (
            <motion.button
              className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all flex items-center justify-center gap-3"
              onClick={onContinueChat}
              whileTap={{ scale: 0.97 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Continue conversation
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}

          <motion.button
            className="w-full px-6 py-3 bg-card border border-border text-foreground rounded-full font-medium hover:bg-muted/50 transition-all flex items-center justify-center gap-3"
            onClick={onNewCompanion}
            whileTap={{ scale: 0.97 }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Plus className="w-4 h-4" />
            New companion
          </motion.button>
        </div>
      </div>
    </div>
  );
}
