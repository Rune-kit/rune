# Quickstart: Feedback Board

## Prerequisites
- `npm install` done
- `npm start` (serves on http://localhost:3199)

## Validate US-1 (P1): submit a note
1. `curl -s -X POST localhost:3199/api/feedback -H 'content-type: application/json' -d '{"text":"great sprint"}'`
   **Expect**: 201, body contains `"text":"great sprint"` and an `"id"`
2. `curl -s localhost:3199/api/feedback` — **Expect**: array contains the new note
3. UI path: open http://localhost:3199 → type "great sprint" → click Submit → **Expect**: note appears in the list without reload

## Validate US-1 error path (AC-1.2)
1. `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3199/api/feedback -H 'content-type: application/json' -d '{"text":""}'`
   **Expect**: 422

## Validate US-2 (P1): list notes
1. Open http://localhost:3199 with ≥1 stored note → **Expect**: notes render newest first
