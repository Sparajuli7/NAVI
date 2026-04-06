/**
 * Integration test for the multi-agent overhaul.
 *
 * Tests: KnowledgeGraphStore, MemoryMaker, MemoryRetrievalAgent, ResearchAgent
 * Run: npx tsx src/agent/__tests__/agentOverhaul.test.ts
 *
 * This is a standalone script (not Jest) — prints pass/fail to console.
 */

import { KnowledgeGraphStore, nodeId, defaultMetadata } from '../memory/knowledgeGraph';
import { MemoryMaker } from '../memory/memoryMaker';
import type { ExchangeInput } from '../memory/memoryMaker';
import { MemoryRetrievalAgent } from '../agents/memoryRetrievalAgent';
import { ResearchAgent } from '../agents/researchAgent';
import type { ResearchQuery } from '../agents/researchAgent';
import type {
  TermNode,
  ConversationNode,
  TopicNode,
  LocationNode,
  ScenarioNode,
  PhraseMastery,
} from '../core/types';

// ─── Test Helpers ───────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string): void {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

// ─── Test 1: KnowledgeGraphStore CRUD ───────────────────────────

function testGraphCRUD(): void {
  console.log('\n📊 Test 1: KnowledgeGraphStore CRUD');
  const graph = new KnowledgeGraphStore();

  // Add nodes
  const termNode: TermNode = {
    id: nodeId('term'),
    type: 'term',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali', script: 'Devanagari', avatarId: 'av1', avatarName: 'Arjun' }),
    phrase: 'दाल भात',
    pronunciation: 'daal bhaat',
    meaning: 'lentil rice',
    language: 'Nepali',
    script: 'Devanagari',
    mastery: 'new' as PhraseMastery,
    attemptCount: 1,
    struggleCount: 0,
    firstSeen: Date.now(),
    lastPracticed: Date.now(),
    nextReviewAt: Date.now() + 172800000,
    learnedInConversation: '',
    learnedInScenario: '',
    learnedFromAvatar: '',
    learnedAtLocation: '',
    encounterType: 'scenario',
    inferredReason: 'User is practicing for: restaurant',
    relatedTerms: [],
  };
  graph.addNode(termNode);

  assert(graph.nodeCount === 1, 'Node added (count=1)');
  assert(graph.getNode(termNode.id)?.type === 'term', 'Node retrieved by ID');

  // Add location
  const locNode: LocationNode = {
    id: nodeId('location'),
    type: 'location',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali' }),
    city: 'Kathmandu',
    country: 'Nepal',
    dialectKey: 'NP/Kathmandu',
    language: 'Nepali',
    script: 'Devanagari',
    conversationIds: [],
    termIds: [termNode.id],
  };
  graph.addNode(locNode);

  // Add edge
  const edge = graph.addEdge('LEARNED_IN', termNode.id, locNode.id);
  assert(graph.edgeCount === 1, 'Edge added (count=1)');

  // Traverse
  const neighbors = graph.getNeighbors(termNode.id);
  assert(neighbors.length === 1, 'Neighbor traversal works');
  assert(neighbors[0].id === locNode.id, 'Correct neighbor returned');

  // Edges from/to
  const edgesFrom = graph.getEdgesFrom(termNode.id, 'LEARNED_IN');
  assert(edgesFrom.length === 1, 'getEdgesFrom works');

  const edgesTo = graph.getEdgesTo(locNode.id, 'LEARNED_IN');
  assert(edgesTo.length === 1, 'getEdgesTo works');

  // Subgraph
  const sub = graph.getSubgraph(termNode.id, 2);
  assert(sub.nodes.length === 2, 'Subgraph has 2 nodes');
  assert(sub.edges.length === 1, 'Subgraph has 1 edge');

  // Type queries
  const terms = graph.getNodesByType<TermNode>('term');
  assert(terms.length === 1, 'getNodesByType returns term');
  assert(terms[0].phrase === 'दाल भात', 'Term phrase correct');

  // Find by phrase
  const found = graph.findTermNode('दाल भात', 'Nepali');
  assert(found !== undefined, 'findTermNode works');

  // Find location
  const foundLoc = graph.findLocationNode('Kathmandu', 'NP/Kathmandu');
  assert(foundLoc !== undefined, 'findLocationNode works');

  // Update node
  const updatedTerm: TermNode = { ...termNode, mastery: 'learning' as PhraseMastery };
  graph.updateNode(termNode.id, updatedTerm);
  const updated = graph.getNode<TermNode>(termNode.id);
  assert(updated?.mastery === 'learning', 'Node update works');

  // Remove edge
  graph.removeEdge(edge.id);
  assert(graph.edgeCount === 0, 'Edge removed');

  // Remove node
  graph.removeNode(termNode.id);
  assert(graph.nodeCount === 1, 'Node removed (location remains)');

  // Serialization
  const serialized = graph.serialize();
  assert(serialized.nodes.length === 1, 'Serialize works');

  const graph2 = new KnowledgeGraphStore();
  graph2.deserialize(serialized);
  assert(graph2.nodeCount === 1, 'Deserialize works');

  // Stats
  const stats = graph.getStats();
  assert(stats.locationCount === 1, 'Stats count locations');

  // Clear (catch IndexedDB error in Node.js — only available in browser)
  graph.clear().catch(() => {});
  assert(graph.nodeCount === 0, 'Clear works');
}

