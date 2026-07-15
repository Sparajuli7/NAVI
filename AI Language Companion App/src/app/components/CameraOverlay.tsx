import React, { useState, useRef } from 'react';
import {
  X, Zap, ZapOff, Volume2, Camera, Utensils, Signpost, FileText,
  File, Tag, ScanText, type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CompanionFace } from './CompanionFace';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import type { ImageAnalysisResult } from '../../agent/pipelines/imageUnderstanding';
import { speakPhrase } from '../../services/tts';
import { parseResponse } from '../../utils/responseParser';
import type { ParsedSegment, PhraseCardSegment } from '../../types/chat';
import { useAppStore } from '../../stores/appStore';
import { useChatStore } from '../../stores/chatStore';
import { useCharacterStore } from '../../stores/characterStore';
import { FALLBACKS } from '../../utils/fallbacks';
import type { GeneratedCharacter } from '../../types/character';
import type { LocationContext } from '../../types/config';

interface CameraOverlayProps {
  character: GeneratedCharacter;
  onClose: () => void;
}

/** Map dialect/location language names to Tesseract codes */
const TESSERACT_LANG_MAP: Record<string, string> = {
  English: 'eng',
  Vietnamese: 'vie',
  Japanese: 'jpn',
  Korean: 'kor',
  French: 'fra',
  Mandarin: 'chi_sim',
  Chinese: 'chi_sim',
  Spanish: 'spa',
  Nepali: 'nep',
  Hindi: 'hin',
  Thai: 'tha',
  German: 'deu',
  Portuguese: 'por',
  Italian: 'ita',
  Indonesian: 'ind',
  Turkish: 'tur',
  Russian: 'rus',
  Swahili: 'swa',
  // Tagalog/Filipino: no dedicated Tesseract pack — Latin script falls back to eng
  Tagalog: 'eng',
  Filipino: 'eng',
};

const DEFAULT_OCR_LANGS = 'eng+vie+jpn+kor+fra+chi_sim';

const TYPE_LABELS: Record<string, { Icon: LucideIcon; label: string }> = {
  MENU:     { Icon: Utensils, label: 'Menu' },
  SIGN:     { Icon: Signpost, label: 'Sign' },
  DOCUMENT: { Icon: FileText, label: 'Document' },
  PAGE:     { Icon: File, label: 'Page' },
  LABEL:    { Icon: Tag, label: 'Label' },
  GENERAL:  { Icon: ScanText, label: 'Text' },
};

function resolveOcrLanguages(
  location?: LocationContext | null,
  targetLanguage?: string,
): string {
  const lang = location?.dialectInfo?.language || targetLanguage;
  if (!lang) return DEFAULT_OCR_LANGS;
  const code = TESSERACT_LANG_MAP[lang] ?? 'eng';
  return code === 'eng' ? 'eng' : `${code}+eng`;
}

