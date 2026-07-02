/**
 * NAVI — Database Repository Interfaces
 *
 * These interfaces are the single abstraction point between the app and any
 * storage backend (LocalDatabase, CloudDatabase, or future alternatives like
 * Neon / PlanetScale / raw Postgres).
 *
 * To swap backends: implement IDatabase, call setDatabase(new MyDatabase()).
 * No other code changes required.
 */

import type { Character, MemoryEntry, UserPreferences } from '../types/character';
import type { Message } from '../types/chat';
import type { LocationContext } from '../types/config';
import type {
  LearnerProfile,
  RelationshipState,
  ProfileMemory,
  EpisodicMemory,
  SituationModel,
  GraphNode,
  GraphEdge,
} from '../agent/core/types';

// ── Per-entity repository interfaces ─────────────────────────────────────────

export interface ICharacterRepo {
  getAll(): Promise<Character[]>;
  save(character: Character): Promise<void>;
  saveAll(characters: Character[]): Promise<void>;
  delete(charId: string): Promise<void>;
}

export interface IConversationRepo {
  get(charId: string): Promise<Message[]>;
  save(charId: string, messages: Message[]): Promise<void>;
  delete(charId: string): Promise<void>;
}

export interface ICharacterMemoryRepo {
  get(charId: string): Promise<MemoryEntry[]>;
  save(charId: string, entries: MemoryEntry[]): Promise<void>;
  delete(charId: string): Promise<void>;
}

export interface ILearnerProfileRepo {
  get(): Promise<LearnerProfile | null>;
  save(profile: LearnerProfile): Promise<void>;
}

export interface IRelationshipRepo {
  /** Returns a map of avatarId → RelationshipState */
  get(): Promise<Record<string, RelationshipState> | null>;
  save(data: Record<string, RelationshipState>): Promise<void>;
}

export interface IProfileMemoryRepo {
  get(): Promise<ProfileMemory | null>;
  save(profile: ProfileMemory): Promise<void>;
}

export interface IPreferencesRepo {
  get(): Promise<UserPreferences | null>;
  save(prefs: UserPreferences): Promise<void>;
}

export interface ILocationRepo {
  get(): Promise<LocationContext | null>;
  save(location: LocationContext): Promise<void>;
}

export interface IEpisodicMemoryRepo {
  get(): Promise<EpisodicMemory[]>;
  save(entries: EpisodicMemory[]): Promise<void>;
}

export interface ISituationModelRepo {
  get(): Promise<SituationModel | null>;
  save(model: SituationModel): Promise<void>;
}

export interface IKnowledgeGraphRepo {
  get(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  save(nodes: GraphNode[], edges: GraphEdge[]): Promise<void>;
}

// ── Root database interface ───────────────────────────────────────────────────

export interface IDatabase {
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
}
