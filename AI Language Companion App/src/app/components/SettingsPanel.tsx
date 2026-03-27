import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, RefreshCw, Trash2, MapPin, Save, ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { saveMemories, savePreferences, saveLocation, saveCharacterMemories, saveAvatarImage, saveCharacter } from '../../utils/storage';
import { detectLocation } from '../../services/location';
import { useNaviAgent } from '../../agent/react/useNaviAgent';
import { updateGeminiApiKey } from '../../agent/models/geminiEmbedding';
import { generateAvatarImage } from '../../utils/generateAvatarImage';
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
  onUpdateCharacter: (updates: Partial<Character>) => Promise<void>;
  onSaveUserProfile: (text: string) => Promise<void>;
}

export function SettingsPanel({ onClose, onRegenerate, onUpdateCharacter, onSaveUserProfile: _onSaveUserProfile }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>('companion');
  const [confirmClear, setConfirmClear] = useState(false);
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
  const { agent, backend, ollamaModel, switchOllamaModel } = useNaviAgent();

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
  const [openRouterKeyDraft, setOpenRouterKeyDraft] = useState(
    () => typeof localStorage !== 'undefined' ? (localStorage.getItem('navi_openrouter_key') ?? '') : '',
  );
  const [openRouterKeySaved, setOpenRouterKeySaved] = useState(false);
  const [isRegeneratingPortrait, setIsRegeneratingPortrait] = useState(false);
  const [portraitRegenStatus, setPortraitRegenStatus] = useState<'idle' | 'success' | 'fail'>('idle');

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
    } catch (err) {
      setModelSwitchError(err instanceof Error ? err.message : 'Failed to switch model');
    } finally {
      setIsSwitchingModel(false);
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
    { key: 'location',    label: '📍 Location' },
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

          {/* D) Location */}
          {activeSection === 'location' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {currentLocation
                        ? `${currentLocation.city}, ${currentLocation.country}`
                        : 'Not detected'}
                    </p>
                    {currentLocation?.dialectInfo && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {countryFlag(currentLocation.countryCode)} {currentLocation.dialectInfo.dialect}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                >
                  {isDetectingLocation ? 'Detecting...' : 'Update via GPS'}
                </button>
                {locationError && <p className="text-xs text-destructive">{locationError}</p>}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Manual override</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    placeholder="Enter city name..."
                    className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    onClick={async () => {
                      if (!manualCity.trim()) return;
                      const updated = {
                        city: manualCity.trim(),
                        country: currentLocation?.country ?? '',
                        countryCode: currentLocation?.countryCode ?? '',
                        lat: currentLocation?.lat ?? 0,
                        lng: currentLocation?.lng ?? 0,
                        dialectKey: currentLocation?.dialectKey ?? null,
                        dialectInfo: currentLocation?.dialectInfo ?? null,
                      };
                      setCurrentLocation(updated);
                      await saveLocation(updated);
                      await onUpdateCharacter({ location_city: manualCity.trim() });
                      setManualCity('');
                    }}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  >
                    Set
                  </button>
                </div>
              </div>
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
              {/* Active model */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Active Model</p>
                  <p className="text-sm text-foreground font-medium break-all">
                    {backend === 'ollama'
                      ? `Ollama: ${ollamaModel ?? 'unknown'}`
                      : 'Qwen2.5-1.5B (WebGPU)'}
                  </p>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        modelStatus === 'ready'
                          ? 'bg-green-400'
                          : modelStatus === 'error'
                          ? 'bg-red-400'
                          : 'bg-yellow-400 animate-pulse'
                      }`}
                    />
                    <p className="text-sm text-foreground capitalize">{modelStatus.replace('_', ' ')}</p>
                  </div>
                </div>
                {(modelStatus === 'downloading' || modelStatus === 'loading') && (
                  <div className="border-t border-border pt-4 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{modelProgress}%</span>
                    </div>
                    <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${modelProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Ollama connection */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Ollama Server</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ollamaUrlDraft}
                      onChange={(e) => setOllamaUrlDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleOllamaUrlSave()}
                      placeholder="http://localhost:11434"
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={handleOllamaUrlSave}
                      disabled={isLoadingModels}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {isLoadingModels ? '...' : 'Connect'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className={`w-2 h-2 rounded-full ${ollamaConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                    <p className="text-xs text-muted-foreground">
                      {isLoadingModels ? 'Connecting...' : ollamaConnected ? (ollamaModels.length > 0 ? `Connected (${ollamaModels.length} models)` : 'Connected — no models pulled yet') : 'Not connected'}
                    </p>
                  </div>
                </div>

                {/* CORS help */}
                {!ollamaConnected && !isLoadingModels && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                      If Ollama is running but not connecting, you need to allow CORS. Stop Ollama and restart it with:
                    </p>
                    <div className="bg-background border border-border rounded-lg px-3 py-2">
                      <code className="text-xs text-foreground break-all">OLLAMA_ORIGINS=* ollama serve</code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      On macOS, you can also set it permanently:
                    </p>
                    <div className="bg-background border border-border rounded-lg px-3 py-2 mt-1">
                      <code className="text-xs text-foreground break-all">launchctl setenv OLLAMA_ORIGINS "*"</code>
                    </div>
                  </div>
                )}

                {/* Model selector */}
                {ollamaConnected && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Select Model</p>
                    <div className="relative">
                      <select
                        value={ollamaModel ?? ''}
                        onChange={(e) => handleSwitchOllamaModel(e.target.value)}
                        disabled={isSwitchingModel}
                        className="w-full appearance-none px-3 py-2.5 pr-8 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 cursor-pointer"
                      >
                        {backend !== 'ollama' && (
                          <option value="" disabled>Select a model...</option>
                        )}
                        {ollamaModels.map((m) => (
                          <option key={m.name} value={m.name}>
                            {m.name} ({(m.size / 1e9).toFixed(1)} GB)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {isSwitchingModel && (
                      <p className="text-xs text-muted-foreground mt-2 animate-pulse">Switching model...</p>
                    )}
                    {modelSwitchError && (
                      <p className="text-xs text-destructive mt-2">{modelSwitchError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Gemini API key — for semantic memory retrieval (online-optional) */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Gemini API Key</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    Optional. Enables semantic memory search when online. Works with your free Google AI Studio key. NAVI still works fully without it.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKeyDraft}
                      onChange={(e) => { setGeminiKeyDraft(e.target.value); setGeminiKeySaved(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setGeminiApiKey(geminiKeyDraft.trim());
                          updateGeminiApiKey(geminiKeyDraft.trim());
                          setGeminiKeySaved(true);
                        }
                      }}
                      placeholder="AIza..."
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      onClick={() => {
                        setGeminiApiKey(geminiKeyDraft.trim());
                        updateGeminiApiKey(geminiKeyDraft.trim());
                        setGeminiKeySaved(true);
                      }}
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

              {/* OpenRouter API key — for richer character generation */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">OpenRouter API Key</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    Optional. Uses LLaMA 3.3 70B for richer character creation + better portrait descriptions. Free at openrouter.ai.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={openRouterKeyDraft}
                      onChange={(e) => { setOpenRouterKeyDraft(e.target.value); setOpenRouterKeySaved(false); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (typeof localStorage !== 'undefined') localStorage.setItem('navi_openrouter_key', openRouterKeyDraft.trim());
                          setOpenRouterKeySaved(true);
                        }
                      }}
                      placeholder="sk-or-..."
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={() => {
                        if (typeof localStorage !== 'undefined') localStorage.setItem('navi_openrouter_key', openRouterKeyDraft.trim());
                        setOpenRouterKeySaved(true);
                      }}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                    >
                      {openRouterKeySaved ? '✓' : 'Save'}
                    </button>
                  </div>
                  {openRouterKeySaved && (
                    <p className="text-xs text-green-400 mt-1">Key saved — next character generation will use LLaMA 3.3 70B.</p>
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
                  {portraitRegenStatus === 'success' && (
                    <p className="text-xs text-green-400">Portrait updated! Reload the chat to see it.</p>
                  )}
                  {portraitRegenStatus === 'fail' && !activeCharacter.portrait_prompt && (
                    <p className="text-xs text-muted-foreground">No portrait description available for this character.</p>
                  )}
                  {portraitRegenStatus === 'fail' && activeCharacter.portrait_prompt && (
                    <p className="text-xs text-amber-400">Generation failed — check your internet connection and try again.</p>
                  )}
                </div>
              )}

              {/* Info */}
              <div className="px-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {backend === 'ollama'
                    ? 'Connected to Ollama. All inference runs on your machine.'
                    : 'Using in-browser WebGPU. Connect to Ollama above to use any local model.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
