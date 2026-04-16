import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, RefreshCw, Trash2, MapPin, Save, ChevronDown, Globe } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { saveMemories, savePreferences, saveLocation, saveCharacterMemories, saveAvatarImage, saveCharacter } from '../../utils/storage';
import { detectLocation } from '../../services/location';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { updateGeminiApiKey } from '../../agent/models/geminiEmbedding';
import { LLM_PRESETS, OPENROUTER_FREE_MODELS, OPENROUTER_PAID_MODELS } from '../../agent/models';
import { generateAvatarImage } from '../../utils/generateAvatarImage';
import { CityPicker } from './CityPicker';
import { LanguagePicker } from './LanguagePicker';
import { getLanguageByCode } from '../../config/supportedLanguages';
import type { CityEntry } from './CityPicker';
import type { UserPreferences, Character } from '../../types/character';

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

type Section = 'companion' | 'profile' | 'preferences' | 'location' | 'memory' | 'model';

interface SettingsPanelProps {
  onClose: () => void;
  onRegenerate: () => void;
  onDeleteCompanion?: (charId: string) => Promise<void>;
  onUpdateCharacter: (updates: Partial<Character>) => Promise<void>;
  onSaveUserProfile: (text: string) => Promise<void>;
  onShowModelPicker?: () => void;
}

