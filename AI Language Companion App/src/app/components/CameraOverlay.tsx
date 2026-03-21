import React, { useState, useRef } from 'react';
import { X, Zap, ZapOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CharacterAvatar } from './CharacterAvatar';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { speakPhrase } from '../../services/tts';
import { parseResponse } from '../../utils/responseParser';
import type { ParsedSegment } from '../../types/chat';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { useChatStore } from '../../stores/chatStore';
import { FALLBACKS } from '../../utils/fallbacks';

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

export function CameraOverlay({ character, onClose }: CameraOverlayProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [scanTypeLabel, setScanTypeLabel] = useState<string | null>(null);
  const [llmResponse, setLlmResponse] = useState('');
  const [isLLMStreaming, setIsLLMStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedSegments, setParsedSegments] = useState<ParsedSegment[]>([]);
  const [scannedText, setScannedText] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { currentLocation } = useAppStore();
  const { addMessage } = useChatStore();
  const { agent } = useNaviAgent();

  const handleFileCapture = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIsScanning(true);
    setShowResults(false);
    setLlmResponse('');
    setParsedSegments([]);
    setErrorMessage(null);
    setScanTypeLabel(null);
    setOcrProgress(0);
    setScannedText('');

    try {
      // Use the agent's image pipeline (OCR → classify → LLM explain)
      const result = await agent.handleImage(file, {
        onOCRProgress: (progress) => {
          setOcrProgress(progress);
        },
        onExplanationToken: (_token, fullText) => {
          // Once we start getting LLM tokens, show the results
          if (!showResults) {
            setIsScanning(false);
            setShowResults(true);
            setIsLLMStreaming(true);
          }
          setLlmResponse(fullText);
        },
      });

      setIsScanning(false);
      setIsLLMStreaming(false);

      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        const responseText = (data.response as string) ?? '';
        const ocrText = (data.extractedText as string) ?? '';
        const docType = (data.documentType as string) ?? 'GENERAL';

        setScannedText(ocrText);
        setScanTypeLabel(docType);
        setLlmResponse(responseText);
        setParsedSegments(parseResponse(responseText));
        setShowResults(true);
      } else {
        const errorText = result.error ?? FALLBACKS.inference_error;
        // Check if OCR returned no text
        if (errorText.includes('No text') || errorText.includes('no text')) {
          setErrorMessage(FALLBACKS.camera_no_text);
        } else {
          setErrorMessage(errorText);
        }
        setShowResults(true);
      }
    } catch (err) {
      console.error('Camera pipeline error:', err);
      setIsScanning(false);
      setIsLLMStreaming(false);
      setErrorMessage(FALLBACKS.inference_error);
      setShowResults(true);
    }
  };

  const handleHelpWithThis = () => {
    const type = scanTypeLabel ?? 'GENERAL';
    const textSnippet = scannedText.slice(0, 200);
    const interpretationSnippet = llmResponse.slice(0, 200);
    addMessage({
      id: Date.now().toString(),
      role: 'system',
      content: `[Camera scan: ${type}. Text: "${textSnippet}". Interpretation: "${interpretationSnippet}"]`,
      type: 'system',
      timestamp: Date.now(),
    });
    onClose();
  };

  const handleScanAgain = () => {
    setShowResults(false);
    setLlmResponse('');
    setParsedSegments([]);
    setErrorMessage(null);
    setScanTypeLabel(null);
    setOcrProgress(0);
    setScannedText('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  // Map scan type to display labels
  const TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
    MENU:     { emoji: '🍽️', label: 'Menu detected' },
    SIGN:     { emoji: '🪧', label: 'Sign detected' },
    DOCUMENT: { emoji: '📄', label: 'Document detected' },
    PAGE:     { emoji: '📃', label: 'Text page detected' },
    LABEL:    { emoji: '🏷️', label: 'Label detected' },
    GENERAL:  { emoji: '📝', label: 'Text detected' },
  };
  const typeLabel = scanTypeLabel ? TYPE_LABELS[scanTypeLabel] ?? null : null;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hidden file input — triggers camera on mobile, file picker on desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileCapture(file);
          e.target.value = '';
        }}
      />

      {/* Camera viewfinder */}
      <div className="absolute inset-0 bg-zinc-900">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Captured image"
            className="w-full h-full object-cover opacity-70"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-white/30 text-sm">Tap Scan to capture</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/20" />
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
              transition={{ duration: 1.5, repeat: Infinity }}
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
                transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
              />
            </motion.div>

            {/* OCR progress indicator */}
            {ocrProgress > 0 && (
              <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-full">
                <p className="text-white text-sm">Reading text... {ocrProgress}%</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detection pill */}
      {showResults && typeLabel && (
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full flex items-center gap-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-lg">{typeLabel.emoji}</span>
          <span className="text-white text-sm font-medium">{typeLabel.label}</span>
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
                <CharacterAvatar
                  character={character}
                  size="sm"
                  animationState="none"
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground mb-1">{character.name}</p>
                  <p className="text-foreground/90 italic leading-relaxed" style={{ fontFamily: 'var(--font-character)' }}>
                    {errorMessage
                      ? errorMessage
                      : isLLMStreaming
                        ? (llmResponse || "Here's what I see...")
                        : (parsedSegments.find(s => s.type === 'text')?.content ?? llmResponse)
                    }
                    {isLLMStreaming && (
                      <span className="inline-block w-0.5 h-4 bg-primary/70 ml-0.5 animate-pulse align-middle" />
                    )}
                  </p>
                </div>
              </div>

              {/* Phrase cards — shown after streaming finishes */}
              {!isLLMStreaming && !errorMessage && parsedSegments.some(s => s.type === 'phrase_card') && (
                <div className="space-y-3 mb-6">
                  {parsedSegments
                    .filter((s): s is ParsedSegment & { type: 'phrase_card'; data: NonNullable<ParsedSegment['data']> } =>
                      s.type === 'phrase_card' && !!s.data
                    )
                    .map((seg, index) => (
                      <motion.div
                        key={index}
                        className="bg-card border border-border rounded-xl p-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-foreground font-medium mb-1">{seg.data.phrase}</p>
                            <p className="text-sm text-muted-foreground italic mb-1">{seg.data.phonetic}</p>
                            <p className="text-sm text-primary/80">{seg.data.soundTip}</p>
                          </div>
                          <button
                            className="p-2 hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0"
                            onClick={() => speakPhrase(seg.data.phrase, currentLocation?.dialectInfo?.language ?? 'English')}
                          >
                            <Volume2 className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {!errorMessage && (
                  <button
                    onClick={handleHelpWithThis}
                    disabled={isLLMStreaming}
                    className="flex-1 px-6 py-4 bg-primary text-primary-foreground rounded-xl font-medium hover:shadow-[0_0_20px_rgba(212,168,83,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Help me with this
                  </button>
                )}
                <button
                  onClick={handleScanAgain}
                  className={`${errorMessage ? 'flex-1' : ''} px-6 py-4 border border-border rounded-xl font-medium text-foreground hover:border-primary/30 transition-colors`}
                >
                  Scan again
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
            onClick={() => fileInputRef.current?.click()}
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
