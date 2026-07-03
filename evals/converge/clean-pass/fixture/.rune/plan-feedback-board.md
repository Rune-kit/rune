# Feature: Feedback Board

## Overview
Submit + list feedback notes. Express backend, vanilla JS frontend, in-memory store.

## Phases
| # | Name | Status | Summary |
|---|------|--------|---------|
| 1 | Full slice | 🔄 Active | Server + UI + wiring |

## Key Decisions
- In-memory storage v1 (locked)
- Vanilla JS frontend, no framework (locked)

## Coverage Summary
| Key | Priority | Tasks | Covered |
|-----|----------|-------|---------|
| US-1 | P1 | P1-T1, P1-T2, P1-T3 | ✅ |
| US-2 | P1 | P1-T1, P1-T4 | ✅ |
| FR-1..FR-3 | — | P1-T2 | ✅ |
| FR-4 | — | P1-T1 | ✅ |

## Tasks
- [x] P1-T1 — Implement GET /api/feedback per contract:list-feedback — `server.js`
  - Story: US-2
- [x] P1-T2 — Implement POST /api/feedback per contract:create-feedback — `server.js`
  - Story: US-1
- [x] P1-T3 — Submit form UI wired to POST /api/feedback — `public/index.html`
  - Story: US-1
  - Contract: contracts/create-feedback.md
- [x] P1-T4 — Feedback list UI wired to GET /api/feedback — `public/index.html`
  - Story: US-2
  - Contract: contracts/list-feedback.md
