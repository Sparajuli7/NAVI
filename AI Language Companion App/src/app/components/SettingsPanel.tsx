import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, RefreshCw, Trash2, MapPin, Save } from 'lucide-react';
import { useCharacterStore } from '../../stores/characterStore';
import { useAppStore } from '../../stores/appStore';
import { saveMemories, savePreferences, saveLocation, saveCharacterMemories } from '../../utils/storage';
import { detectLocation } from '../../services/location';
import { MODEL_ID } from '../../services/modelManager';
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

export function SettingsPanel({ onClose, onRegenerate, onUpdateCharacter, onSaveUserProfile }: SettingsPanelProps) {
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

  // Profile state
  const [profileDraft, setProfileDraft] = useState('');
  const [profileInitialized, setProfileInitialized] = useState(false);

  const { activeCharacter, memories, removeMemory, clearMemories } = useCharacterStore();
  const { userPreferences, currentLocation, modelStatus, modelProgress, setUserPreferences, setCurrentLocation, userProfile } =
    useAppStore();

  // Lazy-init profile draft from store
  if (!profileInitialized) {
    setProfileDraft(userProfile);
    setProfileInitialized(true);
  }

  const handlePreferenceChange = async (updates: Partial<UserPreferences>) => {
    setUserPreferences(updates);
    await savePreferences(useAppStore.getState().userPreferences);
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

  const handleSaveProfile = async () => {
    await onSaveUserProfile(profileDraft);
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

          {/* B) My Profile */}
          {activeSection === 'profile' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">About you</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Share anything relevant — your learning goals, native language, interests, or context. Your companion will use this to personalise conversations.
                  </p>
                  <textarea
                    value={profileDraft}
                    onChange={(e) => setProfileDraft(e.target.value)}
                    placeholder="e.g. I'm a native English speaker learning Vietnamese for a 3-month trip. I'm interested in street food and local culture. I'm a beginner."
                    rows={6}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save profile
                </button>
              </div>
            </div>
          )}

          {/* C) Preferences */}
          {activeSection === 'preferences' && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-5">
              <div>
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
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Model</p>
                <p className="text-sm text-foreground font-medium break-all">{MODEL_ID}</p>
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
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Size</p>
                <p className="text-sm text-foreground">~1.5B parameters · Q4 quantized · ~1 GB</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Runs entirely on your device via WebGPU. No data is sent to any server.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
