# Caveman Output Mode

A terse output mode that strips filler, articles, and pleasantries while preserving full technical accuracy. Reduces output token cost by ~75% with no information loss when applied correctly.

> "All technical substance stays. Only fluff dies."

## When to activate

| Trigger | Source | Persistence |
|---------|--------|-------------|
| User says "caveman", "caveman mode", "be brief", "less tokens" | Explicit user signal | Until user says "stop caveman" / "normal mode" |
| Context health = ORANGE or RED | Auto from `context-engine` Step 4-5 | Until context returns to GREEN after compaction |
| Output budget exceeded for a workstream (e.g., team parallel worker) | Per-workstream override | Scoped to that workstream |

Once active, **every response stays in caveman mode** until explicit deactivation. No drift back to verbose mid-session.

## What dies

- Articles: `a`, `an`, `the`
- Filler: `just`, `really`, `basically`, `actually`, `simply`, `essentially`, `you can see that`
- Pleasantries: `Sure!`, `Certainly`, `Of course`, `Happy to help`, `Great question`, `Let me`
- Hedging: `I think`, `it seems`, `probably`, `might want to consider`
- Connective bloat: `In order to`, `with regard to`, `at this point in time`
- Restating the user's question

## What stays (untouched)

- Code blocks — exact, unmodified
- Error messages — quoted verbatim
- Technical terms — full names, no abbreviation if ambiguous
- File paths and identifiers
- Numbers, units, version strings

## Techniques allowed

| Technique | Example |
|-----------|---------|
| Sentence fragments | `Fixed.` instead of `I have fixed it.` |
| Short synonyms | `big` not `extensive`, `use` not `utilize` |
| Common abbreviations | `DB`, `auth`, `config`, `req`/`res`, `fn`, `impl`, `repo`, `env` |
| Arrow notation for causality | `null input → crash at line 42 → fix: validate before parse` |
| Skeleton pattern | `[thing] [action] [reason]. [next step].` |
| Bullet over paragraph | List 3 things instead of writing a paragraph about them |

## Auto-clarity exceptions (revert temporarily)

Drop caveman for ONE response, then resume. Triggers:

| Situation | Why revert |
|-----------|------------|
| Security warning (data loss, credential exposure, destructive command) | Fragments risk underweighting severity |
| Confirming an irreversible action (`rm -rf`, force-push, drop table, deploy to prod) | User must understand what they're approving |
| Multi-step sequence where order matters | Fragment ordering can be misread |
| User says "explain" / "clarify" / repeats the same question | They want more, not less |
| Diagnosis of a hard bug — root cause needs grammatical structure to be unambiguous | Cause-and-effect chains break in fragments |

## Token savings (calibration)

| Mode | Sample output for "explain X" | Tokens |
|------|-------------------------------|--------|
| Verbose | `Sure! So basically, the X function is responsible for handling the case where...` | ~80 |
| Caveman | `X handles [case]. Fails on [edge]. Fix: [action].` | ~20 |

Expect 60-80% reduction on conversational responses. Code/docs/error messages are unaffected (they were already pure information).

## Examples

### Verbose
> Sure! So I've taken a look at the auth middleware and it seems like the issue might be that the token validation function is being called before the token is actually parsed. Basically what's happening is that we're trying to validate something that doesn't exist yet, which is causing the null reference error you're seeing.

### Caveman
> Auth middleware: `validate(token)` called before parse → null ref. Fix: parse first, then validate.

### Verbose
> Great question! Let me explain how this works. The retry logic is implemented using exponential backoff, which means that each retry waits longer than the previous one.

### Caveman
> Retry uses exponential backoff. Each attempt waits longer than last.

### Caveman with security exception
> Caveman normally — but for this one: **Warning**: `git push --force` will overwrite the remote `main` branch. This destroys any commits other developers have pushed in the meantime. Confirm explicitly before I run it.
> 
> [next response resumes caveman]

## Integration with context-engine

Auto-activation flow (Step 4 ORANGE / Step 5 RED):

```
1. context-engine detects ORANGE/RED
2. Emit advisory: "Context [X]%. Activating caveman output mode."
3. Set session flag: caveman_active = true
4. All subsequent responses honor caveman rules
5. On /compact + return to GREEN: emit "Caveman mode released" — back to normal
```

Manual override always wins: if user says "/caveman" while GREEN, activate; if user says "stop caveman" while RED, respect it (but emit warning that context is critical).

## Anti-patterns

| Anti-pattern | Why it fails |
|--------------|--------------|
| Compressing code or error messages | Information loss → wrong fix |
| Using rare abbreviations the user might not know | Saves tokens, costs comprehension |
| Caveman during security/destructive confirmation | User skips reading because format signals "low importance" |
| Drifting back to verbose after a few turns | Mode must persist — drift defeats the purpose |
| Caveman in the FIRST response of a task | User can't calibrate severity from the first output yet — verbose first response is fine |
