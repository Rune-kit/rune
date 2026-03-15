---
name: "@rune/ai-ml"
description: AI/ML integration patterns — LLM integration, RAG pipelines, embeddings, fine-tuning workflows, stateful AI agents, and secure code execution sandboxes.
metadata:
  author: runedev
  version: "0.3.0"
  layer: L4
  price: "$15"
  target: AI engineers
---

# @rune/ai-ml

## Purpose

AI-powered features fail in predictable ways: LLM calls without retry logic that crash on rate limits, RAG pipelines that retrieve irrelevant chunks because the chunking strategy ignores document structure, embedding search that returns semantic matches with zero keyword overlap, fine-tuning runs that overfit because the eval set leaked into training data, AI agents that leak state across requests or lose progress on crashes, and code interpreters that execute untrusted LLM output without isolation. This pack codifies production patterns for each — from API client resilience to retrieval quality to model evaluation to agent state management to secure sandboxed execution — so AI features ship with the reliability of traditional software.

## Triggers

- Auto-trigger: when `openai`, `anthropic`, `@langchain`, `pinecone`, `pgvector`, `embedding`, `llm` detected in dependencies or code
- `/rune llm-integration` — audit or improve LLM API usage
- `/rune rag-patterns` — build or audit RAG pipeline
- `/rune embedding-search` — implement or optimize semantic search
- `/rune fine-tuning-guide` — prepare and execute fine-tuning workflow
- `/rune ai-agents` — design and build stateful AI agents
- `/rune code-sandbox` — set up secure code execution for AI
- Called by `cook` (L1) when AI/ML task detected
- Called by `plan` (L2) when AI architecture decisions needed

## Skills Included

### llm-integration

LLM integration patterns — API client wrappers, streaming responses, structured output, retry with exponential backoff, model fallback chains, prompt versioning.

#### Workflow

**Step 1 — Detect LLM usage**
Use Grep to find LLM API calls: `openai.chat`, `anthropic.messages`, `OpenAI(`, `Anthropic(`, `generateText`, `streamText`. Read client initialization and prompt construction to understand: model selection, error handling, output parsing, and token management.

**Step 2 — Audit resilience**
Check for: no retry on rate limit (429), no timeout on API calls, unstructured output parsing (regex on LLM text instead of function calling), hardcoded prompts without versioning, no token counting before request, missing fallback model chain, and streaming without backpressure handling.

**Step 3 — Emit robust LLM client**
Emit: typed client wrapper with exponential backoff retry, structured output via Zod schema + function calling, streaming with proper error boundaries, token budget management, and prompt version registry.

#### Example

```typescript
// Robust LLM client — retry, structured output, fallback chain
import OpenAI from 'openai';
import { z } from 'zod';

const client = new OpenAI();

const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

async function analyzeSentiment(text: string, attempt = 0): Promise<z.infer<typeof SentimentSchema>> {
  const models = ['gpt-4o-mini', 'gpt-4o'] as const; // fallback chain
  const model = attempt >= 2 ? models[1] : models[0];

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Analyze sentiment. Return JSON matching the schema.' },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      timeout: 10_000,
    });

    return SentimentSchema.parse(JSON.parse(response.choices[0].message.content!));
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError && attempt < 3) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      return analyzeSentiment(text, attempt + 1);
    }
    throw err;
  }
}
```

---

### rag-patterns

RAG pipeline patterns — document chunking, embedding generation, vector store setup, retrieval strategies, reranking.

#### Workflow

**Step 1 — Detect RAG components**
Use Grep to find vector store usage: `PineconeClient`, `pgvector`, `Weaviate`, `ChromaClient`, `QdrantClient`. Find embedding calls: `embeddings.create`, `embed()`. Read the ingestion pipeline and retrieval logic to map the full RAG flow.

**Step 2 — Audit retrieval quality**
Check for: fixed-size chunking that splits mid-sentence (context loss), no overlap between chunks (boundary information lost), embeddings generated without metadata (no filtering capability), retrieval without reranking (relevance drops after top-3), no chunk deduplication, and context window overflow (retrieved chunks exceed model limit).

