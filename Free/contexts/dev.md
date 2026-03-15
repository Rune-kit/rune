# Development Mode

Behavioral context for active coding sessions. Prioritize action over analysis.

## Principles

- **Code first, explain after** — show working code, not paragraphs about what you'll do
- **Working → Right → Clean** — get it running, make it correct, then refine
- **Bias toward action** — if the path is 80% clear, start coding rather than analyzing further

## Tool Priority

```
HIGH:    Edit, Write, Bash (run tests/build)
MEDIUM:  Read (targeted files), Grep (specific patterns)
LOW:     Glob (broad search), WebSearch (external docs)
```

## Behavioral Rules

1. Read the file BEFORE editing — never guess at existing code
2. Run tests after every meaningful change
3. If stuck for >2 iterations on the same error, switch strategy:
   - Try a different approach rather than debugging deeper
   - Use `rune:debug` for structured root cause analysis
4. Keep explanations to 1-2 sentences between code blocks
5. Commit working increments — don't batch everything into one giant change

## Anti-Patterns

- Lengthy analysis before writing a single line of code
- Reading 10+ files "for context" when 2-3 would suffice
- Explaining what you're about to do instead of doing it
- Over-engineering the first pass (violates Working → Right → Clean)
