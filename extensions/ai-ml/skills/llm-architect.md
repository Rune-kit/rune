---
name: "llm-architect"
pack: "@rune/ai-ml"
description: "LLM system architecture — model selection, prompt engineering patterns, evaluation frameworks, cost optimization, multi-model routing, and guardrail design."
model: opus
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# llm-architect

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
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    costPer1kTokens: 0.001,
    maxTokens: 4096,
    latencyP50Ms: 200,
  },
  balanced: {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    costPer1kTokens: 0.01,
    maxTokens: 8192,
    latencyP50Ms: 800,
  },
  deep: {
    id: 'claude-opus-4-8',
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