**Step 3 — Emit RAG pipeline**
Emit: recursive text splitter with semantic boundaries, embedding generation with metadata, vector upsert with namespace, retrieval with reranking, and context window budget management.

#### Example

```typescript
// RAG pipeline — recursive chunking + pgvector + reranking
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';

// Ingestion: chunk → embed → store
async function ingestDocument(doc: { content: string; metadata: Record<string, string> }) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n## ', '\n### ', '\n\n', '\n', '. ', ' '],
  });
  const chunks = await splitter.createDocuments(
    [doc.content],
    [doc.metadata],
  );

  const embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
  await PGVectorStore.fromDocuments(chunks, embeddings, {
    postgresConnectionOptions: { connectionString: process.env.DATABASE_URL },
    tableName: 'documents',
  });
}

// Retrieval: query → vector search → rerank → top-k
async function retrieve(query: string, topK = 5) {
  const store = await PGVectorStore.initialize(embeddings, pgConfig);
  const candidates = await store.similaritySearch(query, topK * 3); // over-retrieve

  // Rerank with Cohere
  const { results } = await cohere.rerank({
    model: 'rerank-english-v3.0',
    query,
    documents: candidates.map(c => c.pageContent),
    topN: topK,
  });

  return results.map(r => candidates[r.index]);
}
```

---

### embedding-search

Embedding-based search — semantic search, hybrid search (BM25 + vector), similarity thresholds, index optimization.

#### Workflow

**Step 1 — Detect search implementation**
Use Grep to find search code: `similarity_search`, `vector_search`, `fts`, `tsvector`, `BM25`. Read search handlers to understand: query flow, ranking strategy, and result formatting.

**Step 2 — Audit search quality**
Check for: pure vector search without keyword fallback (misses exact matches), no similarity threshold (returns irrelevant results at low scores), missing query embedding cache (repeated queries re-embed), no hybrid scoring (BM25 for exact + vector for semantic), and unoptimized vector index (HNSW parameters not tuned).

**Step 3 — Emit hybrid search**
Emit: combined BM25 + vector search with reciprocal rank fusion, similarity threshold filtering, query embedding cache, and HNSW index tuning.

#### Example

```typescript
// Hybrid search — BM25 + vector with reciprocal rank fusion
async function hybridSearch(query: string, limit = 10) {
  // Parallel: keyword (BM25) + semantic (vector)
  const [keywordResults, vectorResults] = await Promise.all([
    db.execute(sql`
      SELECT id, content, ts_rank(search_vector, plainto_tsquery(${query})) AS bm25_score
      FROM documents
      WHERE search_vector @@ plainto_tsquery(${query})
      ORDER BY bm25_score DESC LIMIT ${limit * 2}
    `),
    db.execute(sql`
      SELECT id, content, 1 - (embedding <=> ${await getEmbedding(query)}) AS vector_score
      FROM documents
      ORDER BY embedding <=> ${await getEmbedding(query)}
      LIMIT ${limit * 2}
    `),
  ]);

  // Reciprocal rank fusion (k=60)
  const scores = new Map<string, number>();
  const K = 60;
  keywordResults.forEach((r, i) => scores.set(r.id, (scores.get(r.id) || 0) + 1 / (K + i + 1)));
  vectorResults.forEach((r, i) => scores.set(r.id, (scores.get(r.id) || 0) + 1 / (K + i + 1)));

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .filter(([_, score]) => score > 0.01); // threshold
}

// Embedding cache (avoid re-embedding repeated queries)
const embeddingCache = new Map<string, number[]>();
async function getEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  const { data } = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  embeddingCache.set(text, data[0].embedding);
  return data[0].embedding;
}
```

---

### fine-tuning-guide

Fine-tuning workflows — dataset preparation, training configuration, evaluation metrics, deployment, A/B testing.

