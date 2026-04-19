/**
 * NAVI Agent Framework — Knowledge Graph Store
 *
 * A typed graph database for user learning memories. Nodes represent
 * conversations, terms, topics, scenarios, avatars, and locations.
 * Edges represent relationships (LEARNED_IN, TAUGHT_BY, etc.).
 *
 * Design decisions:
 * - In-memory graph with IndexedDB persistence (fast traversal on mobile)
 * - Adjacency list for O(1) neighbor lookup
 * - Max 2000 nodes / 5000 edges — sufficient for years of casual use
 * - Evicts oldest low-engagement nodes when over capacity
 *
 * Persistence: Two IndexedDB keys — navi_kg_nodes + navi_kg_edges
 */

import { get, set } from 'idb-keyval';
import type {
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  ConversationNode,
  TermNode,
  TopicNode,
  ScenarioNode,
  AvatarGraphNode,
  LocationNode,
  NodeMetadata,
} from '../core/types';

const NODES_KEY = 'navi_kg_nodes';
const EDGES_KEY = 'navi_kg_edges';
const MAX_NODES = 2000;
const MAX_EDGES = 5000;

// ─── Default metadata (used when creating nodes without full context) ──

export function defaultMetadata(overrides?: Partial<NodeMetadata>): NodeMetadata {
  return {
    engagementScore: 0.5,
    language: '',
    script: '',
    avatarId: '',
    avatarName: '',
    encounterContext: '',
    inferredReason: '',
    ...overrides,
  };
}

// ─── ID generators ──────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function nodeId(type: NodeType): string {
  return makeId(type);
}

export function edgeId(): string {
  return makeId('edge');
}

// ─── KnowledgeGraphStore ────────────────────────────────────────

export class KnowledgeGraphStore {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  /** nodeId → Set of edgeIds (both directions) */
  private adjacency = new Map<string, Set<string>>();
  private loaded = false;

  // ── Persistence ───────────────────────────────────────────────

  async load(): Promise<void> {
    if (this.loaded) return;
    const [rawNodes, rawEdges] = await Promise.all([
      get<GraphNode[]>(NODES_KEY),
      get<GraphEdge[]>(EDGES_KEY),
    ]);

    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();

    for (const n of rawNodes ?? []) {
      this.nodes.set(n.id, n);
      if (!this.adjacency.has(n.id)) this.adjacency.set(n.id, new Set());
    }
    for (const e of rawEdges ?? []) {
      this.edges.set(e.id, e);
      this.touchAdjacency(e.sourceId, e.id);
      this.touchAdjacency(e.targetId, e.id);
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    await Promise.all([
      set(NODES_KEY, [...this.nodes.values()]),
      set(EDGES_KEY, [...this.edges.values()]),
    ]);
  }

  // ── Node CRUD ─────────────────────────────────────────────────

  addNode<T extends GraphNode>(node: T): T {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) this.adjacency.set(node.id, new Set());
    this.enforceNodeCapacity();
    return node;
  }

  getNode<T extends GraphNode = GraphNode>(id: string): T | undefined {
    return this.nodes.get(id) as T | undefined;
  }

  getNodesByType<T extends GraphNode = GraphNode>(type: NodeType): T[] {
    const result: T[] = [];
    for (const n of this.nodes.values()) {
      if (n.type === type) result.push(n as T);
    }
    return result;
  }