// ─── Test 2: MemoryMaker ────────────────────────────────────────

async function testMemoryMaker(): Promise<void> {
  console.log('\n🧠 Test 2: MemoryMaker');
  const graph = new KnowledgeGraphStore();
  const maker = new MemoryMaker(graph, null); // no LLM for test

  const exchange: ExchangeInput = {
    userMessage: 'How do I order food at a restaurant here?',
    assistantResponse: '**Phrase:** दाल भात\n**Say it:** daal bhaat\n**Means:** lentil rice (the staple meal)',
    detectedPhrases: [{ phrase: 'दाल भात', pronunciation: 'daal bhaat', meaning: 'lentil rice' }],
    detectedTopics: ['ordering_food'],
    toolUsed: 'chat',
    avatarId: 'avatar_123',
    avatarName: 'Arjun',
    location: 'Kathmandu',
    scenario: 'restaurant',
    language: 'Nepali',
    script: 'Devanagari',
    dialectKey: 'NP/Kathmandu',
    userMode: 'learn',
    situationModel: null,
  };

  const result = await maker.processExchange(exchange);

  assert(result.nodesCreated.length > 0, `Nodes created: ${result.nodesCreated.length}`);
  assert(result.edgesCreated.length > 0, `Edges created: ${result.edgesCreated.length}`);
  assert(result.conversationNodeId !== '', 'Conversation node ID set');

  // Check that the graph has the right structure
  const terms = graph.getNodesByType<TermNode>('term');
  assert(terms.length === 1, 'One term node created');
  assert(terms[0].phrase === 'दाल भात', 'Term phrase is correct');
  assert(terms[0].encounterType === 'organic', 'Encounter type: organic (chat tool, scenario active)');
  assert(terms[0].inferredReason.includes('restaurant'), 'Inferred reason mentions restaurant');
  assert(terms[0].language === 'Nepali', 'Language set correctly');

  const convs = graph.getNodesByType<ConversationNode>('conversation');
  assert(convs.length === 1, 'One conversation node');
  assert(convs[0].termsIntroduced.length === 1, 'Conversation links to term');
  assert(convs[0].mood === 'curious', 'Mood detected as curious');

  const topics = graph.getNodesByType<TopicNode>('topic');
  assert(topics.length === 1, 'One topic node');
  assert(topics[0].name === 'ordering_food', 'Topic name correct');
  assert(topics[0].termIds.includes(terms[0].id), 'Topic links to term');

  const locations = graph.getNodesByType<LocationNode>('location');
  assert(locations.length === 1, 'One location node');
  assert(locations[0].city === 'Kathmandu', 'Location city correct');

  const scenarios = graph.getNodesByType<ScenarioNode>('scenario');
  assert(scenarios.length === 1, 'One scenario node');
  assert(scenarios[0].scenarioKey === 'restaurant', 'Scenario key correct');

  // Test second exchange (same conversation, should UPDATE not create new)
  const exchange2: ExchangeInput = {
    ...exchange,
    userMessage: 'What else should I try?',
    assistantResponse: 'Try मो:मो (mo-mo) — steamed dumplings! Everyone loves them here.',
    detectedPhrases: [{ phrase: 'मो:मो', pronunciation: 'mo-mo', meaning: 'steamed dumplings' }],
    detectedTopics: ['ordering_food'],
  };
  const result2 = await maker.processExchange(exchange2);

  const convs2 = graph.getNodesByType<ConversationNode>('conversation');
  assert(convs2.length === 1, 'Still one conversation (updated, not duplicated)');
  assert(convs2[0].turnCount === 2, 'Turn count incremented to 2');

  const terms2 = graph.getNodesByType<TermNode>('term');
  assert(terms2.length === 2, 'Two terms now');

  const stats = graph.getStats();
  assert(stats.termCount === 2, 'Stats: 2 terms');
  assert(stats.conversationCount === 1, 'Stats: 1 conversation');
  assert(stats.topicCount === 1, 'Stats: 1 topic');
  assert(stats.edgeCount > 5, `Multiple edges created: ${stats.edgeCount}`);

  console.log(`  📈 Graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges`);
}