#### Workflow

**Step 1 — Audit training data**
Use Read to examine the dataset files. Check for: data format (JSONL with `messages` array), train/eval split (eval must not overlap with train), sufficient examples (minimum 50, recommended 200+), balanced class distribution, and PII in training data.

**Step 2 — Prepare and validate dataset**
Emit: JSONL formatter that validates each example, train/eval splitter with stratification, token count estimator (cost preview), and data quality checks (duplicate detection, format validation).

**Step 3 — Execute fine-tuning and evaluate**
Emit: fine-tune API call with hyperparameters, evaluation script that compares base vs fine-tuned on held-out set, and A/B deployment configuration.

#### Example

```python
# Fine-tuning workflow — prepare, train, evaluate
import json
import openai
from sklearn.model_selection import train_test_split

# Step 1: Prepare JSONL dataset
def prepare_dataset(examples: list[dict], output_prefix: str):
    train, eval_set = train_test_split(examples, test_size=0.2, random_state=42)

    for split_name, split_data in [("train", train), ("eval", eval_set)]:
        path = f"{output_prefix}_{split_name}.jsonl"
        with open(path, "w") as f:
            for ex in split_data:
                f.write(json.dumps({"messages": [
                    {"role": "system", "content": ex["system"]},
                    {"role": "user", "content": ex["input"]},
                    {"role": "assistant", "content": ex["output"]},
                ]}) + "\n")
        print(f"Wrote {len(split_data)} examples to {path}")

# Step 2: Launch fine-tuning
def start_fine_tune(train_file: str, eval_file: str):
    train_id = openai.files.create(file=open(train_file, "rb"), purpose="fine-tune").id
    eval_id = openai.files.create(file=open(eval_file, "rb"), purpose="fine-tune").id

    job = openai.fine_tuning.jobs.create(
        training_file=train_id,
        validation_file=eval_id,
        model="gpt-4o-mini-2024-07-18",
        hyperparameters={"n_epochs": 3, "batch_size": "auto", "learning_rate_multiplier": "auto"},
    )
    print(f"Fine-tuning job: {job.id} — status: {job.status}")
    return job

# Step 3: Evaluate base vs fine-tuned
def evaluate(base_model: str, ft_model: str, eval_set: list[dict]) -> dict:
    results = {"base": {"correct": 0}, "finetuned": {"correct": 0}}
    for ex in eval_set:
        for label, model in [("base", base_model), ("finetuned", ft_model)]:
            response = openai.chat.completions.create(
                model=model, messages=ex["messages"][:2], max_tokens=500,
            )
            if response.choices[0].message.content.strip() == ex["messages"][2]["content"].strip():
                results[label]["correct"] += 1
    for label in results:
        results[label]["accuracy"] = results[label]["correct"] / len(eval_set)
    return results
```

---

### llm-architect

LLM system architecture — model selection, prompt engineering patterns, evaluation frameworks, cost optimization, multi-model routing, and guardrail design.

#### Workflow

**Step 1 — Assess LLM requirements**
Understand the use case: what does the LLM need to do? Classify into:
- **Generation**: open-ended text (blog, email, creative writing)
- **Extraction**: structured data from unstructured input (JSON from text, entities, classification)
- **Reasoning**: multi-step logic (math, code generation, planning)
- **Conversation**: multi-turn dialogue with memory
- **Agentic**: tool use, function calling, autonomous task execution

For each class, identify: latency requirements (real-time < 2s, async < 30s, batch), accuracy requirements (critical = needs eval suite, casual = spot check), cost sensitivity (per-call budget), and data sensitivity (PII, HIPAA, can data leave the network?).

**Step 2 — Model selection matrix**
Based on requirements, recommend model tier:

