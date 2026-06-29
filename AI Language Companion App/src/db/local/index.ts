/**
 * LocalDatabase — IndexedDB-backed implementation of IDatabase.
 *
 * This is the default backend. Every method is a thin wrapper around the
 * existing idb-keyval calls used throughout the app. No logic changes.
 */

import { get, set, del } from 'idb-keyval';
import type { IDatabase, ICharacterRepo, IConversationRepo, ICharacterMemoryRepo,
  ILearnerProfileRepo, IRelationshipRepo, IProfileMemoryRepo, IPreferencesRepo,
  ILocationRepo, IEpisodicMemoryRepo, ISituationModelRepo, IKnowledgeGraphRepo } from '../types';
import type { Character, MemoryEntry, UserPreferences } from '../../types/character';
import type { Message } from '../../types/chat';
import type { LocationContext } from '../../types/config';
import type {
  LearnerProfile, RelationshipState, ProfileMemory,
  EpisodicMemory, SituationModel, GraphNode, GraphEdge,
} from '../../agent/core/types';

const convKey  = (id: string) => `navi_conv_${id}`;
const memKey   = (id: string) => `navi_mem_${id}`;

class LocalCharacterRepo implements ICharacterRepo {
  async getAll() { return (await get<Character[]>('navi_characters')) ?? []; }
  async save(c: Character) {
    const all = await this.getAll();
    const idx = all.findIndex(x => x.id === c.id);
    if (idx >= 0) all[idx] = c; else all.push(c);
    await set('navi_characters', all);
  }
  async saveAll(cs: Character[]) { await set('navi_characters', cs); }
  async delete(id: string) {
    const all = await this.getAll();
    await set('navi_characters', all.filter(c => c.id !== id));
  }
}

class LocalConversationRepo implements IConversationRepo {
  async get(charId: string) { return (await get<Message[]>(convKey(charId))) ?? []; }
  async save(charId: string, msgs: Message[]) { await set(convKey(charId), msgs); }
  async delete(charId: string) { await del(convKey(charId)); }
}

class LocalCharacterMemoryRepo implements ICharacterMemoryRepo {
  async get(charId: string) { return (await get<MemoryEntry[]>(memKey(charId))) ?? []; }
  async save(charId: string, entries: MemoryEntry[]) { await set(memKey(charId), entries); }
  async delete(charId: string) { await del(memKey(charId)); }
}

class LocalLearnerProfileRepo implements ILearnerProfileRepo {
  async get() { return (await get<LearnerProfile>('navi_learner_profile')) ?? null; }
  async save(p: LearnerProfile) { await set('navi_learner_profile', p); }
}

class LocalRelationshipRepo implements IRelationshipRepo {
  async get() { return (await get<Record<string, RelationshipState>>('navi_relationships')) ?? null; }
  async save(d: Record<string, RelationshipState>) { await set('navi_relationships', d); }
}

class LocalProfileMemoryRepo implements IProfileMemoryRepo {
  async get() { return (await get<ProfileMemory>('navi_profile_memory')) ?? null; }
  async save(p: ProfileMemory) { await set('navi_profile_memory', p); }
}

class LocalPreferencesRepo implements IPreferencesRepo {
  async get() { return (await get<UserPreferences>('navi_preferences')) ?? null; }
  async save(p: UserPreferences) { await set('navi_preferences', p); }
}

class LocalLocationRepo implements ILocationRepo {
  async get() { return (await get<LocationContext>('navi_location')) ?? null; }
  async save(l: LocationContext) { await set('navi_location', l); }
}

class LocalEpisodicMemoryRepo implements IEpisodicMemoryRepo {
  async get() { return (await get<EpisodicMemory[]>('navi_episodic_memory')) ?? []; }
  async save(e: EpisodicMemory[]) { await set('navi_episodic_memory', e); }
}

class LocalSituationModelRepo implements ISituationModelRepo {
  async get() { return (await get<SituationModel>('navi_situation_model')) ?? null; }
  async save(m: SituationModel) { await set('navi_situation_model', m); }
}

class LocalKnowledgeGraphRepo implements IKnowledgeGraphRepo {
  async get() {
    const nodes = (await get<GraphNode[]>('navi_kg_nodes')) ?? [];
    const edges = (await get<GraphEdge[]>('navi_kg_edges')) ?? [];
    return { nodes, edges };
  }
  async save(nodes: GraphNode[], edges: GraphEdge[]) {
    await Promise.all([
      set('navi_kg_nodes', nodes),
      set('navi_kg_edges', edges),
    ]);
  }
}

export class LocalDatabase implements IDatabase {
  characters      = new LocalCharacterRepo();
  conversations   = new LocalConversationRepo();
  characterMemories = new LocalCharacterMemoryRepo();
  learnerProfile  = new LocalLearnerProfileRepo();
  relationships   = new LocalRelationshipRepo();
  profileMemory   = new LocalProfileMemoryRepo();
  preferences     = new LocalPreferencesRepo();
  location        = new LocalLocationRepo();
  episodicMemory  = new LocalEpisodicMemoryRepo();
  situationModel  = new LocalSituationModelRepo();
  knowledgeGraph  = new LocalKnowledgeGraphRepo();
}
