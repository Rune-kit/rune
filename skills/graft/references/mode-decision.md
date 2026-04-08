# Mode Decision Tree

Auto-select the optimal graft mode when user doesn't specify explicitly.

## Decision Flow

```
1. User wants analysis only? (says "compare", "vs", "analyze")
   → YES: compare mode
   → NO: continue

2. Source and local tech stacks match?
   → NO (different framework/language): port mode (forced)
   → YES: continue

3. Source code has quality issues? (anti-patterns, no types, no tests)
   → YES: improve mode (fix issues during graft)
   → NO: continue

4. User wants exact replica? (says "exact", "as-is", "copy")
   → YES: copy mode
   → NO: improve mode (default for same-stack, good-quality)
```

## Mode Output Contracts

| Mode | Creates Files? | Modifies Files? | Produces Report? | Calls fix? | Calls review? |
|------|---------------|----------------|-----------------|-----------|--------------|
| compare | ❌ | ❌ | ✅ comparison report | ❌ | ❌ |
| copy | ✅ | ⚠️ minimal (imports) | ❌ | ❌ | ❌ |
| port | ✅ | ✅ | ❌ | ✅ | ❌ |
| improve | ✅ | ✅ | ❌ | ✅ | ✅ |

## Examples

| Scenario | Auto Mode | Why |
|----------|-----------|-----|
| Next.js auth → your Next.js app | improve | Same stack, default to improving |
| Django REST → FastAPI | port | Different framework, rewrite needed |
| "How does Stripe handle webhooks in repo X?" | compare | Analysis intent, no code changes |
| "Copy their date picker component exactly" | copy | User explicitly wants exact replica |
| Vue component → React project | port | Different framework |
| Express middleware, has `any` everywhere | improve | Same stack (Node) but quality issues |
| "Use their testing approach" | compare | Learning intent, not adoption |