| Requirement | Recommended | Fallback |
|------------|-------------|----------|
| Fast + cheap (classification, routing) | Haiku / GPT-4o-mini | Local (Llama 3) |
| Balanced (code, summaries, RAG) | Sonnet / GPT-4o | Haiku with retry |
| Deep reasoning (architecture, math) | Opus / o1 | Sonnet with chain-of-thought |
| On-premise required | Llama 3 / Mistral | Ollama local deployment |
| Multimodal (vision + text) | Sonnet / GPT-4o | Local LLaVA |

Emit: primary model, fallback model, estimated cost per 1K calls, and latency p50/p99.

**Step 3 — Prompt architecture**
Design the prompt structure:
- **System prompt**: Role definition, constraints, output format. Keep under 500 tokens for cost efficiency.
- **Few-shot examples**: 2-3 examples for extraction/classification tasks. Format matches expected output exactly.
- **Chain-of-thought**: For reasoning tasks, explicitly request step-by-step thinking before final answer.
- **Structured output**: JSON mode or tool use for extraction. Define schema with Zod/Pydantic for validation.

**Step 4 — Guardrails and evaluation**
Design safety and quality layers:
- **Input guardrails**: PII detection, prompt injection detection, topic filtering
- **Output guardrails**: Schema validation, hallucination checks, toxicity filtering
- **Evaluation framework**: Define eval dataset (50+ examples), metrics (accuracy, latency, cost), and regression threshold (new prompt must not drop > 2% on any metric)

Save architecture doc to `.rune/ai/llm-architecture.md`.

#### Example

```typescript
// Multi-model router with fallback
interface ModelConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'local';
  costPer1kTokens: number;
  maxTokens: number;
  latencyP50Ms: number;
}

const MODELS: Record<string, ModelConfig> = {
  fast: {
    id: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    costPer1kTokens: 0.001,
    maxTokens: 4096,
    latencyP50Ms: 200,
  },
  balanced: {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    costPer1kTokens: 0.01,
    maxTokens: 8192,
    latencyP50Ms: 800,
  },
  deep: {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    costPer1kTokens: 0.05,
    maxTokens: 16384,
    latencyP50Ms: 2000,
  },
};

type TaskComplexity = 'trivial' | 'standard' | 'complex';

function selectModel(complexity: TaskComplexity): ModelConfig {
  const map: Record<TaskComplexity, string> = {
    trivial: 'fast',
    standard: 'balanced',
    complex: 'deep',
  };
  return MODELS[map[complexity]];
}

// Prompt architecture template
const systemPrompt = `You are a ${role} assistant.

CONSTRAINTS:
- ${constraints.join('\n- ')}

OUTPUT FORMAT:
Return valid JSON matching this schema:
${JSON.stringify(outputSchema, null, 2)}

Do not include explanations outside the JSON.`;

// Guardrail: validate structured output
import { z } from 'zod';

const OutputSchema = z.object({
  classification: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
});

function validateOutput(raw: string): z.infer<typeof OutputSchema> {
  const parsed = JSON.parse(raw);
  return OutputSchema.parse(parsed); // throws if invalid
}
```

---

### prompt-patterns

Reusable prompt engineering patterns — structured output, chain-of-thought, self-critique, tool use orchestration, and multi-turn memory management.

#### Workflow

**Step 1 — Identify the pattern**
Match the user's task to a proven prompt pattern:
- **Extraction**: Use JSON mode + schema definition + few-shot examples
- **Classification**: Use enum output + confidence score + chain-of-thought
- **Summarization**: Use structured summary template + length constraint + key point extraction
- **Code generation**: Use system prompt with language constraints + test-driven output format
- **Agent loop**: Use ReAct pattern (Thought → Action → Observation → repeat)
- **Self-critique**: Use generate → critique → revise loop for quality-sensitive output

**Step 2 — Apply the pattern**
Generate the prompt following the selected pattern. Include:
- System prompt (role + constraints + output format)
- User message template (input variables marked with `{{variable}}`)
- Few-shot examples (2-3, matching exact output format)
- Validation schema (Zod/Pydantic for structured output)

