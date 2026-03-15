---
name: "@rune/ai-ml"
description: AI/ML integration patterns — LLM integration, RAG pipelines, embeddings, and fine-tuning workflows.
metadata:
  author: runedev
  version: "0.2.0"
  layer: L4
  price: "$15"
  target: AI engineers
---

# @rune/ai-ml

## Purpose

AI-powered features fail in predictable ways: LLM calls without retry logic that crash on rate limits, RAG pipelines that retrieve irrelevant chunks because the chunking strategy ignores document structure, embedding search that returns semantic matches with zero keyword overlap, and fine-tuning runs that overfit because the eval set leaked into training data. This pack codifies production patterns for each — from API client resilience to retrieval quality to model evaluation — so AI features ship with the reliability of traditional software.

## Triggers

- Auto-trigger: when `openai`, `anthropic`, `@langchain`, `pinecone`, `pgvector`, `embedding`, `llm` detected in dependencies or code
- `/rune llm-integration` — audit or improve LLM API usage
- `/rune rag-patterns` — build or audit RAG pipeline
- `/rune embedding-search` — implement or optimize semantic search
- `/rune fine-tuning-guide` — prepare and execute fine-tuning workflow
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

## Connections

```
Calls → research (L3): lookup model documentation and best practices
Calls → docs-seeker (L3): API reference for LLM providers
Calls → verification (L3): validate pipeline correctness
Called By ← cook (L1): when AI/ML task detected
Called By ← plan (L2): when AI architecture decisions needed
Called By ← review (L2): when AI code under review
```

## Tech Stack Support

| Provider | SDK | Vector Store | Notes |
|----------|-----|-------------|-------|
| OpenAI | openai v4+ | pgvector | Most common, JSON mode + function calling |
| Anthropic | @anthropic-ai/sdk | Pinecone | Tool use + long context |
| Cohere | cohere-ai | Weaviate | Reranking + embed v3 |
| Local (Ollama) | ollama-js | ChromaDB | Self-hosted, privacy-sensitive |

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
- Structured report emitted for each skill invoked

## Cost Profile

~10,000–18,000 tokens per full pack run (all 4 skills). Individual skill: ~2,500–5,000 tokens. Sonnet default. Use haiku for code detection scans; escalate to sonnet for pipeline design and evaluation strategy.
