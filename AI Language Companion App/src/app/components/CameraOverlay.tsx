import React, { useState } from 'react';
import { X, Zap, ZapOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

interface CameraOverlayProps {
  character: GeneratedCharacter;
  onClose: () => void;
}

const menuItems = [
  { vn: 'Phở bò', en: 'Beef noodle soup', note: '← the classic, start here', highlight: true },
  { vn: 'Phở gà', en: 'Chicken noodle soup', note: 'lighter option' },
  { vn: 'Phở tái', en: 'Rare beef noodle soup', note: '🌶 if you like heat' },
  { vn: 'Bún bò Huế', en: 'Spicy beef & lemongrass soup', note: 'great value' },
  { vn: 'Bánh mì', en: 'Vietnamese baguette', note: 'perfect for breakfast' },
];

export function CameraOverlay({ character, onClose }: CameraOverlayProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setShowResults(true);
    }, 1500);
  };

  const handleHelpOrder = () => {
    // This would return to chat with ordering script
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Camera viewfinder */}
      <div className="absolute inset-0">
        <img 
          src="https://images.unsplash.com/photo-1770913161058-7522027673bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800"
          alt="Menu"
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <button 
          onClick={onClose}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-full"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <span className="text-white font-medium">Camera</span>
        <button 
          onClick={() => setFlashOn(!flashOn)}
          className="p-2 bg-black/50 backdrop-blur-sm rounded-full"
        >
          {flashOn ? (
            <Zap className="w-5 h-5 text-yellow-400" />
          ) : (
            <ZapOff className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Scan animation */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-[80%] h-[60%] border-2 border-primary rounded-3xl"
              animate={{
                boxShadow: [
                  '0 0 0 rgba(212, 168, 83, 0)',
                  '0 0 30px rgba(212, 168, 83, 0.6)',
                  '0 0 0 rgba(212, 168, 83, 0)',
                ],
              }}
              transition={{ duration: 1.5, repeat: 1 }}
            >
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              
              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(212,168,83,0.8)]"
                animate={{ top: ['0%', '100%'] }}
                transition={{ duration: 1.5, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detection pill */}
      {showResults && (
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full flex items-center gap-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-lg">🇻🇳</span>
          <span className="text-white text-sm font-medium">Vietnamese detected</span>
        </motion.div>
      )}

      {/* Results bottom sheet */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border max-h-[65vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Grab handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            <div className="px-6 pb-6">
              {/* Character interpretation */}
              <div className="flex items-start gap-3 mb-6">
                <BlockyAvatar
                  character={character}
                  size="sm"
                  animate={false}
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">{character.name}</p>
                  <p className="text-foreground/90 italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
                    This is a street phở menu! Here's what you're looking at:
                  </p>
                </div>
              </div>

              {/* Menu items */}
              <div className="space-y-3 mb-6">
                {menuItems.map((item, index) => (
                  <motion.div
                    key={index}
                    className="bg-card border border-border rounded-xl p-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">{item.vn}</p>
                        <p className="text-foreground font-medium mb-2">{item.en}</p>
                        <p className={`text-sm italic ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`}>
                          {item.note}
                        </p>
                      </div>
                      <button className="p-2 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={handleHelpOrder}
                  className="flex-1 px-6 py-4 bg-primary text-primary-foreground rounded-xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all"
                >
                  Help me order this
                </button>
                <button className="px-6 py-4 border border-border rounded-xl font-medium text-foreground hover:border-primary/30 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture button */}
      {!showResults && !isScanning && (
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={handleScan}
            className="w-20 h-20 rounded-full bg-primary border-4 border-white shadow-lg active:scale-95 transition-transform"
          >
            <div className="w-full h-full rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-medium">Scan</span>
            </div>
          </button>
          <p className="text-white text-sm mt-3">
            Point at menu or sign
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
