/**
 * Sync Engine — pull cloud data into IndexedDB on login.
 *
 * Strategy: pull-on-login (cloud pre-populates IndexedDB), push-on-write
 * (each save call in CloudDatabase pushes to cloud after local write).
 *
 * This module only handles the pull direction.
 */

import { set } from 'idb-keyval';
import { supabase } from '../cloud/supabaseClient';
import type { Character } from '../../types/character';
import type { Message } from '../../types/chat';
import type { MemoryEntry } from '../../types/character';
import type {
  LearnerProfile, RelationshipState, ProfileMemory,
  EpisodicMemory, SituationModel, GraphNode, GraphEdge,
} from '../../agent/core/types';

const convKey = (id: string) => `navi_conv_${id}`;
const memKey  = (id: string) => `navi_mem_${id}`;

/**
 * Pull all user data from Supabase into IndexedDB.
 * Called once after login, before the existing boot sequence runs.
 * The existing code reads from IndexedDB and finds the cloud data already there.
 */
export async function pullAll(userId: string): Promise<void> {
  try {
    const [
      charsRes, convsRes, charMemsRes,
      learnerRes, relsRes, profileMemRes,
      prefsRes, episodicRes, situationRes, kgRes,
    ] = await Promise.all([
      supabase.from('characters').select('id,data').eq('user_id', userId),
      supabase.from('conversations').select('character_id,messages').eq('user_id', userId),
      supabase.from('character_memories').select('character_id,entries').eq('user_id', userId),
      supabase.from('learner_profiles').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('relationships').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('profile_memories').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('user_preferences').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('episodic_memories').select('entries').eq('user_id', userId).maybeSingle(),
      supabase.from('situation_models').select('data').eq('user_id', userId).maybeSingle(),
      supabase.from('knowledge_graphs').select('nodes,edges').eq('user_id', userId).maybeSingle(),
    ]);

    const writes: Promise<void>[] = [];

    // Characters
    if (charsRes.data?.length) {
      const cloudChars = charsRes.data.map(r => r.data as Character);
      writes.push(set('navi_characters', cloudChars));
    }

    // Per-character conversations
    if (convsRes.data?.length) {
      for (const row of convsRes.data) {
        writes.push(set(convKey(row.character_id), row.messages as Message[]));
      }
    }

    // Per-character memories
    if (charMemsRes.data?.length) {
      for (const row of charMemsRes.data) {
        writes.push(set(memKey(row.character_id), row.entries as MemoryEntry[]));
      }
    }

    // Singleton stores
    if (learnerRes.data?.data) writes.push(set('navi_learner_profile', learnerRes.data.data as LearnerProfile));
    if (relsRes.data?.data)    writes.push(set('navi_relationships', relsRes.data.data as Record<string, RelationshipState>));
    if (profileMemRes.data?.data) writes.push(set('navi_profile_memory', profileMemRes.data.data as ProfileMemory));
    if (prefsRes.data?.data)   writes.push(set('navi_preferences', prefsRes.data.data));
    if (episodicRes.data?.entries) writes.push(set('navi_episodic_memory', episodicRes.data.entries as EpisodicMemory[]));
    if (situationRes.data?.data)   writes.push(set('navi_situation_model', situationRes.data.data as SituationModel));

    // Knowledge graph
    if (kgRes.data) {
      writes.push(set('navi_kg_nodes', (kgRes.data.nodes ?? []) as GraphNode[]));
      writes.push(set('navi_kg_edges', (kgRes.data.edges ?? []) as GraphEdge[]));
    }

    await Promise.all(writes);
  } catch (err) {
    console.warn('[NAVI sync] pullAll failed (offline?):', err);
  }
}

/**
 * On first-ever login: push all local IndexedDB data up to Supabase.
 * Only called when cloud is empty (new account).
 */
export async function pushLocalToCloud(userId: string): Promise<void> {
  const { LocalDatabase } = await import('../local');
  const local = new LocalDatabase();

  const [chars, learner, rels, profMem, prefs, episodic, situation, kg] = await Promise.all([
    local.characters.getAll(),
    local.learnerProfile.get(),
    local.relationships.get(),
    local.profileMemory.get(),
    local.preferences.get(),
    local.episodicMemory.get(),
    local.situationModel.get(),
    local.knowledgeGraph.get(),
  ]);

  const ops: Promise<unknown>[] = [];

  if (chars.length) {
    const rows = chars.map(c => ({ id: c.id, user_id: userId, data: c }));
    ops.push(supabase.from('characters').upsert(rows, { onConflict: 'user_id,id' }));

    // Push conversations + memories for each character
    for (const c of chars) {
      const [msgs, mems] = await Promise.all([
        local.conversations.get(c.id),
        local.characterMemories.get(c.id),
      ]);
      if (msgs.length) {
        ops.push(supabase.from('conversations')
          .upsert({ character_id: c.id, user_id: userId, messages: msgs }, { onConflict: 'user_id,character_id' }));
      }
      if (mems.length) {
        ops.push(supabase.from('character_memories')
          .upsert({ character_id: c.id, user_id: userId, entries: mems }, { onConflict: 'user_id,character_id' }));
      }
    }
  }

  if (learner) ops.push(supabase.from('learner_profiles').upsert({ user_id: userId, data: learner }, { onConflict: 'user_id' }));
  if (rels)    ops.push(supabase.from('relationships').upsert({ user_id: userId, data: rels }, { onConflict: 'user_id' }));
  if (profMem) ops.push(supabase.from('profile_memories').upsert({ user_id: userId, data: profMem }, { onConflict: 'user_id' }));
  if (prefs)   ops.push(supabase.from('user_preferences').upsert({ user_id: userId, data: prefs }, { onConflict: 'user_id' }));
  if (episodic.length) ops.push(supabase.from('episodic_memories').upsert({ user_id: userId, entries: episodic }, { onConflict: 'user_id' }));
  if (situation) ops.push(supabase.from('situation_models').upsert({ user_id: userId, data: situation }, { onConflict: 'user_id' }));
  if (kg.nodes.length || kg.edges.length) {
    ops.push(supabase.from('knowledge_graphs').upsert({ user_id: userId, nodes: kg.nodes, edges: kg.edges }, { onConflict: 'user_id' }));
  }

  const results = await Promise.allSettled(ops);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length) {
    console.warn('[NAVI sync] pushLocalToCloud had failures:', failures);
  }
}
