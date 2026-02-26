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

4. `Build Opportunities` tab
- Scans recent high-signal Stack Overflow questions.
- Groups challenge categories and suggests product solutions + monetization ideas.
- Includes reference links for verification.

5. `Alerts` tab
- Send digest messages to Telegram manually.
- Send custom Telegram channel messages.
- Optional cron-based automated digest delivery.

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

## API endpoints

- `GET /api/dashboard` live aggregated dashboard payload
- `GET /api/meta` app metadata and Telegram readiness
- `POST /api/notify/telegram/digest` send digest now
- `POST /api/notify/telegram/message` send custom message (`{ "message": "..." }`)

## Is it possible to use common/recent Google searches?

Yes. This app already does that through Google Trends RSS (`https://trends.google.com/trending/rss?geo=US`) and surfaces those results in the `Google Searches` tab with source links.