export function SettingsPanel({ onClose, onRegenerate, onDeleteCompanion, onUpdateCharacter, onSaveUserProfile: _onSaveUserProfile, onShowModelPicker }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>('companion');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteCompanion, setConfirmDeleteCompanion] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Companion edit state
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  const [countryDraft, setCountryDraft] = useState('');
  const [isSavingCompanion, setIsSavingCompanion] = useState(false);

  // Situation model state
  const [situationModel, setSituationModel] = useState<{
    urgency: string; comfortLevel: string; primaryGoal: string;
    nextSituation: string; inCountry: boolean | null; assessmentConfidence: number;
  } | null>(null);

  const { activeCharacter, memories, removeMemory, clearMemories } = useCharacterStore();
  const { userPreferences, currentLocation, modelStatus, modelProgress, geminiApiKey, setUserPreferences, setCurrentLocation, setGeminiApiKey } =
    useAppStore();
  const { agent, backend, ollamaModel, switchOllamaModel, switchBackend, webllmPreset, openRouterTier } = useNaviAgent();

  // Ollama model list state
  const [ollamaModels, setOllamaModels] = useState<Array<{ name: string; size: number }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [modelSwitchError, setModelSwitchError] = useState<string | null>(null);
  const [ollamaUrl, setOllamaUrl] = useState(() => agent.getOllamaBaseUrl());
  const [ollamaUrlDraft, setOllamaUrlDraft] = useState(() => agent.getOllamaBaseUrl());
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [geminiKeyDraft, setGeminiKeyDraft] = useState(geminiApiKey);
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);
  // Backend selector state
  type BackendCard = 'webllm' | 'cloud-free' | 'cloud-paid' | 'ollama';
  const [selectedCard, setSelectedCard] = useState<BackendCard>(() => {
    if (backend === 'ollama') return 'ollama';
    if (backend === 'openrouter') return openRouterTier === 'paid' ? 'cloud-paid' : 'cloud-free';
    return 'webllm';
  });
  const [pendingWebllmPreset, setPendingWebllmPreset] = useState<string>(webllmPreset);
  const [pendingApiKey, setPendingApiKey] = useState<string>(
    () => typeof localStorage !== 'undefined' ? (localStorage.getItem('navi_openrouter_key') ?? '') : '',
  );
  const [pendingPaidModel, setPendingPaidModel] = useState<string>(OPENROUTER_PAID_MODELS[0]);
  const [isSwitchingBackend, setIsSwitchingBackend] = useState(false);
  const [backendSwitchError, setBackendSwitchError] = useState<string | null>(null);
  const [isRegeneratingPortrait, setIsRegeneratingPortrait] = useState(false);
  const [portraitRegenStatus, setPortraitRegenStatus] = useState<'idle' | 'success' | 'fail'>('idle');

  // Location & Language picker state
  const [locationCity, setLocationCity] = useState<CityEntry | null>(() => {
    if (!currentLocation) return null;
    return {
      city: currentLocation.city,
      country: currentLocation.country,
      countryCode: currentLocation.countryCode,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
    };
  });
  const [locationLanguage, setLocationLanguage] = useState<string | null>(
    () => activeCharacter?.target_language ?? userPreferences.target_language ?? null
  );
  const [locationSaved, setLocationSaved] = useState(false);

  // Fetch available Ollama models when the model tab is opened (regardless of current backend)
  const fetchOllamaModels = (url?: string) => {
    setIsLoadingModels(true);
    setModelSwitchError(null);
    agent.checkOllamaConnection(url)
      .then((reachable) => {
        setOllamaConnected(reachable);
        if (reachable) {
          return agent.listOllamaModels(url).then(setOllamaModels);
        } else {
          setOllamaModels([]);
        }
      })
      .catch(() => {
        setOllamaModels([]);
        setOllamaConnected(false);
      })
      .finally(() => setIsLoadingModels(false));
  };

  useEffect(() => {
    if (activeSection === 'model') {
      fetchOllamaModels();
    }
  }, [activeSection]);

  const handleOllamaUrlSave = () => {
    const trimmed = ollamaUrlDraft.trim().replace(/\/+$/, '');
    if (!trimmed) return;
    setOllamaUrl(trimmed);
    agent.setOllamaBaseUrl(trimmed);
    fetchOllamaModels(trimmed);
  };

  const handleSwitchOllamaModel = async (model: string) => {
    if (model === ollamaModel || isSwitchingModel) return;
    setIsSwitchingModel(true);
    setModelSwitchError(null);
    try {
      await switchOllamaModel(model);
      localStorage.setItem('navi_backend_pref', 'ollama');
      localStorage.setItem('navi_ollama_model', model);
    } catch (err) {
      setModelSwitchError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setIsSwitchingModel(false);
    }
  };

  const handleApplyBackend = async () => {
    if (isSwitchingBackend) return;
    setIsSwitchingBackend(true);
    setBackendSwitchError(null);
    try {
      if (selectedCard === 'webllm') {
        await switchBackend('webllm', { webllmPreset: pendingWebllmPreset });
      } else if (selectedCard === 'cloud-free') {
        // Free tier uses keys already in .env — no key input needed
        await switchBackend('openrouter', { openRouterTier: 'free', openRouterModels: OPENROUTER_FREE_MODELS });
      } else {
        // Paid tier requires a key with credits
        await switchBackend('openrouter', { apiKey: pendingApiKey, openRouterTier: 'paid', openRouterModels: [pendingPaidModel] });
      }
    } catch (err) {
      setBackendSwitchError(err instanceof Error ? err.message : 'Failed to switch backend');
    } finally {
      setIsSwitchingBackend(false);
    }
  };

  // Load situation model when profile tab is opened
  useEffect(() => {
    if (activeSection === 'profile') {
      const model = agent.memory.situation.getModel();
      setSituationModel(model);
    }
  }, [activeSection]);

  const handlePreferenceChange = async (updates: Partial<UserPreferences>) => {
    setUserPreferences(updates);
    await savePreferences(useAppStore.getState().userPreferences);
    // Sync native language to agent profile memory
    if (updates.native_language) {
      await agent.memory.profile.setNativeLanguage(updates.native_language);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    removeMemory(id);
    const charId = activeCharacter?.id;
    if (charId) {
      await saveCharacterMemories(charId, useCharacterStore.getState().memories);
    } else {
      await saveMemories(useCharacterStore.getState().memories);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearMemories();
    const charId = activeCharacter?.id;
    if (charId) {
      await saveCharacterMemories(charId, []);
    } else {
      await saveMemories([]);
    }
    setConfirmClear(false);
  };

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    try {
      const ctx = await detectLocation();
      setCurrentLocation(ctx);
      await saveLocation(ctx);
      setManualCity('');
    } catch {
      setLocationError('Could not detect. Try entering city manually.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleSaveCompanionEdits = async () => {
    if (!activeCharacter) return;
    setIsSavingCompanion(true);
    const updates: Partial<Character> = {};
    if (editingSummary && summaryDraft.trim() && summaryDraft.trim() !== activeCharacter.summary) {
      updates.summary = summaryDraft.trim();
    }
    if (editingLocation) {
      if (cityDraft.trim()) updates.location_city = cityDraft.trim();
      if (countryDraft.trim()) updates.location_country = countryDraft.trim();
    }
    if (Object.keys(updates).length > 0) {
      await onUpdateCharacter(updates);
    }
    setEditingSummary(false);
    setEditingLocation(false);
    setIsSavingCompanion(false);
  };

  const sections: Array<{ key: Section; label: string }> = [
    { key: 'companion',   label: '👤 Companion' },
    { key: 'profile',     label: '🧍 Profile' },
    { key: 'preferences', label: '⚙️ Prefs' },
    { key: 'location',    label: '📍 Location & Language' },
    { key: 'memory',      label: '🧠 Memory' },
    { key: 'model',       label: '🤖 Model' },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border max-h-[85vh] flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="font-medium text-foreground">Settings</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto scrollbar-hide flex-shrink-0">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => { setActiveSection(s.key); setConfirmClear(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors font-medium ${
                activeSection === s.key
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* A) Companion */}
          {activeSection === 'companion' && (
            <div className="space-y-4">
              {activeCharacter ? (
                <>
                  {/* Identity row */}
                  <div className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
                    <span className="text-4xl">{activeCharacter.emoji}</span>
                    <div>
                      <p className="font-medium text-foreground">{activeCharacter.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {activeCharacter.location_city}, {activeCharacter.location_country}
                      </p>
                    </div>
                  </div>

                  {/* About (editable) */}
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">About</p>
                        {!editingSummary && (
                          <button
                            onClick={() => { setEditingSummary(true); setSummaryDraft(activeCharacter.summary); }}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {editingSummary ? (
                        <textarea
                          value={summaryDraft}
                          onChange={(e) => setSummaryDraft(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        />
                      ) : (
                        <p className="text-sm text-foreground leading-relaxed">{activeCharacter.summary}</p>
                      )}
                    </div>

                    {activeCharacter.speaks_like && (
                      <div className="border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Speaks like</p>
                        <p className="text-sm text-foreground italic">{activeCharacter.speaks_like}</p>
                      </div>
                    )}
                  </div>

                  {/* Location (editable) */}
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Location</p>
                      {!editingLocation && (
                        <button
                          onClick={() => {
                            setEditingLocation(true);
                            setCityDraft(activeCharacter.location_city);
                            setCountryDraft(activeCharacter.location_country);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingLocation ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={cityDraft}
                          onChange={(e) => setCityDraft(e.target.value)}
                          placeholder="City"
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                          type="text"
                          value={countryDraft}
                          onChange={(e) => setCountryDraft(e.target.value)}
                          placeholder="Country"
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">
                        {activeCharacter.location_city}, {activeCharacter.location_country}
                      </p>
                    )}
                  </div>

                  {/* Save edits button (only when editing) */}
                  {(editingSummary || editingLocation) && (
                    <button
                      onClick={handleSaveCompanionEdits}
                      disabled={isSavingCompanion}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {isSavingCompanion ? 'Saving...' : 'Save changes'}
                    </button>
                  )}

                  <button
                    onClick={() => { onClose(); onRegenerate(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm text-foreground hover:border-primary/40 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate companion
                  </button>

                  {onDeleteCompanion && (
                    confirmDeleteCompanion ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteCompanion(false)}
                          className="flex-1 px-4 py-3 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setConfirmDeleteCompanion(false);
                            onClose();
                            await onDeleteCompanion(activeCharacter.id);
                          }}
                          className="flex-1 px-4 py-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded-xl text-sm hover:bg-red-500/30 transition-colors"
                        >
                          Confirm Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteCompanion(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-red-500/30 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete companion
                      </button>
                    )
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No companion created yet.</p>
              )}
            </div>
          )}

          {/* B) How NAVI sees you */}
          {activeSection === 'profile' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">How your companion sees you</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Your companion figures out what you need through conversation. This updates automatically as you talk.
                </p>

                {situationModel && situationModel.assessmentConfidence > 0 ? (
                  <div className="space-y-3">
                    {situationModel.inCountry !== null && (
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">{situationModel.inCountry ? '📍' : '✈️'}</span>
                        <p className="text-sm text-foreground">
                          {situationModel.inCountry ? 'Currently in the country' : 'Preparing before arrival'}
                        </p>
                      </div>
                    )}

                    {situationModel.urgency !== 'unknown' && (
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">
                          {situationModel.urgency === 'immediate' ? '🔥' : situationModel.urgency === 'short_term' ? '📅' : '🌱'}
                        </span>
                        <p className="text-sm text-foreground">
                          {situationModel.urgency === 'immediate' ? 'Needs help right now'
                            : situationModel.urgency === 'short_term' ? 'Getting ready (days/weeks)'
                            : 'Long-term learning, no rush'}
                        </p>
                      </div>
                    )}

                    {situationModel.comfortLevel !== 'unknown' && (
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">
                          {situationModel.comfortLevel === 'zero' ? '🌱' : situationModel.comfortLevel === 'basic' ? '🌿' : situationModel.comfortLevel === 'conversational' ? '🌳' : '🏔️'}
                        </span>
                        <p className="text-sm text-foreground">
                          {situationModel.comfortLevel === 'zero' ? 'Starting from scratch'
                            : situationModel.comfortLevel === 'basic' ? 'Knows the basics'
                            : situationModel.comfortLevel === 'conversational' ? 'Can hold a conversation'
                            : 'Advanced speaker'}
                        </p>
                      </div>
                    )}

                    {situationModel.primaryGoal !== 'unknown' && (
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">
                          {situationModel.primaryGoal === 'survive' ? '🛟' : situationModel.primaryGoal === 'belong' ? '🏠' : situationModel.primaryGoal === 'connect' ? '💬' : '🌿'}
                        </span>
                        <p className="text-sm text-foreground">
                          {situationModel.primaryGoal === 'survive' ? 'Goal: Get through real situations'
                            : situationModel.primaryGoal === 'belong' ? 'Goal: Fit in and feel at home'
                            : situationModel.primaryGoal === 'connect' ? 'Goal: Connect with people'
                            : 'Goal: Reconnect with heritage'}
                        </p>
                      </div>
                    )}

                    {situationModel.nextSituation && (
                      <div className="flex items-start gap-2">
                        <span className="text-base mt-0.5">🎯</span>
                        <p className="text-sm text-foreground">
                          Next up: {situationModel.nextSituation}
                        </p>
                      </div>
                    )}

                    {/* Confidence indicator */}
                    <div className="border-t border-border pt-3 mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Understanding</span>
                        <span>{Math.round(situationModel.assessmentConfidence * 100)}%</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${situationModel.assessmentConfidence * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {situationModel.assessmentConfidence < 0.6
                          ? 'Keep chatting — your companion is still getting to know you.'
                          : 'Your companion has a good sense of what you need.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-3xl">💬</p>
                    <p className="text-sm text-muted-foreground">
                      Start a conversation and your companion will figure out what you need.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No forms to fill out — just talk naturally.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C) Preferences */}
          {activeSection === 'preferences' && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-5">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your native language</p>
                <div className="flex flex-wrap gap-2">
                  {(['English', 'Spanish', 'Mandarin', 'Hindi', 'Arabic', 'Portuguese', 'French', 'Japanese', 'Korean', 'Vietnamese', 'German', 'Italian', 'Russian', 'Thai', 'Indonesian', 'Turkish', 'Polish', 'Dutch'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handlePreferenceChange({ native_language: lang })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        userPreferences.native_language === lang
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Companion age</p>
                <div className="flex flex-wrap gap-2">
                  {(['teen', '20s', '30s', '40s', '50s', '60s+'] as const).map((age) => (
                    <button
                      key={age}
                      onClick={() => handlePreferenceChange({ avatar_age: age })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        userPreferences.avatar_age === age
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {age}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Companion gender</p>
                <div className="flex flex-wrap gap-2">
                  {(['male', 'female', 'non-binary', 'no_preference'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => handlePreferenceChange({ avatar_gender: g })}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        userPreferences.avatar_gender === g
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {g === 'no_preference' ? 'No pref' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Formality</p>
                <div className="flex gap-2">
                  {(['casual', 'neutral', 'formal'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => handlePreferenceChange({ formality_default: f })}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                        userPreferences.formality_default === f
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Learning focus</p>
                <div className="flex flex-wrap gap-2">
                  {(['pronunciation', 'vocabulary', 'cultural_context', 'reading', 'slang'] as const).map((focus) => {
                    const active = userPreferences.learning_focus.includes(focus);
                    return (
                      <button
                        key={focus}
                        onClick={() => {
                          const current = userPreferences.learning_focus;
                          const updated = active
                            ? current.filter((f) => f !== focus)
                            : [...current, focus];
                          if (updated.length > 0) handlePreferenceChange({ learning_focus: updated });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {focus.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* D) Location & Language */}
          {activeSection === 'location' && (
            <div className="space-y-4">
              {/* City picker */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</span>
                </div>
                <CityPicker
                  value={locationCity}
                  onChange={(city) => {
                    setLocationCity(city);
                    setLocationSaved(false);
                  }}
                  placeholder="Search any city..."
                  showGPS={true}
                />
              </div>

              {/* Language picker */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Learning language</span>
                  {locationLanguage && (
                    <span className="text-xs text-primary ml-auto">
                      {getLanguageByCode(locationLanguage)?.name ?? locationLanguage}
                    </span>
                  )}
                </div>
                <div className="bg-card border border-border rounded-xl p-3">
                  <LanguagePicker
                    value={locationLanguage}
                    onChange={(code) => {
                      setLocationLanguage(code);
                      setLocationSaved(false);
                    }}
                    cityContext={locationCity}
                  />
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={async () => {
                  if (!locationCity) return;
                  const updatedLocation = {
                    city: locationCity.city,
                    country: locationCity.country,
                    countryCode: locationCity.countryCode,
                    lat: locationCity.lat,
                    lng: locationCity.lng,
                    dialectKey: currentLocation?.dialectKey ?? null,
                    dialectInfo: currentLocation?.dialectInfo ?? null,
                  };
                  setCurrentLocation(updatedLocation);
                  await saveLocation(updatedLocation);
                  await onUpdateCharacter({
                    location_city: locationCity.city,
                    location_country: locationCity.country,
                    target_language: locationLanguage ?? undefined,
                  });
                  if (locationLanguage) {
                    setUserPreferences({ target_language: locationLanguage });
                    await savePreferences(useAppStore.getState().userPreferences);
                    try { await agent.memory.profile.setTargetLanguage(locationLanguage); } catch { /* ok */ }
                  }
                  setLocationSaved(true);
                }}
                disabled={!locationCity}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-30 transition-opacity"
              >
                <Save className="w-4 h-4" />
                {locationSaved ? 'Saved!' : 'Save location & language'}
              </button>
              {locationSaved && (
                <p className="text-xs text-green-400 text-center">Location and language updated. Changes take effect on the next message.</p>
              )}
            </div>
          )}

          {/* E) Memory */}
          {activeSection === 'memory' && (
            <div className="space-y-3">
              {memories.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-6 text-center space-y-1">
                  <p className="text-sm text-muted-foreground">No memories yet.</p>
                  <p className="text-xs text-muted-foreground">Generated automatically every 5 messages.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {memories.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 bg-card border border-border rounded-xl px-4 py-3"
                      >
                        <p className="flex-1 text-sm text-foreground leading-relaxed">{m.value}</p>
                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          className="flex-shrink-0 p-1 hover:bg-muted/50 rounded transition-colors mt-0.5"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleClearAll}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      confirmClear
                        ? 'bg-destructive/10 border-destructive/30 text-destructive'
                        : 'border-border text-muted-foreground hover:border-destructive/30 hover:text-destructive'
                    }`}
                  >
                    {confirmClear ? 'Tap again to confirm' : 'Clear all memories'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* F) AI Model */}
          {activeSection === 'model' && (
            <div className="space-y-4">

              {/* Status line */}
              <div className="flex items-center gap-2 px-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  modelStatus === 'ready' ? 'bg-green-400'
                  : modelStatus === 'error' ? 'bg-red-400'
                  : 'bg-yellow-400 animate-pulse'
                }`} />
                <p className="text-sm text-foreground font-medium truncate">
                  {isSwitchingBackend ? 'Switching…'
                    : backend === 'openrouter' ? `Cloud ${openRouterTier === 'paid' ? 'Paid' : 'Free'} · ${openRouterTier === 'paid' ? pendingPaidModel.split('/')[1] : 'Gemma 4 + 7 models'}`
                    : backend === 'ollama' ? `Ollama · ${ollamaModel ?? '—'}`
                    : `On-Device · ${LLM_PRESETS[webllmPreset as keyof typeof LLM_PRESETS]?.name ?? webllmPreset}`}
                </p>
              </div>

              {/* Progress bar — only when loading */}
              {(modelStatus === 'downloading' || modelStatus === 'loading') && (
                <div className="space-y-1 px-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{modelStatus === 'loading' ? 'Compiling shaders…' : 'Downloading…'}</span>
                    <span>{modelProgress}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-1 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${modelProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Tab selector */}
              <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
                {(
                  [
                    { key: 'cloud-free' as const, label: 'Cloud Free' },
                    { key: 'cloud-paid' as const, label: 'Cloud Paid' },
                    ...(ollamaConnected || ollamaModels.length > 0 || backend === 'ollama' ? [{ key: 'ollama' as const, label: 'Ollama' }] : []),
                    { key: 'webllm' as const, label: 'On-Device' },
                  ] as Array<{ key: BackendCard; label: string }>
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCard(key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedCard === key
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Per-tab config */}
              {selectedCard === 'webllm' && (
                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={pendingWebllmPreset}
                      onChange={(e) => setPendingWebllmPreset(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 pr-8 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    >
                      {Object.entries(LLM_PRESETS).map(([key, cfg]) => (
                        <option key={key} value={key}>
                          {cfg.name} — {(cfg.sizeBytes / 1e9).toFixed(1)} GB
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <p className="text-xs text-muted-foreground px-1">Offline · downloads once · no account needed</p>
                </div>
              )}

              {selectedCard === 'cloud-free' && (
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Gemma 4 + 7 models</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{OPENROUTER_FREE_MODELS.length} models · auto-rotated · no credits</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                </div>
              )}

              {selectedCard === 'cloud-paid' && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={pendingApiKey}
                    onChange={(e) => setPendingApiKey(e.target.value)}
                    placeholder="sk-or-... (OpenRouter key with credits)"
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="relative">
                    <select
                      value={pendingPaidModel}
                      onChange={(e) => setPendingPaidModel(e.target.value)}
                      className="w-full appearance-none px-3 py-2.5 pr-8 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    >
                      {OPENROUTER_PAID_MODELS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <p className="text-xs text-muted-foreground px-1">
                    Link your OpenAI key at openrouter.ai/settings/integrations to unlock GPT-4o
                  </p>
                </div>
              )}

              {selectedCard === 'ollama' && (
                <div className="space-y-3">
                  {/* Ollama URL */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ollamaUrlDraft}
                      onChange={(e) => setOllamaUrlDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleOllamaUrlSave()}
                      placeholder="http://localhost:11434"
                      className="flex-1 px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={handleOllamaUrlSave}
                      disabled={isLoadingModels}
                      className="px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {isLoadingModels ? '...' : 'Connect'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <div className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <p className="text-xs text-muted-foreground">
                      {isLoadingModels ? 'Connecting...' : ollamaConnected ? `Connected (${ollamaModels.length} model${ollamaModels.length !== 1 ? 's' : ''})` : 'Not connected'}
                    </p>
                  </div>

                  {/* CORS hint when not connected */}
                  {!ollamaConnected && !isLoadingModels && (
                    <div className="bg-card border border-border rounded-xl px-4 py-3">
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                        If Ollama is running but not connecting, restart it with CORS enabled:
                      </p>
                      <div className="bg-background border border-border rounded-lg px-3 py-2">
                        <code className="text-xs text-foreground break-all">OLLAMA_ORIGINS=* ollama serve</code>
                      </div>
                    </div>
                  )}

                  {/* Model list */}
                  {ollamaConnected && ollamaModels.length > 0 && (
                    <div className="space-y-1.5">
                      {ollamaModels.map((m) => {
                        const active = ollamaModel === m.name && backend === 'ollama';
                        return (
                          <button
                            key={m.name}
                            onClick={() => handleSwitchOllamaModel(m.name)}
                            disabled={isSwitchingModel}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
                              active
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-border bg-card hover:border-emerald-500/40'
                            }`}
                          >
                            <div>
                              <span className={`text-sm font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {m.name}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {(m.size / 1e9).toFixed(1)} GB · local · private
                              </span>
                            </div>
                            <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ml-3 ${
                              active ? 'border-emerald-500 bg-emerald-500' : 'border-border'
                            }`} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {ollamaConnected && ollamaModels.length === 0 && (
                    <div className="bg-card border border-border rounded-xl px-4 py-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        No models pulled yet. Pull one with:
                      </p>
                      <div className="bg-background border border-border rounded-lg px-3 py-2 mt-2">
                        <code className="text-xs text-foreground">ollama pull qwen2.5:3b</code>
                      </div>
                    </div>
                  )}
                  {isSwitchingModel && <p className="text-xs text-muted-foreground px-1 animate-pulse">Switching model...</p>}
                  {modelSwitchError && <p className="text-xs text-destructive px-1">{modelSwitchError}</p>}
                  <p className="text-xs text-muted-foreground px-1">Runs on your machine · no cloud · private</p>
                </div>
              )}

              {/* Apply — not needed for Ollama (model click switches immediately) */}
              {selectedCard !== 'ollama' && (
                <button
                  onClick={handleApplyBackend}
                  disabled={isSwitchingBackend}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
                >
                  {isSwitchingBackend ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Switching…</>
                  ) : 'Apply'}
                </button>
              )}
              {backendSwitchError && (
                <p className="text-xs text-destructive px-1">{backendSwitchError}</p>
              )}

              {/* Re-open full model picker */}
              {onShowModelPicker && (
                <button
                  onClick={() => { onClose(); onShowModelPicker(); }}
                  className="w-full px-4 py-2 text-xs text-muted-foreground border border-dashed border-border rounded-xl hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  Re-run model setup →
                </button>
              )}

              {/* Gemini API key */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gemini API Key</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    Optional. Enables semantic memory search when online. Free at Google AI Studio.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKeyDraft}
                      onChange={(e) => { setGeminiKeyDraft(e.target.value); setGeminiKeySaved(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { setGeminiApiKey(geminiKeyDraft.trim()); updateGeminiApiKey(geminiKeyDraft.trim()); setGeminiKeySaved(true); }
                      }}
                      placeholder="AIza..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => { setGeminiApiKey(geminiKeyDraft.trim()); updateGeminiApiKey(geminiKeyDraft.trim()); setGeminiKeySaved(true); }}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                    >
                      {geminiKeySaved ? '✓' : 'Save'}
                    </button>
                  </div>
                  {geminiApiKey && !geminiKeySaved && (
                    <p className="text-xs text-green-400 mt-1">Key saved — semantic search active when online.</p>
                  )}
                </div>
              </div>

              {/* Regenerate portrait */}
              {activeCharacter && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">AI Portrait</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Re-generate {activeCharacter.name}&apos;s portrait using Pollinations.ai (requires internet).
                    {activeCharacter.has_portrait ? ' Portrait is active.' : ' Using DiceBear illustration currently.'}
                  </p>
                  <button
                    disabled={isRegeneratingPortrait || !activeCharacter.portrait_prompt}
                    onClick={async () => {
                      if (!activeCharacter.portrait_prompt || isRegeneratingPortrait) return;
                      setIsRegeneratingPortrait(true);
                      setPortraitRegenStatus('idle');
                      try {
                        const base64 = await generateAvatarImage(activeCharacter.portrait_prompt, activeCharacter.id);
                        if (base64) {
                          await saveAvatarImage(activeCharacter.id, base64);
                          const updated: Character = { ...activeCharacter, has_portrait: true };
                          await saveCharacter(updated);
                          setPortraitRegenStatus('success');
                        } else {
                          setPortraitRegenStatus('fail');
                        }
                      } catch {
                        setPortraitRegenStatus('fail');
                      } finally {
                        setIsRegeneratingPortrait(false);
                      }
                    }}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingPortrait ? 'animate-spin' : ''}`} />
                    {isRegeneratingPortrait ? 'Generating…' : 'Regenerate Portrait'}
                  </button>
                  {portraitRegenStatus === 'success' && <p className="text-xs text-green-400">Portrait updated! Reload the chat to see it.</p>}
                  {portraitRegenStatus === 'fail' && !activeCharacter.portrait_prompt && <p className="text-xs text-muted-foreground">No portrait description available for this character.</p>}
                  {portraitRegenStatus === 'fail' && activeCharacter.portrait_prompt && <p className="text-xs text-amber-400">Generation failed — check your internet connection and try again.</p>}
                </div>
              )}

            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