// ─── Test 3: MemoryRetrievalAgent ───────────────────────────────

function testMemoryRetrieval(): void {
  console.log('\n🔍 Test 3: MemoryRetrievalAgent');

  // Build a graph with known data
  const graph = new KnowledgeGraphStore();

  const locId = nodeId('location');
  graph.addNode<LocationNode>({
    id: locId, type: 'location', createdAt: Date.now(), updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali' }),
    city: 'Kathmandu', country: 'Nepal', dialectKey: 'NP/Kathmandu',
    language: 'Nepali', script: 'Devanagari', conversationIds: [], termIds: [],
  });

  const topicId = nodeId('topic');
  const termId1 = nodeId('term');
  const termId2 = nodeId('term');

  graph.addNode<TopicNode>({
    id: topicId, type: 'topic', createdAt: Date.now(), updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali' }),
    name: 'greetings', proficiencyScore: 0.3, termIds: [termId1, termId2], lastPracticed: Date.now(),
  });

  graph.addNode<TermNode>({
    id: termId1, type: 'term', createdAt: Date.now(), updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali', engagementScore: 0.8 }),
    phrase: 'नमस्ते', pronunciation: 'namaste', meaning: 'hello',
    language: 'Nepali', script: 'Devanagari', mastery: 'learning' as PhraseMastery,
    attemptCount: 3, struggleCount: 0, firstSeen: Date.now() - 86400000,
    lastPracticed: Date.now() - 3600000, nextReviewAt: Date.now() - 1000, // due!
    learnedInConversation: '', learnedInScenario: '', learnedFromAvatar: '',
    learnedAtLocation: locId, encounterType: 'organic',
    inferredReason: 'Basic greeting', relatedTerms: [termId2],
  });

  graph.addNode<TermNode>({
    id: termId2, type: 'term', createdAt: Date.now(), updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali', engagementScore: 0.4 }),
    phrase: 'धन्यवाद', pronunciation: 'dhanyavaad', meaning: 'thank you',
    language: 'Nepali', script: 'Devanagari', mastery: 'new' as PhraseMastery,
    attemptCount: 1, struggleCount: 2, firstSeen: Date.now(),
    lastPracticed: Date.now(), nextReviewAt: Date.now() + 86400000,
    learnedInConversation: '', learnedInScenario: '', learnedFromAvatar: '',
    learnedAtLocation: locId, encounterType: 'requested',
    inferredReason: 'Politeness basics', relatedTerms: [],
  });

  graph.addEdge('CONTAINS_TERM', topicId, termId1);
  graph.addEdge('CONTAINS_TERM', topicId, termId2);

  const agent = new MemoryRetrievalAgent(graph);

  // Turn context query
  const result = agent.retrieve({
    userMessage: 'hello how are you',
    currentTopics: ['greetings'],
    currentScenario: '',
    currentLocation: 'Kathmandu',
    currentAvatarId: 'av1',
    language: 'Nepali',
    queryType: 'turn_context',
  });

  assert(result.relatedTerms.length >= 2, `Related terms found: ${result.relatedTerms.length}`);
  assert(result.promptInjection.includes('नमस्ते'), 'Prompt injection includes known term');
  assert(result.struggleTerms.length >= 1, `Struggle terms found: ${result.struggleTerms.length}`);
  assert(result.relevanceScore > 0.3, `Relevance score: ${result.relevanceScore.toFixed(2)}`);

  // Teaching context query
  const teachResult = agent.retrieve({
    userMessage: 'teach me more greetings',
    currentTopics: ['greetings'],
    currentScenario: '',
    currentLocation: 'Kathmandu',
    currentAvatarId: 'av1',
    language: 'Nepali',
    queryType: 'teaching',
  });
  assert(teachResult.promptInjection.includes('ALREADY KNOWS') || teachResult.promptInjection.includes('STRUGGLING'), 'Teaching context has user knowledge');

  // Session start query
  const convId = nodeId('conversation');
  graph.addNode<ConversationNode>({
    id: convId, type: 'conversation', createdAt: Date.now() - 86400000, updatedAt: Date.now(),
    metadata: defaultMetadata({ language: 'Nepali', avatarId: 'av1', avatarName: 'Arjun', engagementScore: 0.7 }),
    summary: 'Practiced greetings in Kathmandu', turnCount: 5,
    userMessages: ['hello', 'how do I say thank you'], termsIntroduced: [termId1],
    topicsCovered: [topicId], location: 'Kathmandu', scenario: '', mood: 'curious',
  });

  const sessionResult = agent.retrieve({
    userMessage: '', currentTopics: [], currentScenario: '', currentLocation: 'Kathmandu',
    currentAvatarId: 'av1', language: 'Nepali', queryType: 'session_start',
  });
  assert(sessionResult.promptInjection.includes('LAST SESSION') || sessionResult.promptInjection.includes('LEARNED'), 'Session start recap works');

  console.log(`  📝 Prompt injection length: ${result.promptInjection.length} chars`);
}

