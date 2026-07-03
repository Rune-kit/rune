# Data Model: Feedback Board

## Feedback
| Field | Type | Validation | Notes |
|-------|------|-----------|-------|
| id | string (uuid) | generated | PK |
| text | string | non-empty, ≤500 chars | trimmed |
| createdAt | ISO timestamp | generated | sort key (desc) |

**State transitions**: none (immutable once created).
**Relationships**: none.
