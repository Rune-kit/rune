# test — Oracle-injection E2E testing

> Reference for `skills/test/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Advanced: Oracle-Injection E2E Testing

For **data pipelines, AI workflows, and multi-stage processing** where comparing full output structures is impractical, use oracle injection:

1. **Generate a UUID oracle token**: `const oracle = crypto.randomUUID()`
2. **Inject into synthetic input**: embed the oracle in realistic test data that flows through the pipeline
3. **Run the full pipeline**: input → all stages → output
4. **Search for oracle in output**: if found → data flowed end-to-end correctly

```
// Example: testing a document processing pipeline
const oracle = "ORACLE-" + crypto.randomUUID();
const testDoc = `Meeting notes: discussed ${oracle} integration timeline`;
const result = await pipeline.process(testDoc);
assert(result.output.includes(oracle), "Oracle not found — pipeline lost data");
```

**When to use**: E2E tests for pipelines with 3+ stages, LLM-based processing, ETL workflows, or any system where output structure is complex/non-deterministic but data preservation is critical.

**When NOT to use**: Unit tests, simple CRUD, or when exact output comparison is feasible.
