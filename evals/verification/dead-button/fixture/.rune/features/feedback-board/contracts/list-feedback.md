# Contract: GET /api/feedback

**Serves**: US-2 (AC-2.1)

## Request
No body. No params.

## Response 200
```json
[ { "id": "uuid", "text": "great sprint", "createdAt": "..." } ]
```
Ordered newest first.

## Errors
None expected (empty list = `[]`).

## Consumers
- `public/index.html` list loader (`loadFeedback`) — US-2 UI task calls this endpoint on page load and after successful submit