**Step 3 — Test harness**
Emit a test file with 5+ test cases that validate the prompt produces correct output for known inputs. Include edge cases: empty input, very long input, ambiguous input, adversarial input.

#### Example

```typescript
// Pattern: ReAct Agent Loop
const REACT_SYSTEM = `You are an agent that solves tasks using available tools.

For each step, output EXACTLY this JSON format:
{"thought": "reasoning about what to do next",
 "action": "tool_name",
 "action_input": "input for the tool"}

After receiving an observation, continue with the next thought.
When you have the final answer, output:
{"thought": "I have the answer", "final_answer": "the answer"}

Available tools:
{{tools}}`;

// Pattern: Self-Critique Loop
async function generateWithCritique(prompt: string, maxRounds = 2) {
  let output = await llm.generate(prompt);

  for (let i = 0; i < maxRounds; i++) {
    const critique = await llm.generate(
      `Review this output for errors, omissions, and improvements:\n\n${output}\n\n` +
      `List specific issues. If no issues, respond with "APPROVED".`
    );

    if (critique.includes('APPROVED')) break;

    output = await llm.generate(
      `Original output:\n${output}\n\nCritique:\n${critique}\n\n` +
      `Revise the output to address all issues in the critique.`
    );
  }

  return output;
}
```

---

### ai-agents

Stateful AI agent architecture — persistent state, callable RPC methods, scheduling, multi-agent coordination, MCP server integration, and real-time client communication via WebSocket. Covers agent lifecycle, state management patterns, tool registration, human-in-the-loop approval flows, and durable workflow orchestration for long-running agent tasks.

#### Workflow

**Step 1 — Classify agent type**
Identify what the agent needs to do and map to an architecture:

| Agent Type | Key Characteristics | Platform Options |
|---|---|---|
| Stateless tool-caller | Single request → tool calls → response. No memory between requests. | Any LLM API + function calling |
| Conversational with memory | Multi-turn dialogue. Needs chat history persistence. | Session store (Redis, KV) + LLM |
| Stateful autonomous | Persistent state, scheduled tasks, reacts to events. Long-lived. | Cloudflare Agents SDK, LangGraph, CrewAI |
| Multi-agent coordinator | Multiple specialized agents collaborating on a task. | LangGraph, AutoGen, custom orchestrator |
| MCP server | Exposes tools/resources to any MCP-compatible client. | Cloudflare McpAgent, custom MCP server |

**Step 2 — Design state management**
For stateful agents, define the state contract:

```typescript
// State must be serializable (JSON-safe) — no functions, no circular refs
interface AgentState {
  // Domain state
  conversations: ConversationEntry[];
  preferences: Record<string, string>;
  taskQueue: ScheduledTask[];

  // Metadata
  createdAt: string;
  lastActiveAt: string;
  version: number;
}

// State validation — reject invalid transitions
function validateStateChange(current: AgentState, next: AgentState): void {
  if (next.version < current.version) {
    throw new Error('State version cannot decrease — concurrent modification detected');
  }
  if (next.conversations.length > 10_000) {
    throw new Error('Conversation limit exceeded — archive old entries first');
  }
}
```

**Step 3 — Implement tool registration**
Define agent capabilities as typed, callable methods:

```typescript
// Tools as typed RPC methods (Cloudflare Agents SDK pattern)
import { Agent, callable } from 'agents';

export class ResearchAgent extends Agent<Env, ResearchState> {
  initialState: ResearchState = { findings: [], status: 'idle' };

  @callable()
  async search(query: string): Promise<SearchResult[]> {
    this.setState({ ...this.state, status: 'searching' });
    const results = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      prompt: `Search for: ${query}`,
    });
    const findings = parseResults(results);
    this.setState({
      ...this.state,
      findings: [...this.state.findings, ...findings],
      status: 'idle',
    });
    return findings;
  }

  @callable()
  async summarize(): Promise<string> {
    if (this.state.findings.length === 0) {
      throw new Error('No findings to summarize — run search first');
    }
    return generateSummary(this.state.findings);
  }
}
```

