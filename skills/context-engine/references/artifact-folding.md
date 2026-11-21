# context-engine — Artifact folding

> Reference for `skills/context-engine/SKILL.md`. Moved verbatim from SKILL.md in v2.33.0 (progressive disclosure); the SKILL.md section of the same name points here.

## Artifact Folding (Large Output Management)

When tool results are excessively large, they consume disproportionate context without proportionate value. **Artifact folding** saves the full output to a file and replaces it in context with a compact preview.

### When to Fold

| Condition | Action |
|-----------|--------|
| Tool output > 4000 characters | Fold to artifact |
| Tool output > 120 lines | Fold to artifact |
| Multiple tool outputs from the same command class (e.g., 5+ Grep results) | Fold all into single artifact |
| Code block output > 200 lines | Fold to artifact |

### Folding Procedure

1. **Save full output** to `.rune/artifacts/artifact-{timestamp}-{tool}.md`:
   ```markdown
   # Artifact: {tool_name} output
   Generated: {timestamp}
   Command: {tool_call_summary}
   
   {full_output}
   ```

2. **Replace in context** with a compact preview:
   ```
   [FOLDED: {tool_name} output — {line_count} lines, {char_count} chars]
   Preview (first 10 lines):
   {first_10_lines}
   ...
   Full output: .rune/artifacts/artifact-{timestamp}-{tool}.md
   Use Read to access the full artifact if needed.
   ```

3. **On compaction**: Artifact files survive compaction — the continuation summary references them by path. This means large outputs are preserved across compaction boundaries without consuming context.

### Rules

- **Never fold user messages** — only tool outputs
- **Never fold error outputs** — errors need full visibility for debugging
- **Never fold outputs < 1000 chars** — folding overhead exceeds savings
- **Fold preemptively in YELLOW/ORANGE** — don't wait for RED to start managing output size
- **Clean up artifacts** at session end: artifacts older than the current session can be deleted (they're already in git history or irrelevant)

### Why

A single `Grep` across a large codebase can return 3000+ lines. Without folding, this consumes ~4000 tokens of context — often more than the rest of the conversation combined. Folding preserves the information (accessible via Read) while keeping context lean. Combined with the Structured Summary compaction technique, artifact folding enables much longer productive sessions.
