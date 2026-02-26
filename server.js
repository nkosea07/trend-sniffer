const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  trimValues: true
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GOOGLE_NEWS_FEEDS = [
  {
    topic: 'AI & Robotics',
    url: 'https://news.google.com/rss/search?q=artificial+intelligence+robotics+industry&hl=en-US&gl=US&ceid=US:en'
  },
  {
    topic: 'Cloud & Platform',
    url: 'https://news.google.com/rss/search?q=cloud+platform+engineering+enterprise&hl=en-US&gl=US&ceid=US:en'
  },
  {
    topic: 'Cybersecurity',
    url: 'https://news.google.com/rss/search?q=cybersecurity+breach+zero+day+technology&hl=en-US&gl=US&ceid=US:en'
  },
  {
    topic: 'Startups & Funding',
    url: 'https://news.google.com/rss/search?q=technology+startup+funding+product+launch&hl=en-US&gl=US&ceid=US:en'
  }
];

const TECH_RSS_FEEDS = [
  { topic: 'Editorial', url: 'https://techcrunch.com/feed/' },
  { topic: 'Editorial', url: 'https://www.theverge.com/rss/index.xml' }
];

const YOUTUBE_CHANNELS = [
  { label: 'OpenAI', id: 'UCXZCJLdBC09xxGZ6gcdrc6A' },
  { label: 'Google Developers', id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
  { label: 'Fireship', id: 'UCsBjURrPoezykLs9EqgamOA' },
  { label: 'freeCodeCamp', id: 'UC8butISFwT-Wl7EV0hUK0BQ' }
];

const CATEGORY_RULES = [
  {
    key: 'AI Integration Cost',
    test: /(openai|llm|prompt|token|embedding|rag|hallucinat)/i,
    solution: 'Build a guardrail + spend dashboard for AI features with evaluation tests and prompt versioning.',
    monetization: 'Tiered SaaS by monthly token volume and number of protected model endpoints.'
  },
  {
    key: 'Authentication Friction',
    test: /(auth|oauth|jwt|signin|login|session|passport)/i,
    solution: 'Build an auth troubleshooting assistant that validates provider config and callback flow in real time.',
    monetization: 'Usage-based API for automated auth diagnostics plus team seats for shared debugging.'
  },
  {
    key: 'Deployment & DevOps',
    test: /(docker|kubernetes|k8s|deploy|aws|gcp|azure|terraform|ci\/cd|pipeline)/i,
    solution: 'Build a deployment readiness scanner that checks infra manifests and predicts failure points before release.',
    monetization: 'Per-repository subscriptions with premium policy packs for regulated environments.'
  },
  {
    key: 'Frontend Reliability',
    test: /(react|next\.js|vue|hydration|render|typescript|state)/i,
    solution: 'Build a UI regression radar that catches hydration errors, state drifts, and broken interactions pre-merge.',
    monetization: 'Seat-based pricing for frontend teams with CI minutes bundled by plan.'
  },
  {
    key: 'Data & Performance',
    test: /(sql|database|query|latency|performance|memory|cache|redis)/i,
    solution: 'Build a query optimization copilot that auto-detects bottlenecks from logs and proposes indexed fixes.',
    monetization: 'Charge by connected data sources and daily analyzed query volume.'
  }
];

const ensureArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const stripHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const toISOStringOrNow = (dateValue) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TrendSnifferBot/1.0 (+dashboard aggregation)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${url}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TrendSnifferBot/1.0 (+dashboard aggregation)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${url}`);
  }

  return response.json();
}

function extractImageFromItem(item) {
  const mediaContent = item['media:content'];
  const mediaThumbnail = item['media:thumbnail'];
  const enclosure = item.enclosure;

  if (Array.isArray(mediaContent) && mediaContent[0]?.url) return mediaContent[0].url;
  if (mediaContent?.url) return mediaContent.url;
  if (Array.isArray(mediaThumbnail) && mediaThumbnail[0]?.url) return mediaThumbnail[0].url;
  if (mediaThumbnail?.url) return mediaThumbnail.url;
  if (enclosure?.url) return enclosure.url;

  const description = item.description || item['content:encoded'];
  if (description) {
    const match = String(description).match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function getSignalFeeds() {
  const requests = [...GOOGLE_NEWS_FEEDS, ...TECH_RSS_FEEDS].map(async (feed) => {
    try {
      const xml = await fetchText(feed.url);
      const parsed = parser.parse(xml);
      const items = ensureArray(parsed?.rss?.channel?.item);

      return items.slice(0, 12).map((item, index) => ({
        id: `${feed.topic}-${index}-${item.guid || item.link || item.title}`,
        topic: feed.topic,
        title: stripHtml(item.title),
        summary: stripHtml(item.description || item['content:encoded'] || ''),
        link: item.link,
        source: stripHtml(item.source?.text || parsed?.rss?.channel?.title || 'Unknown Source'),
        publishedAt: toISOStringOrNow(item.pubDate),
        image: extractImageFromItem(item)
      }));
    } catch (error) {
      return [];
    }
  });

  const groups = await Promise.all(requests);

  return groups
    .flat()
    .filter((item) => item.title && item.link)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 40);
}

async function getGoogleTrendsUS() {
  const xml = await fetchText('https://trends.google.com/trending/rss?geo=US');
  const parsed = parser.parse(xml);
  const items = ensureArray(parsed?.rss?.channel?.item);

  return items.slice(0, 20).map((item, index) => {
    const relatedNews = ensureArray(item['ht:news_item']).map((news) => ({
      title: stripHtml(news['ht:news_item_title']),
      url: news['ht:news_item_url'],
      source: stripHtml(news['ht:news_item_source'])
    }));

    return {
      id: `trend-${index}-${item.title}`,
      query: stripHtml(item.title),
      approxTraffic: stripHtml(item['ht:approx_traffic'] || 'Not listed'),
      publishedAt: toISOStringOrNow(item.pubDate),
      picture: item['ht:picture'],
      pictureSource: item['ht:picture_source'],
      link: item.link,
      relatedNews
    };
  });
}

async function getVideoRadar() {
  const entries = await Promise.all(
    YOUTUBE_CHANNELS.map(async (channel) => {
      try {
        const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`);
        const parsed = parser.parse(xml);
        const feedEntries = ensureArray(parsed?.feed?.entry);

        return feedEntries.slice(0, 6).map((entry) => {
          const links = ensureArray(entry.link);
          const watchLink = links.find((value) => value.rel === 'alternate')?.href;
          const videoId = stripHtml(entry['yt:videoId']);

          return {
            id: `${channel.id}-${videoId}`,
            title: stripHtml(entry.title),
            link: watchLink,
            channel: channel.label,
            publishedAt: toISOStringOrNow(entry.published),
            thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
          };
        });
      } catch (error) {
        return [];
      }
    })
  );

  return entries
    .flat()
    .filter((entry) => entry.title && entry.link)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 24);
}