// ─── Test 4: ResearchAgent ──────────────────────────────────────

function testResearchAgent(): void {
  console.log('\n🔬 Test 4: ResearchAgent');
  const agent = new ResearchAgent();

  // Frustrated user → affective_filter should fire
  const frustrated: ResearchQuery = {
    userMessage: 'I can\'t do this, it\'s too hard',
    currentTier: 1, userMode: 'learn', recentEngagement: 0.3,
    termsInSession: 0, turnsWithoutOutput: 0, userShowingFrustration: true,
    struggleTerms: [], activeScenario: '', language: 'Nepali', script: 'Devanagari',
    location: 'Kathmandu', encounterContext: '', inferredReason: '',
  };
  const r1 = agent.getRecommendation(frustrated);
  assert(r1.protocols.length > 0, 'Frustrated: protocols recommended');
  assert(r1.protocols[0].name === 'affective_filter', 'Frustrated: affective_filter is primary');
  assert(r1.adjustments.maxNewTerms === 0, 'Frustrated: no new terms');
  assert(r1.adjustments.targetLanguageRatio === 0.3, 'Frustrated: low target language ratio');

  // Passive user → output_hypothesis
  const passive: ResearchQuery = {
    ...frustrated, userShowingFrustration: false,
    userMessage: 'ok', turnsWithoutOutput: 4,
  };
  const r2 = agent.getRecommendation(passive);
  assert(r2.protocols.some(p => p.name === 'output_hypothesis'), 'Passive: output_hypothesis fires');

  // Struggling terms → spaced_repetition
  const struggling: ResearchQuery = {
    ...frustrated, userShowingFrustration: false,
    userMessage: 'let\'s practice', turnsWithoutOutput: 0,
    struggleTerms: ['"नमस्ते"'],
  };
  const r3 = agent.getRecommendation(struggling);
  assert(r3.protocols.some(p => p.name === 'spaced_repetition'), 'Struggling: spaced_repetition fires');

  // Active scenario → contextual_learning
  const scenario: ResearchQuery = {
    ...frustrated, userShowingFrustration: false,
    userMessage: 'I\'m at the market', turnsWithoutOutput: 0,
    activeScenario: 'market', termsInSession: 1,
  };
  const r4 = agent.getRecommendation(scenario);
  assert(r4.protocols.some(p => p.name === 'contextual_learning'), 'Scenario: contextual_learning fires');

  // Guide mode → no protocols
  const guide: ResearchQuery = {
    ...frustrated, userMode: 'guide',
  };
  const r5 = agent.getRecommendation(guide);
  assert(r5.protocols.length === 0, 'Guide mode: no learning protocols');
  assert(r5.promptInjection === '', 'Guide mode: empty injection');

  // Max 3 protocols
  const complex: ResearchQuery = {
    ...frustrated, userShowingFrustration: true, turnsWithoutOutput: 5,
    struggleTerms: ['"test"'], activeScenario: 'restaurant', termsInSession: 1,
  };
  const r6 = agent.getRecommendation(complex);
  assert(r6.protocols.length <= 3, `Max 3 protocols: got ${r6.protocols.length}`);

  // Readiness assessment
  const readiness = agent.assessReadiness({
    phrases: [], topics: [], languageComfortTier: 1, comfortAssessed: true,
    recentOpeners: [],
    stats: { totalPhrases: 20, masteredPhrases: 10, currentStreak: 5, longestStreak: 10, lastSessionDate: Date.now(), totalSessions: 15 },
  }, 'Nepali');
  assert(readiness.ready === true, `Readiness: tier 1 with 20 phrases → ready to advance`);
  assert(readiness.suggestedTier === 2, `Suggested tier: ${readiness.suggestedTier}`);

  console.log(`  📋 Sample injection:\n    ${r1.promptInjection.split('\n').join('\n    ')}`);
}

// ─── Run All Tests ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  NAVI Multi-Agent Overhaul — Test Suite');
  console.log('═══════════════════════════════════════════');

  testGraphCRUD();
  await testMemoryMaker();
  testMemoryRetrieval();
  testResearchAgent();

  console.log('\n═══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
