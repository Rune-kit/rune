# Requirements Document: Feedback Board
Created: 2026-07-03 | BA Session: synthesized

## Context
Small internal tool: visitors submit short feedback notes and see all submitted notes on one page.

## Stakeholders
- Primary user: team members leaving quick feedback
- Affected systems: none (standalone)

## User Stories

US-1 [P1]: As a team member, I want to submit a feedback note so that the team can see it.
  Independent Test: type "great sprint" into the form, click Submit, and see "great sprint" appear in the feedback list without a page reload.
  AC-1.1: GIVEN a non-empty note WHEN the user clicks Submit THEN the note is persisted and appears in the feedback list (→ FR-1, FR-2)
  AC-1.2: GIVEN an empty note WHEN the user clicks Submit THEN the API responds 422 and the form shows "note must not be empty" (→ FR-3)

US-2 [P1]: As a team member, I want to see all feedback notes so that I know what others said.
  Independent Test: open the page and see previously submitted notes rendered as a list.
  AC-2.1: GIVEN stored notes WHEN the page loads THEN all notes render in the list, newest first (→ FR-4)

## Functional Requirements
FR-1  When a user submits a non-empty note, the system shall persist the note.
FR-2  When a note is persisted, the system shall return the created note with its id.
FR-3  If a submitted note is empty, then the system shall respond with HTTP 422 and an error message.
FR-4  When the page loads, the system shall return all notes ordered newest first.

## Key Entities
- **Feedback**: a short note someone left — text (≤500 chars, non-empty), createdAt. No relationships.

## Scope
### In Scope
- Submit note, list notes, empty-note validation
### Out of Scope
- Auth, editing, deleting, pagination
### Assumptions
- In-memory storage is acceptable for v1

## Non-Functional Requirements
None relevant for v1.

## Dependencies
- Express (already in package.json)

## Risks
- None significant.

## Decision Classification
| Category | Meaning | Item |
|----------|---------|------|
| Decisions (locked) | User confirmed | In-memory storage v1; vanilla JS frontend (no framework) |
| Discretion (agent) | Agent decides | Port number |
| Deferred | Not this task | Persistence to disk |