export function CameraOverlay({ character, onClose }: CameraOverlayProps) {
  const { activeCharacter } = useCharacterStore();
  const portraitUrl = activeCharacter?.avatarImageUrl ?? character.avatarImageUrl;
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
  const resultsShownRef = useRef(false);

  const { currentLocation } = useAppStore();
  const { setPendingUserMessage } = useChatStore();
  const { agent, isLLMReady } = useNaviAgent();

  const handleFileCapture = async (file: File) => {
    if (!isLLMReady) {
      setErrorMessage(
        "The AI model isn't loaded yet. Open Settings (gear icon) → AI Model to download or retry.",
      );
      setShowResults(true);
      return;
    }

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
    resultsShownRef.current = false;

    const ocrLanguages = resolveOcrLanguages(currentLocation, character.target_language);

    try {
      const result = await agent.handleImage(file, {
        ocrLanguages,
        onOCRProgress: (progress) => {
          setOcrProgress(progress);
        },
        onExplanationToken: (_token, fullText) => {
          if (!resultsShownRef.current) {
            resultsShownRef.current = true;
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
        const data = result.data as ImageAnalysisResult;
        const explanationText = data.explanation ?? '';
        const ocrText = data.rawText ?? '';
        const docType = data.documentType ?? 'GENERAL';

        if (!ocrText.trim()) {
          setErrorMessage(FALLBACKS.camera_no_text);
          setShowResults(true);
          return;
        }

        setScannedText(ocrText);
        setScanTypeLabel(docType);
        setLlmResponse(explanationText);
        setParsedSegments(parseResponse(explanationText));
        setShowResults(true);
      } else {
        const errorText = result.error ?? FALLBACKS.inference_error;
        if (errorText.toLowerCase().includes('no text')) {
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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('no text')) {
        setErrorMessage(FALLBACKS.camera_no_text);
      } else {
        setErrorMessage(FALLBACKS.inference_error);
      }
      setShowResults(true);
    }
  };

  const handleHelpWithThis = () => {
    const typeWord = (TYPE_LABELS[scanTypeLabel ?? 'GENERAL'] ?? TYPE_LABELS.GENERAL)
      .label.replace(' detected', '').toLowerCase();
    const textSnippet = scannedText.slice(0, 500).trim();
    // Queue a natural chat message; ConversationScreen sends it through handleSend
    // so the avatar replies in the main thread and the user can ask follow-ups.
    const prompt = textSnippet
      ? `Help me understand this ${typeWord} I just scanned. It reads:\n"${textSnippet}"`
      : `Help me understand this ${typeWord} I just scanned.`;
    setPendingUserMessage(prompt);
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
    resultsShownRef.current = false;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
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
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <motion.div
              className="w-16 h-16 rounded-2xl border border-white/15 bg-white/5 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
            >
              <Camera className="w-7 h-7 text-white/35" strokeWidth={1.5} />
            </motion.div>
            <p className="text-white/35 text-sm">Point at a menu or sign</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="p-2.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Camera className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
          <span className="text-white text-sm font-medium tracking-wide">Scan</span>
        </motion.div>
        <button
          onClick={() => setFlashOn(!flashOn)}
          aria-label={flashOn ? 'Turn flash off' : 'Turn flash on'}
          aria-pressed={flashOn}
          className="p-2.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10"
        >
          {flashOn ? (
            <Zap className="w-5 h-5 text-primary" />
          ) : (
            <ZapOff className="w-5 h-5 text-white/70" />
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

            {ocrProgress > 0 && (
              <motion.div
                className="absolute bottom-[22%] left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full border border-white/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <p className="text-white text-xs tracking-wide">Reading {ocrProgress}%</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showResults && typeLabel && (() => {
        const TypeIcon = typeLabel.Icon;
        return (
          <motion.div
            className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-black/80 backdrop-blur-md rounded-full flex items-center gap-2 border border-white/10"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <TypeIcon className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
            <span className="text-white text-xs font-medium tracking-wide">{typeLabel.label}</span>
          </motion.div>
        );
      })()}

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
                <CompanionFace
                  imageUrl={portraitUrl}
                  name={character.name}
                  size="sm"
                  accentColor={{
                    primary: character.colors?.primary ?? '#6BBAA7',
                    secondary: character.colors?.secondary ?? '#D4A853',
                  }}
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
                    .filter((s): s is PhraseCardSegment => s.type === 'phrase_card')
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
                            aria-label={`Hear "${seg.data.phrase}" spoken aloud`}
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

      {!showResults && !isScanning && (
        <motion.div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <motion.button
            onClick={() => fileInputRef.current?.click()}
            className="w-[72px] h-[72px] rounded-full bg-primary border-[3px] border-white/90 shadow-lg flex items-center justify-center"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.03 }}
          >
            <ScanText className="w-6 h-6 text-primary-foreground" strokeWidth={2} />
          </motion.button>
          <p className="text-white/50 text-xs mt-3 tracking-wide">Tap to capture</p>
        </motion.div>
      )}
    </motion.div>
  );
}
