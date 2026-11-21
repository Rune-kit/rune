---
name: "llm-integration"
pack: "@rune/ai-ml"
description: "LLM integration patterns — API client wrappers, streaming responses, structured output, retry with exponential backoff, model fallback chains, prompt versioning."
model: sonnet
tools: [Read, Edit, Write, Grep, Glob, Bash]
---

# llm-integration

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
  const models = ['gpt-6-luna', 'gpt-6.1-terra'] as const; // fallback chain (check the provider's current model list)
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
