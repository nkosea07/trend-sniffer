# Trend Sniffer

Trend Sniffer is a live intelligence dashboard that helps you stay up to date with:
- latest industry signals and news (not limited to technology),
- common and recent Google searches,
- key video updates,
- recurring developer challenges + startup ideas you can monetize,
- Telegram alert delivery,
- a local Copilot assistant with confirmation-first actions.

## What this app includes

1. `Top Signals` tab
- Aggregates live headlines from enabled RSS sources (preset + manual).
- Shows timestamp, source, summary, image, and a direct reference link.

2. `Google Searches` tab
- Pulls live US daily trending searches from Google Trends RSS.
- Includes approximate traffic and related story references.

3. `Video Radar` tab
- Pulls fresh uploads from selected technology YouTube channels using RSS.
- Supports adding extra saved YouTube channels (by channel ID) from Watchlist Studio.

4. `Build Opportunities` tab
- Scans recent high-signal Stack Overflow questions.
- Groups challenge categories and suggests product solutions + monetization ideas.
- Includes reference links for verification.

5. `Alerts` tab
- Sends Telegram alerts using digest templates.
- Default behavior sends only when new items appear.
- Supports full digest override, preview, and “mark current feed seen”.

6. `Watchlist Studio` tab
- Persist saved topics and channels to a local JSON store.
- Create/update/delete/activate custom digest templates.

7. `Copilot` tab
- Local smart assistant (file-backed, no external AI service required).
- Simple RSS mode with `Business + Maker` and `Technology Core` presets.
- Manual source add/remove/enable/disable.
- Confirmation queue for every action (confirm/reject required).
- Daily briefing settings (custom time + timezone).
- Telegram pause toggle with prompt to continue in-app generation.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000

## Telegram configuration

Populate `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=@your_channel_or_chat_id
```

Notes:
- Add your bot as admin in your channel.
- Scheduling is configured in-app (default: `06:30` in `Africa/Johannesburg`).
- Telegram delivery can be paused while still generating in-app briefings.
- Alert sends target only new watchlist-matching items unless full mode is selected.

## Persistence

Watchlist settings, templates, seen-item state, RSS sources, Copilot actions, and briefing customizations are stored locally at:
- `data/trend-sniffer-store.json`

This file is gitignored and survives restarts in your local environment.

## API endpoints

- `GET /api/dashboard` live aggregated dashboard payload + pending new counts
- `GET /api/preferences` watchlist/template settings
- `PUT /api/preferences` persist watchlist/template settings
- `GET /api/sources/rss` list RSS sources
- `POST /api/sources/rss` queue add source action
- `PATCH /api/sources/rss/:id` queue source update action
- `DELETE /api/sources/rss/:id` queue source removal action
- `POST /api/sources/presets/apply` queue preset-pack action
- `POST /api/copilot/chat` local copilot response + optional action queue
- `GET /api/copilot/actions` list pending/recent actions
- `POST /api/copilot/actions/:id/confirm` confirm and execute action
- `POST /api/copilot/actions/:id/reject` reject action
- `GET /api/copilot/briefings` read briefing settings/history
- `PATCH /api/copilot/briefings/settings` queue briefing settings update
- `POST /api/copilot/briefings/generate` generate briefing (in-app + optional Telegram)
- `POST /api/notify/telegram/preview` preview templated digest message
- `POST /api/notify/telegram/digest` send digest (`mode: "new"` default, `"full"` optional)
- `POST /api/alerts/acknowledge` mark current feed as seen
- `POST /api/notify/telegram/message` send custom message (`{ "message": "..." }`)
- `GET /api/meta` app metadata and Telegram readiness

## Is it possible to use common/recent Google searches?

Yes. This app uses Google Trends RSS (`https://trends.google.com/trending/rss?geo=US`) and surfaces those results in the `Google Searches` tab with source links.
