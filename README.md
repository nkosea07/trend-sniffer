# Trend Sniffer

Trend Sniffer is a live technology intelligence dashboard that helps you stay up to date with:
- latest industry signals and news,
- common and recent Google searches,
- key video updates,
- recurring developer challenges + startup ideas you can monetize,
- Telegram alert delivery.

## What this app includes

1. `Top Signals` tab
- Aggregates tech headlines from Google News RSS, TechCrunch, and The Verge.
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
TELEGRAM_CRON=0 8 * * *
```

Notes:
- Add your bot as admin in your channel.
- `TELEGRAM_CRON` is optional. If omitted, only manual sends are available.
- If cron is set, Trend Sniffer sends only when new watchlist-matching items are detected.

## Persistence

Watchlist settings, templates, and seen-item state are stored locally at:
- `data/trend-sniffer-store.json`

This file is gitignored and survives restarts in your local environment.

## API endpoints

- `GET /api/dashboard` live aggregated dashboard payload + pending new counts
- `GET /api/preferences` watchlist/template settings
- `PUT /api/preferences` persist watchlist/template settings
- `POST /api/notify/telegram/preview` preview templated digest message
- `POST /api/notify/telegram/digest` send digest (`mode: "new"` default, `"full"` optional)
- `POST /api/alerts/acknowledge` mark current feed as seen
- `POST /api/notify/telegram/message` send custom message (`{ "message": "..." }`)
- `GET /api/meta` app metadata and Telegram readiness

## Is it possible to use common/recent Google searches?

Yes. This app uses Google Trends RSS (`https://trends.google.com/trending/rss?geo=US`) and surfaces those results in the `Google Searches` tab with source links.