function classifyChallenge(title) {
  for (const rule of CATEGORY_RULES) {
    if (rule.test.test(title)) {
      return {
        key: rule.key,
        solution: rule.solution,
        monetization: rule.monetization
      };
    }
  }

  return {
    key: 'Debugging Complexity',
    solution: 'Build a cross-stack incident assistant that reads logs, stack traces, and recent deploys to suggest fixes.',
    monetization: 'Per-incident pricing with enterprise annual contracts for unlimited incident automation.'
  };
}

async function getChallengesAndIdeas() {
  const since = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7;
  const apiUrl = `https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&site=stackoverflow&pagesize=80&fromdate=${since}`;

  const data = await fetchJson(apiUrl);
  const questions = ensureArray(data.items)
    .filter((item) => item.link && item.title)
    .slice(0, 50)
    .map((item) => ({
      id: item.question_id,
      title: stripHtml(item.title),
      link: item.link,
      score: item.score,
      tags: item.tags || [],
      answers: item.answer_count,
      createdAt: toISOStringOrNow(item.creation_date * 1000)
    }));

  const grouped = new Map();

  questions.forEach((question) => {
    const bucket = classifyChallenge(question.title);
    if (!grouped.has(bucket.key)) {
      grouped.set(bucket.key, {
        category: bucket.key,
        challenge: `Developers are repeatedly blocked by ${bucket.key.toLowerCase()} issues.`,
        suggestedSolution: bucket.solution,
        monetization: bucket.monetization,
        references: []
      });
    }

    const group = grouped.get(bucket.key);
    if (group.references.length < 5) {
      group.references.push({
        title: question.title,
        link: question.link,
        score: question.score,
        tags: question.tags
      });
    }
  });

  const opportunities = [...grouped.values()].sort((a, b) => {
    const aScore = a.references.reduce((sum, ref) => sum + ref.score, 0);
    const bScore = b.references.reduce((sum, ref) => sum + ref.score, 0);
    return bScore - aScore;
  });

  return {
    opportunities,
    source: 'Stack Overflow (Stack Exchange API)',
    questionsAnalyzed: questions.length,
    sampledQuestions: questions.slice(0, 12)
  };
}

