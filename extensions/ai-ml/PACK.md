---
name: "@rune/ai-ml"
description: AI/ML integration patterns — LLM integration, RAG pipelines, embeddings, fine-tuning workflows, stateful AI agents, code execution sandboxes, web extraction, and deep research loops.
metadata:
  author: runedev
  version: "0.4.0"
  layer: L4
  price: "$15"
  target: AI engineers
  format: split
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
- `/rune web-extraction` — build structured data extraction from web pages
- `/rune deep-research` — implement iterative AI research loops with convergence
- Called by `cook` (L1) when AI/ML task detected
- Called by `plan` (L2) when AI architecture decisions needed

## Skills Included

| Skill | Model | Description |
|-------|-------|-------------|
| [llm-integration](skills/llm-integration.md) | sonnet | API client wrappers, streaming, structured output, retry + fallback chain, prompt versioning |
| [rag-patterns](skills/rag-patterns.md) | sonnet | Document chunking, embedding generation, vector store setup, retrieval, reranking |
| [embedding-search](skills/embedding-search.md) | sonnet | Semantic search, hybrid BM25 + vector, similarity thresholds, index optimization |
| [fine-tuning-guide](skills/fine-tuning-guide.md) | sonnet | Dataset preparation, training config, evaluation metrics, deployment, A/B testing |
| [llm-architect](skills/llm-architect.md) | opus | Model selection, prompt engineering, evaluation frameworks, cost optimization, guardrails |
| [prompt-patterns](skills/prompt-patterns.md) | sonnet | Structured output, chain-of-thought, self-critique, ReAct, multi-turn memory management |
| [ai-agents](skills/ai-agents.md) | sonnet | Stateful agents, RPC methods, scheduling, multi-agent coordination, MCP integration, HITL |
| [code-sandbox](skills/code-sandbox.md) | sonnet | Container isolation, resource limits, timeout enforcement, stateful sessions, output capture |
| [web-extraction](skills/web-extraction.md) | sonnet | Schema-driven extraction, anti-bot handling, prompt injection defense, multi-entity dedup |
| [deep-research](skills/deep-research.md) | sonnet | Iterative research loop with convergence, source attribution, confidence scoring |

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
web-extraction → rag-patterns: extracted structured data feeds into RAG ingestion pipeline
deep-research → web-extraction: research loop uses extraction for each discovered URL
deep-research → embedding-search: relevance scoring uses embeddings for semantic similarity
```

## Sharp Edges

- **Rate limits**: MUST implement exponential backoff retry on all LLM API calls — guaranteed at scale.
- **Schema validation**: MUST validate LLM output with Zod/Pydantic — never trust raw text parsing.
- **Eval leakage**: MUST separate training and evaluation datasets — leakage invalidates all metrics.
- **Similarity thresholds**: MUST set thresholds on vector search — unrestricted results degrade quality.
- **PII in embeddings**: MUST NOT embed sensitive data without consent — not easily deletable from vector stores.
- **Embedding model pinning**: Pin model version in index metadata — dimension mismatch on upgrade is CRITICAL.
- **Prompt injection**: Web pages may contain adversarial content targeting extraction LLMs — system prompt must block.
- **Sandbox escape**: Use rootless Docker or gVisor for high-security code execution environments.

## Done When

- LLM API client implemented with retry logic, exponential backoff, and structured output validation via Zod/Pydantic
- RAG pipeline operational: chunking, embedding, vector store, retrieval, and reranking all configured and tested
- Embedding index metadata includes pinned model version and dimension count to prevent upgrade mismatches
- AI agent state persists across requests with no cross-session leakage and graceful crash recovery

## Cost Profile

~24,000–40,000 tokens per full pack run (all 10 skills). Individual skill: ~2,500–5,000 tokens. Sonnet default. Use haiku for code detection scans; escalate to sonnet for pipeline design, extraction strategy, and research loop orchestration.
