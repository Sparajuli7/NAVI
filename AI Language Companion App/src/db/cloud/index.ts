/**
 * CloudDatabase — Supabase-backed implementation of IDatabase.
 *
 * Write strategy: local-first (IndexedDB always written first), then async
 * cloud push. Reads come from the sync engine's pull-on-login, not from this
 * class directly — this class only handles writes.
 *
 * To swap to a different SQL backend (Neon, PlanetScale, raw Postgres):
 * 1. Replace the import of `supabase` with your own client
 * 2. Keep the same table names and column structure
 * 3. Update `setDatabase(new MyDatabase(userId))` in auth flow
 * No other code changes needed.
 */

import { supabase } from './supabaseClient';
import { LocalDatabase } from '../local';
import type {
  IDatabase, ICharacterRepo, IConversationRepo, ICharacterMemoryRepo,
  ILearnerProfileRepo, IRelationshipRepo, IProfileMemoryRepo, IPreferencesRepo,
  ILocationRepo, IEpisodicMemoryRepo, ISituationModelRepo, IKnowledgeGraphRepo,
} from '../types';
import type { Character, MemoryEntry, UserPreferences } from '../../types/character';
import type { Message } from '../../types/chat';
import type { LocationContext } from '../../types/config';
import type {
  LearnerProfile, RelationshipState, ProfileMemory,
  EpisodicMemory, SituationModel, GraphNode, GraphEdge,
} from '../../agent/core/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function logCloudError(label: string, error: unknown) {
  console.warn(`[NAVI cloud] ${label}:`, error);
}

// ── Repos ─────────────────────────────────────────────────────────────────────

class CloudCharacterRepo implements ICharacterRepo {
  constructor(private userId: string, private local: ICharacterRepo) {}

  async getAll() { return this.local.getAll(); }

  async save(c: Character) {
    await this.local.save(c);
    const { data: existing } = await supabase
      .from('characters').select('id').eq('user_id', this.userId).eq('id', c.id).maybeSingle();

    const row = { id: c.id, user_id: this.userId, data: stripLargeFields(c) };
    const { error } = existing
      ? await supabase.from('characters').update(row).eq('user_id', this.userId).eq('id', c.id)
      : await supabase.from('characters').insert(row);
    if (error) logCloudError('save character', error);
  }

  async saveAll(cs: Character[]) {
    await this.local.saveAll(cs);
    const rows = cs.map(c => ({ id: c.id, user_id: this.userId, data: stripLargeFields(c) }));
    const { error } = await supabase.from('characters').upsert(rows, { onConflict: 'user_id,id' });
    if (error) logCloudError('saveAll characters', error);
  }

  async delete(id: string) {
    await this.local.delete(id);
    const { error } = await supabase.from('characters')
      .delete().eq('user_id', this.userId).eq('id', id);
    if (error) logCloudError('delete character', error);
  }
}

class CloudConversationRepo implements IConversationRepo {
  constructor(private userId: string, private local: IConversationRepo) {}

  async get(charId: string) { return this.local.get(charId); }

  async save(charId: string, msgs: Message[]) {
    await this.local.save(charId, msgs);
    const row = { character_id: charId, user_id: this.userId, messages: msgs };
    const { error } = await supabase.from('conversations')
      .upsert(row, { onConflict: 'user_id,character_id' });
    if (error) logCloudError('save conversation', error);
  }

  async delete(charId: string) {
    await this.local.delete(charId);
    const { error } = await supabase.from('conversations')
      .delete().eq('user_id', this.userId).eq('character_id', charId);
    if (error) logCloudError('delete conversation', error);
  }
}

class CloudCharacterMemoryRepo implements ICharacterMemoryRepo {
  constructor(private userId: string, private local: ICharacterMemoryRepo) {}

  async get(charId: string) { return this.local.get(charId); }

  async save(charId: string, entries: MemoryEntry[]) {
    await this.local.save(charId, entries);
    const row = { character_id: charId, user_id: this.userId, entries };
    const { error } = await supabase.from('character_memories')
      .upsert(row, { onConflict: 'user_id,character_id' });
    if (error) logCloudError('save character memories', error);
  }

  async delete(charId: string) {
    await this.local.delete(charId);
    const { error } = await supabase.from('character_memories')
      .delete().eq('user_id', this.userId).eq('character_id', charId);
    if (error) logCloudError('delete character memories', error);
  }
}

class CloudLearnerProfileRepo implements ILearnerProfileRepo {
  constructor(private userId: string, private local: ILearnerProfileRepo) {}

  async get() { return this.local.get(); }

  async save(p: LearnerProfile) {
    await this.local.save(p);
    const { error } = await supabase.from('learner_profiles')
      .upsert({ user_id: this.userId, data: p }, { onConflict: 'user_id' });
    if (error) logCloudError('save learner profile', error);
  }
}

class CloudRelationshipRepo implements IRelationshipRepo {
  constructor(private userId: string, private local: IRelationshipRepo) {}