  updateNode(id: string, updates: Partial<GraphNode>): void {
    const existing = this.nodes.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates, id: existing.id, type: existing.type, updatedAt: Date.now() };
    this.nodes.set(id, updated);
  }

  removeNode(id: string): void {
    // Remove all edges connected to this node
    const edgeIds = this.adjacency.get(id);
    if (edgeIds) {
      for (const eid of edgeIds) {
        const edge = this.edges.get(eid);
        if (edge) {
          // Remove from the other side's adjacency
          const otherId = edge.sourceId === id ? edge.targetId : edge.sourceId;
          this.adjacency.get(otherId)?.delete(eid);
        }
        this.edges.delete(eid);
      }
    }
    this.adjacency.delete(id);
    this.nodes.delete(id);
  }

  // ── Edge CRUD ─────────────────────────────────────────────────

  addEdge(type: EdgeType, sourceId: string, targetId: string, weight = 1.0, metadata: Record<string, unknown> = {}): GraphEdge {
    const edge: GraphEdge = {
      id: edgeId(),
      type,
      sourceId,
      targetId,
      weight,
      metadata,
      createdAt: Date.now(),
    };
    this.edges.set(edge.id, edge);
    this.touchAdjacency(sourceId, edge.id);
    this.touchAdjacency(targetId, edge.id);
    this.enforceEdgeCapacity();
    return edge;
  }

  getEdgesFrom(nodeId: string, type?: EdgeType): GraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    for (const eid of edgeIds) {
      const e = this.edges.get(eid);
      if (e && e.sourceId === nodeId && (!type || e.type === type)) {
        result.push(e);
      }
    }
    return result;
  }

  getEdgesTo(nodeId: string, type?: EdgeType): GraphEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    for (const eid of edgeIds) {
      const e = this.edges.get(eid);
      if (e && e.targetId === nodeId && (!type || e.type === type)) {
        result.push(e);
      }
    }
    return result;
  }

  getEdgesBetween(sourceId: string, targetId: string): GraphEdge[] {
    const edgeIds = this.adjacency.get(sourceId);
    if (!edgeIds) return [];
    const result: GraphEdge[] = [];
    for (const eid of edgeIds) {
      const e = this.edges.get(eid);
      if (e && ((e.sourceId === sourceId && e.targetId === targetId) ||
                (e.sourceId === targetId && e.targetId === sourceId))) {
        result.push(e);
      }
    }
    return result;
  }

  removeEdge(id: string): void {
    const edge = this.edges.get(id);
    if (!edge) return;
    this.adjacency.get(edge.sourceId)?.delete(id);
    this.adjacency.get(edge.targetId)?.delete(id);
    this.edges.delete(id);
  }

  // ── Graph Traversal ───────────────────────────────────────────

  /** Get direct neighbors of a node (1-hop). Optionally filter by node type. */
  getNeighbors(nodeId: string, filterType?: NodeType): GraphNode[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const neighborIds = new Set<string>();
    for (const eid of edgeIds) {
      const e = this.edges.get(eid);
      if (!e) continue;
      const otherId = e.sourceId === nodeId ? e.targetId : e.sourceId;
      neighborIds.add(otherId);
    }
    const result: GraphNode[] = [];
    for (const nid of neighborIds) {
      const n = this.nodes.get(nid);
      if (n && (!filterType || n.type === filterType)) result.push(n);
    }
    return result;
  }

  /** BFS to get subgraph within `radius` hops of `centerNodeId` */
  getSubgraph(centerNodeId: string, radius: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: centerNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visitedNodes.has(id) || depth > radius) continue;
      visitedNodes.add(id);

      const edgeIds = this.adjacency.get(id);
      if (!edgeIds) continue;
      for (const eid of edgeIds) {
        visitedEdges.add(eid);
        const e = this.edges.get(eid);
        if (!e) continue;
        const otherId = e.sourceId === id ? e.targetId : e.sourceId;
        if (!visitedNodes.has(otherId) && depth + 1 <= radius) {
          queue.push({ id: otherId, depth: depth + 1 });
        }
      }
    }

    return {
      nodes: [...visitedNodes].map(id => this.nodes.get(id)!).filter(Boolean),
      edges: [...visitedEdges].map(id => this.edges.get(id)!).filter(Boolean),
    };
  }

  // ── Domain-Specific Queries ───────────────────────────────────

  /** Get all term nodes learned in a specific scenario */
  getTermsInScenario(scenarioNodeId: string): TermNode[] {
    const scenario = this.getNode<ScenarioNode>(scenarioNodeId);
    if (!scenario) return [];
    return scenario.termIds
      .map(id => this.getNode<TermNode>(id))
      .filter((n): n is TermNode => n?.type === 'term');
  }

  /** Get all term nodes taught by a specific avatar */
  getTermsByAvatar(avatarNodeId: string): TermNode[] {
    const edges = this.getEdgesTo(avatarNodeId, 'TAUGHT_BY');
    return edges
      .map(e => this.getNode<TermNode>(e.sourceId))
      .filter((n): n is TermNode => n?.type === 'term');
  }

  /** Get all term nodes learned at a specific location */
  getTermsAtLocation(locationNodeId: string): TermNode[] {
    const loc = this.getNode<LocationNode>(locationNodeId);
    if (!loc) return [];
    return loc.termIds
      .map(id => this.getNode<TermNode>(id))
      .filter((n): n is TermNode => n?.type === 'term');
  }

  /** Get conversations where a term was learned or practiced */
  getConversationsForTerm(termNodeId: string): ConversationNode[] {
    const edgeTypes: EdgeType[] = ['LEARNED_IN', 'PRACTICED_IN'];
    const convIds = new Set<string>();
    for (const type of edgeTypes) {
      for (const e of this.getEdgesFrom(termNodeId, type)) {
        convIds.add(e.targetId);
      }
    }
    return [...convIds]
      .map(id => this.getNode<ConversationNode>(id))
      .filter((n): n is ConversationNode => n?.type === 'conversation');
  }

  /** Get terms related to a given term (via RELATES_TO edges) */
  getRelatedTerms(termNodeId: string): TermNode[] {
    const neighbors = this.getNeighbors(termNodeId, 'term');
    return neighbors as TermNode[];
  }

  /** Get the N most-engaged conversations (sorted by engagement score desc) */
  getMostEngagedConversations(limit: number): ConversationNode[] {
    return this.getNodesByType<ConversationNode>('conversation')
      .sort((a, b) => b.metadata.engagementScore - a.metadata.engagementScore)
      .slice(0, limit);
  }

  /** Get struggling terms with their learning context */
  getStrugglingTermsWithContext(): Array<{ term: TermNode; conversations: ConversationNode[] }> {
    const terms = this.getNodesByType<TermNode>('term')
      .filter(t => t.struggleCount > 0 && t.mastery !== 'mastered')
      .sort((a, b) => b.struggleCount - a.struggleCount);

    return terms.map(term => ({
      term,
      conversations: this.getConversationsForTerm(term.id),
    }));
  }

  /** Get terms grouped by encounter type */
  getTermsByEncounterType(encounterType: TermNode['encounterType']): TermNode[] {
    return this.getNodesByType<TermNode>('term')
      .filter(t => t.encounterType === encounterType);
  }

  /** Group terms by their inferred reason (clusters similar reasons) */
  getReasonClusters(): Map<string, TermNode[]> {
    const clusters = new Map<string, TermNode[]>();
    for (const term of this.getNodesByType<TermNode>('term')) {
      const reason = term.inferredReason || 'unknown';
      const existing = clusters.get(reason) ?? [];
      existing.push(term);
      clusters.set(reason, existing);
    }
    return clusters;
  }

  /** Find or create a location node by city/dialectKey */
  findLocationNode(city: string, dialectKey: string): LocationNode | undefined {
    for (const n of this.nodes.values()) {
      if (n.type === 'location') {
        const loc = n as LocationNode;
        if (loc.dialectKey === dialectKey || loc.city.toLowerCase() === city.toLowerCase()) {
          return loc;
        }
      }
    }
    return undefined;
  }

  /** Find or create a scenario node by key */
  findScenarioNode(scenarioKey: string): ScenarioNode | undefined {
    for (const n of this.nodes.values()) {
      if (n.type === 'scenario' && (n as ScenarioNode).scenarioKey === scenarioKey) {
        return n as ScenarioNode;
      }
    }
    return undefined;
  }

  /** Find or create an avatar node by avatarId */
  findAvatarNode(avatarId: string): AvatarGraphNode | undefined {
    for (const n of this.nodes.values()) {
      if (n.type === 'avatar' && (n as AvatarGraphNode).avatarId === avatarId) {
        return n as AvatarGraphNode;
      }
    }
    return undefined;
  }

  /** Find a term node by phrase text and language */
  findTermNode(phrase: string, language: string): TermNode | undefined {
    const lower = phrase.toLowerCase();
    for (const n of this.nodes.values()) {
      if (n.type === 'term' && (n as TermNode).phrase.toLowerCase() === lower &&
          (n as TermNode).language === language) {
        return n as TermNode;
      }
    }
    return undefined;
  }

  /** Find a topic node by name */
  findTopicNode(name: string): TopicNode | undefined {
    const lower = name.toLowerCase();
    for (const n of this.nodes.values()) {
      if (n.type === 'topic' && (n as TopicNode).name.toLowerCase() === lower) {
        return n as TopicNode;
      }
    }
    return undefined;
  }

  // ── Stats ─────────────────────────────────────────────────────

  getStats(): {
    nodeCount: number;
    edgeCount: number;
    termCount: number;
    conversationCount: number;
    topicCount: number;
    locationCount: number;
  } {
    let termCount = 0;
    let conversationCount = 0;
    let topicCount = 0;
    let locationCount = 0;
    for (const n of this.nodes.values()) {
      if (n.type === 'term') termCount++;
      else if (n.type === 'conversation') conversationCount++;
      else if (n.type === 'topic') topicCount++;
      else if (n.type === 'location') locationCount++;
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      termCount,
      conversationCount,
      topicCount,
      locationCount,
    };
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }

  // ── Serialization ─────────────────────────────────────────────

  serialize(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }

  deserialize(data: { nodes: GraphNode[]; edges: GraphEdge[] }): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
    for (const n of data.nodes) {
      this.nodes.set(n.id, n);
      if (!this.adjacency.has(n.id)) this.adjacency.set(n.id, new Set());
    }
    for (const e of data.edges) {
      this.edges.set(e.id, e);
      this.touchAdjacency(e.sourceId, e.id);
      this.touchAdjacency(e.targetId, e.id);
    }
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    this.adjacency.clear();
    await this.save();
  }

  // ── Internal Helpers ──────────────────────────────────────────

  private touchAdjacency(nodeId: string, edgeId: string): void {
    if (!this.adjacency.has(nodeId)) this.adjacency.set(nodeId, new Set());
    this.adjacency.get(nodeId)!.add(edgeId);
  }

  /** Evict lowest-engagement nodes when over capacity */
  private enforceNodeCapacity(): void {
    if (this.nodes.size <= MAX_NODES) return;
    const sorted = [...this.nodes.values()]
      .sort((a, b) => a.metadata.engagementScore - b.metadata.engagementScore);
    const toRemove = sorted.slice(0, this.nodes.size - MAX_NODES);
    for (const n of toRemove) {
      this.removeNode(n.id);
    }
  }

  /** Evict oldest edges when over capacity */
  private enforceEdgeCapacity(): void {
    if (this.edges.size <= MAX_EDGES) return;
    const sorted = [...this.edges.values()]
      .sort((a, b) => a.createdAt - b.createdAt);
    const toRemove = sorted.slice(0, this.edges.size - MAX_EDGES);
    for (const e of toRemove) {
      this.removeEdge(e.id);
    }
  }
}
