# Contract: POST /api/feedback

**Serves**: US-1 (AC-1.1, AC-1.2)

## Request
```json
{ "text": "great sprint" }
```
Validation: text non-empty after trim; ≤500 chars.

## Response 201
```json
{ "id": "uuid", "text": "great sprint", "createdAt": "2026-07-03T10:00:00Z" }
```

## Errors
| Case | Status | Body |
|------|--------|------|
| empty text (AC-1.2) | 422 | `{ "error": "note must not be empty" }` |
| text >500 chars | 422 | `{ "error": "note too long" }` |

## Consumers
- `public/index.html` submit handler (`submitFeedback`) — US-1 UI task calls this endpoint
