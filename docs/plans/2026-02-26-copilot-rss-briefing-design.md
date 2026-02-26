# Trend Sniffer Copilot + RSS Configuration Design

Date: 2026-02-26

## Goals
- Add a dedicated local Copilot assistant tab.
- Support preset and manual RSS sources beyond tech.
- Keep file-backed persistence only (no DB, no extra services).
- Require confirmation before any state-changing action.
- Add daily briefing settings with custom time/timezone.
- Support in-app briefing generation while Telegram can be paused.

## Architecture
- Keep single Node/Express server and static frontend.
- Extend local store file (`data/trend-sniffer-store.json`) with:
  - `rssSources` (preset + custom feeds)
  - `copilot` (pending actions, history, confirmation requirement)
  - `briefing` (delivery toggles, telegram pause, prompt behavior, schedule)
- Build dashboard signals from enabled RSS sources only.
- Keep Google Trends, YouTube, and challenges as existing enrichment layers.

## Copilot Model
- Local intent router (rule-based, no cloud model dependency).
- Copilot can:
  - answer contextual questions from current dashboard data
  - propose actions (add source, toggle source, update schedule, pause telegram, generate briefing)
- Any action is queued as `pending` and requires explicit confirm/reject.

## API Contract
- `GET /api/sources/rss`
- `POST /api/sources/rss`
- `PATCH /api/sources/rss/:id`
- `DELETE /api/sources/rss/:id`
- `POST /api/sources/presets/apply`
- `POST /api/copilot/chat`
- `GET /api/copilot/actions`
- `POST /api/copilot/actions/:id/confirm`
- `POST /api/copilot/actions/:id/reject`
- `GET /api/copilot/briefings`
- `POST /api/copilot/briefings/generate`
- `PATCH /api/copilot/briefings/settings`

## UX
- Add `Copilot` tab with:
  - chat + assistant response
  - pending action queue (confirm/reject buttons)
  - source registry controls (preset apply + manual add/remove + enable/disable)
  - briefing settings (time + timezone + telegram pause + delivery toggles)
  - generate briefing button with prompt if telegram paused
- Default behavior when telegram paused:
  - ask if user wants to continue generation
  - default decision is continue in-app generation without telegram send

## Scheduling
- Replace fixed env-driven schedule with persisted schedule.
- Default: `06:30` and `Africa/Johannesburg`.
- Cron expression generated from persisted `HH:mm`; timezone passed to scheduler.

## Error Handling
- Validate/sanitize user input for source URL, names, schedule time, timezone.
- Keep operations idempotent and safe where possible.
- Return explicit `ok: false` and message on failures.

## Testing Plan
- Backend smoke checks with `node --check server.js`.
- Frontend syntax check with `node --check public/app.js`.
- Manual checks:
  - add/remove/enable sources
  - copilot action proposal + confirm/reject
  - briefing generation with telegram paused/unpaused
  - schedule update to `06:30 Africa/Johannesburg`