function canSendTelegram() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

async function sendTelegramMessage(text) {
  if (!canSendTelegram()) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing');
  }

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram message');
  }

  return data;
}

async function buildDigestMessage() {
  const [signals, trends, videos] = await Promise.all([
    getSignalFeeds(),
    getGoogleTrendsUS(),
    getVideoRadar()
  ]);

  const topSignals = signals.slice(0, 3);
  const topTrends = trends.slice(0, 3);
  const topVideos = videos.slice(0, 2);

  const signalText = topSignals
    .map((item, index) => `${index + 1}. ${item.title}\n${item.link}`)
    .join('\n\n');

  const trendText = topTrends
    .map((item, index) => `${index + 1}. ${item.query} (${item.approxTraffic})\n${item.link}`)
    .join('\n\n');

  const videoText = topVideos
    .map((item, index) => `${index + 1}. ${item.title} - ${item.channel}\n${item.link}`)
    .join('\n\n');

  return [
    'Trend Sniffer Digest',
    '',
    'Top Tech Signals',
    signalText,
    '',
    'Most Common Recent Google Searches (US)',
    trendText,
    '',
    'Video Radar',
    videoText
  ].join('\n');
}

if (process.env.TELEGRAM_CRON) {
  cron.schedule(process.env.TELEGRAM_CRON, async () => {
    try {
      if (!canSendTelegram()) return;
      const message = await buildDigestMessage();
      await sendTelegramMessage(message);
      // eslint-disable-next-line no-console
      console.log(`[telegram] digest sent at ${new Date().toISOString()}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[telegram] digest failed:', error.message);
    }
  });
}

app.get('/api/dashboard', async (_req, res) => {
  try {
    const [signals, googleSearches, videos, challenges] = await Promise.all([
      getSignalFeeds(),
      getGoogleTrendsUS(),
      getVideoRadar(),
      getChallengesAndIdeas()
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      references: {
        signals: 'Google News RSS, TechCrunch RSS, The Verge RSS',
        googleSearches: 'Google Trends Daily Search Trends (US)',
        videos: 'YouTube channel RSS feeds',
        challenges: challenges.source
      },
      telegramConfigured: canSendTelegram(),
      signals,
      googleSearches,
      videos,
      challenges
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notify/telegram/digest', async (_req, res) => {
  try {
    const message = await buildDigestMessage();
    const result = await sendTelegramMessage(message);
    res.json({ ok: true, telegramResponse: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/notify/telegram/message', async (req, res) => {
  try {
    const message = stripHtml(req.body?.message || 'Trend Sniffer says hi.');
    if (!message) {
      return res.status(400).json({ ok: false, error: 'Message cannot be empty' });
    }

    const result = await sendTelegramMessage(message);
    return res.json({ ok: true, telegramResponse: result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/meta', (_req, res) => {
  res.json({
    app: 'Trend Sniffer',
    telegramConfigured: canSendTelegram(),
    now: new Date().toISOString()
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Trend Sniffer running on http://localhost:${PORT}`);
});