  async get() { return this.local.get(); }

  async save(d: Record<string, RelationshipState>) {
    await this.local.save(d);
    const { error } = await supabase.from('relationships')
      .upsert({ user_id: this.userId, data: d }, { onConflict: 'user_id' });
    if (error) logCloudError('save relationships', error);
  }
}

class CloudProfileMemoryRepo implements IProfileMemoryRepo {
  constructor(private userId: string, private local: IProfileMemoryRepo) {}

  async get() { return this.local.get(); }

  async save(p: ProfileMemory) {
    await this.local.save(p);
    const { error } = await supabase.from('profile_memories')
      .upsert({ user_id: this.userId, data: p }, { onConflict: 'user_id' });
    if (error) logCloudError('save profile memory', error);
  }
}

class CloudPreferencesRepo implements IPreferencesRepo {
  constructor(private userId: string, private local: IPreferencesRepo) {}

  async get() { return this.local.get(); }

  async save(p: UserPreferences) {
    await this.local.save(p);
    const { error } = await supabase.from('user_preferences')
      .upsert({ user_id: this.userId, data: p }, { onConflict: 'user_id' });
    if (error) logCloudError('save preferences', error);
  }
}

class CloudLocationRepo implements ILocationRepo {
  constructor(private local: ILocationRepo) {}
  async get() { return this.local.get(); }
  async save(l: LocationContext) { await this.local.save(l); /* location not synced — per-device */ }
}

class CloudEpisodicMemoryRepo implements IEpisodicMemoryRepo {
  constructor(private userId: string, private local: IEpisodicMemoryRepo) {}

  async get() { return this.local.get(); }

  async save(entries: EpisodicMemory[]) {
    await this.local.save(entries);
    const { error } = await supabase.from('episodic_memories')
      .upsert({ user_id: this.userId, entries }, { onConflict: 'user_id' });
    if (error) logCloudError('save episodic memory', error);
  }
}

class CloudSituationModelRepo implements ISituationModelRepo {
  constructor(private userId: string, private local: ISituationModelRepo) {}

  async get() { return this.local.get(); }

  async save(m: SituationModel) {
    await this.local.save(m);
    const { error } = await supabase.from('situation_models')
      .upsert({ user_id: this.userId, data: m }, { onConflict: 'user_id' });
    if (error) logCloudError('save situation model', error);
  }
}

class CloudKnowledgeGraphRepo implements IKnowledgeGraphRepo {
  constructor(private userId: string, private local: IKnowledgeGraphRepo) {}

  async get() { return this.local.get(); }

  async save(nodes: GraphNode[], edges: GraphEdge[]) {
    await this.local.save(nodes, edges);
    const { error } = await supabase.from('knowledge_graphs')
      .upsert({ user_id: this.userId, nodes, edges }, { onConflict: 'user_id' });
    if (error) logCloudError('save knowledge graph', error);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Remove avatarImageUrl (large base64) before sending to Supabase. */
function stripLargeFields(c: Character): Omit<Character, 'avatarImageUrl'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { avatarImageUrl: _img, ...rest } = c;
  return rest;
}

// ── Root ──────────────────────────────────────────────────────────────────────

export class CloudDatabase implements IDatabase {
  private localDb: LocalDatabase;

  characters: ICharacterRepo;
  conversations: IConversationRepo;
  characterMemories: ICharacterMemoryRepo;
  learnerProfile: ILearnerProfileRepo;
  relationships: IRelationshipRepo;
  profileMemory: IProfileMemoryRepo;
  preferences: IPreferencesRepo;
  location: ILocationRepo;
  episodicMemory: IEpisodicMemoryRepo;
  situationModel: ISituationModelRepo;
  knowledgeGraph: IKnowledgeGraphRepo;

  constructor(userId: string) {
    this.localDb = new LocalDatabase();
    this.characters       = new CloudCharacterRepo(userId, this.localDb.characters);
    this.conversations    = new CloudConversationRepo(userId, this.localDb.conversations);
    this.characterMemories = new CloudCharacterMemoryRepo(userId, this.localDb.characterMemories);
    this.learnerProfile   = new CloudLearnerProfileRepo(userId, this.localDb.learnerProfile);
    this.relationships    = new CloudRelationshipRepo(userId, this.localDb.relationships);
    this.profileMemory    = new CloudProfileMemoryRepo(userId, this.localDb.profileMemory);
    this.preferences      = new CloudPreferencesRepo(userId, this.localDb.preferences);
    this.location         = new CloudLocationRepo(this.localDb.location);
    this.episodicMemory   = new CloudEpisodicMemoryRepo(userId, this.localDb.episodicMemory);
    this.situationModel   = new CloudSituationModelRepo(userId, this.localDb.situationModel);
    this.knowledgeGraph   = new CloudKnowledgeGraphRepo(userId, this.localDb.knowledgeGraph);
  }
}
