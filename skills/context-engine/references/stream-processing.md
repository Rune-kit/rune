# context-engine — Incremental stream processing

> Reference for `skills/context-engine/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Incremental Stream Processing

When processing streaming LLM output (e.g., in skills that invoke AI calls or process tool output incrementally), use **sentence-level buffering** instead of waiting for the full response:

### Pattern: Buffer → Detect Boundary → Act

```
1. ACCUMULATE: Feed incoming chunks into a text buffer
2. DETECT: Check for sentence boundaries:
   - Primary: 40+ chars ending in . ! ? ; :
   - Secondary: paragraph break (\n\n) with 15+ chars accumulated
   - Never split mid-word or mid-code-block
3. EXTRACT: Remove the complete sentence from the buffer
4. ACT: Process the extracted sentence immediately (e.g., queue for TTS, parse for structured data, update progress display)
5. CONTINUE: Keep accumulating the next sentence while processing the current one
```

### When to Use

- **Skills that stream AI responses to the user**: process and display incrementally instead of waiting for the full response
- **Background note-taking**: extract key points from streaming output as they arrive
- **Progress reporting**: detect milestone keywords in streaming output to update progress

### When NOT to Use

- **Code generation**: wait for the full code block — partial code is useless
- **JSON output**: accumulate until the closing brace — partial JSON can't be parsed
- **Short responses** (<100 chars expected): overhead of boundary detection exceeds benefit