**Step 4 — Add scheduling and durability**
For agents that need to perform work on a schedule or survive restarts:

```typescript
// Scheduled tasks — one-time, recurring, and cron
@callable()
async scheduleDigest(userId: string) {
  // Daily digest at 9 AM
  await this.schedule('0 9 * * *', 'sendDigest', { userId });

  // One-time reminder in 1 hour
  await this.schedule(3600, 'sendReminder', { userId, message: 'Check results' });

  // Recurring every 30 minutes
  await this.scheduleEvery(1800, 'pollDataSource');
}

// Handler runs when scheduled time arrives — even if agent was hibernated
async onScheduledTask(task: ScheduledTask) {
  switch (task.type) {
    case 'sendDigest':
      await this.compileAndSendDigest(task.payload.userId);
      break;
    case 'pollDataSource':
      const newData = await fetchLatest();
      if (newData.length > 0) {
        this.setState({ ...this.state, lastPoll: Date.now(), data: newData });
      }
      break;
  }
}
```

**Step 5 — Human-in-the-loop patterns**
For agents that need approval before taking high-impact actions:

```typescript
// Approval flow — agent pauses, human approves, agent resumes
interface PendingApproval {
  id: string;
  action: string;
  params: Record<string, unknown>;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

@callable()
async requestApproval(action: string, params: Record<string, unknown>): Promise<string> {
  const approval: PendingApproval = {
    id: crypto.randomUUID(),
    action,
    params,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  this.setState({
    ...this.state,
    pendingApprovals: [...this.state.pendingApprovals, approval],
  });
  // Client receives state update via WebSocket → shows approval UI
  return approval.id;
}

@callable()
async resolveApproval(id: string, decision: 'approved' | 'rejected') {
  const updated = this.state.pendingApprovals.map(a =>
    a.id === id ? { ...a, status: decision } : a
  );
  this.setState({ ...this.state, pendingApprovals: updated });
  if (decision === 'approved') {
    const approval = updated.find(a => a.id === id)!;
    await this.executeAction(approval.action, approval.params);
  }
}
```

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| State grows unbounded (conversation history, logs) | Implement max size limits with archival; prune old entries on state update |
| Concurrent state mutations from multiple clients | Use version counter in state; reject updates with stale version |
| Agent crashes mid-workflow, loses progress | Use durable workflows (Cloudflare Workflows, Temporal) for multi-step tasks — each step is persisted |
| Scheduled tasks pile up during agent hibernation | Deduplicate on wake-up; use idempotency keys for task handlers |

---

### code-sandbox

Secure code execution for AI agents — sandboxed environments for running LLM-generated code safely. Covers container isolation, resource limits, timeout enforcement, file system boundaries, and output capture for code interpreter, CI/CD, and interactive development use cases.

#### Workflow

**Step 1 — Assess execution requirements**
Determine what kind of code the agent needs to run:

| Use Case | Isolation Level | Runtime |
|---|---|---|
| Code interpreter (data analysis, math) | High — untrusted code | Python + pandas/numpy |
| Build/test pipeline | Medium — project code | Node.js / Python with project deps |
| Interactive preview (web app) | Medium — expose HTTP port | Node.js + browser preview |
| Shell commands (file ops, git) | Low — trusted context | System shell with path restrictions |

**Step 2 — Configure sandbox environment**
Emit sandbox configuration based on use case:

```typescript
// Sandbox factory — select isolation level by use case
interface SandboxConfig {
  language: 'python' | 'javascript' | 'typescript';
  timeout: number;       // max execution time in ms
  memoryLimit: number;   // max memory in MB
  networkAccess: boolean;
  fileSystemRoot: string;  // restricted working directory
  allowedModules: string[];
}

const SANDBOX_PRESETS: Record<string, SandboxConfig> = {
  'code-interpreter': {
    language: 'python',
    timeout: 30_000,
    memoryLimit: 256,
    networkAccess: false,
    fileSystemRoot: '/workspace',
    allowedModules: ['pandas', 'numpy', 'matplotlib', 'scipy', 'json', 'csv', 'math'],
  },
  'build-test': {
    language: 'typescript',
    timeout: 120_000,
    memoryLimit: 512,
    networkAccess: true,  // needs npm registry
    fileSystemRoot: '/project',
    allowedModules: ['*'],  // project dependencies
  },
  'preview': {
    language: 'javascript',
    timeout: 300_000,
    memoryLimit: 256,
    networkAccess: true,
    fileSystemRoot: '/app',
    allowedModules: ['*'],
  },
};
```

**Step 3 — Implement execution with resource limits**
Emit code execution wrapper with safety boundaries:

```typescript
// Docker-based sandbox execution
import { spawn } from 'child_process';

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

async function executeInSandbox(
  code: string,
  config: SandboxConfig
): Promise<ExecutionResult> {
  const start = Date.now();

  // Write code to temp file in sandbox root
  const codePath = `${config.fileSystemRoot}/run.${config.language === 'python' ? 'py' : 'ts'}`;
  await writeFile(codePath, code);

  const proc = spawn('docker', [
    'run', '--rm',
    '--memory', `${config.memoryLimit}m`,
    '--cpus', '1',
    '--network', config.networkAccess ? 'bridge' : 'none',
    '--read-only',
    '--tmpfs', '/tmp:size=64m',
    '-v', `${config.fileSystemRoot}:/workspace:ro`,
    '-w', '/workspace',
    `sandbox-${config.language}:latest`,
    config.language === 'python' ? 'python' : 'npx tsx',
    `/workspace/run.${config.language === 'python' ? 'py' : 'ts'}`,
  ]);

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGKILL');
  }, config.timeout);

  const exitCode = await new Promise<number>((resolve) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve(code ?? 1);
    });
  });

  return { stdout, stderr, exitCode, durationMs: Date.now() - start, timedOut };
}
```

**Step 4 — Code interpreter mode (stateful sessions)**
For multi-turn code execution where variables persist between runs:

```typescript
// Stateful code interpreter — variables persist across executions
interface CodeSession {
  id: string;
  language: 'python' | 'javascript';
  history: { code: string; result: ExecutionResult }[];
}

async function runInSession(
  session: CodeSession,
  code: string
): Promise<ExecutionResult> {
  // Python: use exec() with persistent globals dict
  // JavaScript: use Node.js vm module with persistent context
  const wrappedCode = session.language === 'python'
    ? `exec(${JSON.stringify(code)}, _globals)`
    : code;

  const result = await executeInSandbox(wrappedCode, SANDBOX_PRESETS['code-interpreter']);

  // Append to history (immutable update)
  session.history = [...session.history, { code, result }];

  return result;
}

// Rich output capture — not just stdout
interface RichOutput {
  text?: string;
  images?: { data: string; mimeType: string }[];  // base64 encoded
  tables?: { headers: string[]; rows: string[][] }[];
  error?: string;
}
```

**Step 5 — Security boundaries**
Enforce isolation guarantees:

| Boundary | Enforcement |
|---|---|
| File system | Read-only mount + tmpfs for temp files. No access to host filesystem. |
| Network | `--network none` for code interpreter. Whitelist for build/test. |
| Memory | Docker `--memory` limit. OOM killed if exceeded. |
| CPU | Docker `--cpus` limit. Prevents crypto mining / infinite loops. |
| Time | Kill process after timeout. Return partial output. |
| Secrets | Never mount env vars or secrets into sandbox container. |
| Output size | Cap stdout/stderr at 1MB. Truncate with `[output truncated]` marker. |

#### Sharp Edges

| Failure Mode | Mitigation |
|---|---|
| Sandbox escape via Docker vulnerability | Pin Docker version; use rootless Docker; consider gVisor/Firecracker for high-security |
| Code writes to /tmp exhausting disk | Use `--tmpfs` with size limit (64MB default) |
| Infinite loop inside sandbox hangs API | Hard timeout with SIGKILL — never rely on SIGTERM alone |
| Stateful session grows unbounded memory | Limit session history to last 50 executions; reset context on overflow |

---

## Connections

```
Calls → research (L3): lookup model documentation and best practices
Calls → docs-seeker (L3): API reference for LLM providers
Calls → verification (L3): validate pipeline correctness
Calls → @rune/devops (L4): ai-agents → edge-serverless for agent deployment (Workers, Lambda)
Calls → @rune/backend (L4): ai-agents → API patterns for agent endpoints and WebSocket handlers
Calls → sentinel (L2): code-sandbox security audit on container isolation
Called By ← cook (L1): when AI/ML task detected
Called By ← plan (L2): when AI architecture decisions needed
Called By ← review (L2): when AI code under review
Called By ← mcp-builder (L2): ai-agents feeds MCP server patterns for agent-based MCP
ai-agents → code-sandbox: agents use sandboxes for executing LLM-generated code safely
code-sandbox → ai-agents: sandbox results feed back into agent state and conversation
```

## Tech Stack Support

| Provider | SDK | Vector Store | Notes |
|----------|-----|-------------|-------|
| OpenAI | openai v4+ | pgvector | Most common, JSON mode + function calling |
| Anthropic | @anthropic-ai/sdk | Pinecone | Tool use + long context |
| Cohere | cohere-ai | Weaviate | Reranking + embed v3 |
| Local (Ollama) | ollama-js | ChromaDB | Self-hosted, privacy-sensitive |
| Cloudflare Workers AI | @cloudflare/ai | Vectorize | Edge inference, Agents SDK |

## Constraints

1. MUST implement retry with exponential backoff on all LLM API calls — rate limits are guaranteed at scale.
2. MUST validate LLM output against a schema (Zod/Pydantic) — never trust raw text parsing for structured data.
3. MUST separate training and evaluation datasets — eval set leaking into training invalidates all metrics.
4. MUST set similarity thresholds on vector search — returning all results regardless of score degrades quality.
5. MUST NOT embed sensitive/PII data without explicit consent — embeddings are not easily deletable from vector stores.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| LLM rate limit (429) crashes entire request pipeline | HIGH | Exponential backoff retry with jitter; fallback model chain for critical paths |
| RAG retrieves irrelevant chunks due to fixed-size splitting across section boundaries | HIGH | Use recursive splitter with semantic separators (headings, paragraphs); include metadata for filtering |
| Vector search returns high-similarity results that are factually wrong (semantic ≠ factual) | HIGH | Always rerank with cross-encoder; include source citation for verification |
| Fine-tuned model overfits to training format, fails on slightly different inputs | HIGH | Include diverse input formats in training data; evaluate on out-of-distribution examples |
| Embedding dimension mismatch between index and query model (model upgraded) | CRITICAL | Pin embedding model version; store model version in index metadata; re-embed on model change |
| Token budget overflow when stuffing retrieved chunks into prompt | MEDIUM | Count tokens before assembly; truncate or drop lowest-ranked chunks to fit budget |

## Done When

- LLM client has retry, structured output, streaming, and fallback chain
- RAG pipeline ingests, chunks, embeds, stores, retrieves, and reranks correctly
- Hybrid search returns relevant results for both keyword and semantic queries
- Fine-tuning dataset validated, model trained, and eval shows improvement over base
- All API calls handle rate limits and timeouts gracefully
- AI agent has typed state, callable RPC methods, scheduling, and human-in-the-loop approval flow
- Code sandbox has resource limits (memory, CPU, time, disk), network isolation, and output capture
- Structured report emitted for each skill invoked

## Cost Profile

~18,000–30,000 tokens per full pack run (all 8 skills). Individual skill: ~2,500–5,000 tokens. Sonnet default. Use haiku for code detection scans; escalate to sonnet for pipeline design and evaluation strategy.
