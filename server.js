const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { XMLParser } = require('fast-xml-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'trend-sniffer-store.json');
const MAX_SEEN_IDS = 1500;

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

const BASE_YOUTUBE_CHANNELS = [
  { label: 'OpenAI', id: 'UCXZCJLdBC09xxGZ6gcdrc6A' },
  { label: 'Google Developers', id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
  { label: 'Fireship', id: 'UCsBjURrPoezykLs9EqgamOA' },
  { label: 'freeCodeCamp', id: 'UC8butISFwT-Wl7EV0hUK0BQ' }
];

const DEFAULT_TEMPLATE = {
  id: 'template-default',
  name: 'Concise New Items',
  body: [
    'Trend Sniffer Alert - {{generatedAt}}',
    'Watch Topics: {{watchTopics}}',
    'Watch Channels: {{watchChannels}}',
    '',
    'New Signals ({{newSignalsCount}})',
    '{{signalsList}}',
    '',
    'New Google Searches ({{newSearchesCount}})',
    '{{searchesList}}',
    '',
    'New Videos ({{newVideosCount}})',
    '{{videosList}}',
    '',
    'Quick Build Spark',
    '{{sparkLine}}'
  ].join('\n')
};

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

const safeLower = (value) => stripHtml(value).toLowerCase();

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultStore() {
  return {
    watchlist: {
      topics: ['ai', 'cybersecurity'],
      channels: []
    },
    templates: [DEFAULT_TEMPLATE],
    activeTemplateId: DEFAULT_TEMPLATE.id,
    seen: {
      signals: {},
      searches: {},
      videos: {}
    },
    settings: {
      sendOnlyNewItems: true
    }
  };
}

function sanitizeTopic(value) {
  return stripHtml(value).toLowerCase().slice(0, 50);
}

function sanitizeChannel(value) {
  const channel = {
    label: stripHtml(value?.label || '').slice(0, 60),
    id: stripHtml(value?.id || '').slice(0, 60)
  };

  if (!channel.label) return null;
  if (channel.id && !/^[A-Za-z0-9_-]{8,60}$/.test(channel.id)) return null;
  return channel;
}

function sanitizeTemplate(value) {
  const rawBody = String(value?.body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '')
    .trim();

  const template = {
    id: stripHtml(value?.id || makeId('template')).slice(0, 80),
    name: stripHtml(value?.name || 'Untitled Template').slice(0, 60),
    body: rawBody.slice(0, 3600)
  };

  if (!template.body) return null;
  return template;
}

function normalizeStore(rawStore) {
  const topics = ensureArray(rawStore?.watchlist?.topics)
    .map(sanitizeTopic)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 24);

  const channels = ensureArray(rawStore?.watchlist?.channels)
    .map(sanitizeChannel)
    .filter(Boolean)
    .filter((value, index, all) => all.findIndex((entry) => entry.label.toLowerCase() === value.label.toLowerCase()) === index)
    .slice(0, 24);

  const templates = ensureArray(rawStore?.templates)
    .map(sanitizeTemplate)
    .filter(Boolean)
    .slice(0, 12);

  const templateList = templates.length ? templates : [DEFAULT_TEMPLATE];
  const templateIds = new Set(templateList.map((template) => template.id));
  const activeTemplateId = templateIds.has(rawStore?.activeTemplateId)
    ? rawStore.activeTemplateId
    : templateList[0].id;

  return {
    watchlist: {
      topics,
      channels
    },
    templates: templateList,
    activeTemplateId,
    seen: {
      signals: rawStore?.seen?.signals && typeof rawStore.seen.signals === 'object' ? rawStore.seen.signals : {},
      searches: rawStore?.seen?.searches && typeof rawStore.seen.searches === 'object' ? rawStore.seen.searches : {},
      videos: rawStore?.seen?.videos && typeof rawStore.seen.videos === 'object' ? rawStore.seen.videos : {}
    },
    settings: {
      sendOnlyNewItems: rawStore?.settings?.sendOnlyNewItems !== false
    }
  };
}

function loadStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) {
      const freshStore = defaultStore();
      fs.writeFileSync(STORE_FILE, JSON.stringify(freshStore, null, 2));
      return freshStore;
    }

    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);
    fs.writeFileSync(STORE_FILE, JSON.stringify(normalized, null, 2));
    return normalized;
  } catch (error) {
    return defaultStore();
  }
}

let store = loadStore();

function persistStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  store = normalizeStore(store);
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function publicPreferences() {
  return {
    watchlist: store.watchlist,
    templates: store.templates,
    activeTemplateId: store.activeTemplateId,
    settings: store.settings
  };
}

function getActiveTemplate(templateId) {
  const byId = store.templates.find((template) => template.id === templateId);
  const active = store.templates.find((template) => template.id === store.activeTemplateId);
  return byId || active || DEFAULT_TEMPLATE;
}

function pruneSeenMap(seenMap) {
  const entries = Object.entries(seenMap);
  if (entries.length <= MAX_SEEN_IDS) return seenMap;

  const keep = entries
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, MAX_SEEN_IDS);

  return Object.fromEntries(keep);
}

function markCollectionSeen(collectionName, items) {
  const now = Date.now();
  items.forEach((item) => {
    store.seen[collectionName][item.id] = now;
  });
  store.seen[collectionName] = pruneSeenMap(store.seen[collectionName]);
}

function markDashboardSeen(data) {
  markCollectionSeen('signals', data.signals || []);
  markCollectionSeen('searches', data.googleSearches || []);
  markCollectionSeen('videos', data.videos || []);
  persistStore();
}

function getWatchTerms() {
  return {
    topics: (store.watchlist?.topics || []).map((topic) => topic.toLowerCase()),
    channels: (store.watchlist?.channels || []).map((channel) => channel.label.toLowerCase())
  };
}

function matchesWatchlistForSignal(item, terms) {
  if (!terms.topics.length && !terms.channels.length) return true;
  const haystack = safeLower(`${item.title} ${item.summary} ${item.topic} ${item.source}`);
  return terms.topics.some((topic) => haystack.includes(topic)) || terms.channels.some((channel) => haystack.includes(channel));
}

function matchesWatchlistForSearch(item, terms) {
  if (!terms.topics.length && !terms.channels.length) return true;
  const related = ensureArray(item.relatedNews)
    .map((entry) => `${entry.title || ''} ${entry.source || ''}`)
    .join(' ');
  const haystack = safeLower(`${item.query} ${item.approxTraffic} ${related}`);
  return terms.topics.some((topic) => haystack.includes(topic)) || terms.channels.some((channel) => haystack.includes(channel));
}

function matchesWatchlistForVideo(item, terms) {
  if (!terms.topics.length && !terms.channels.length) return true;
  const haystack = safeLower(`${item.title} ${item.channel}`);
  return terms.topics.some((topic) => haystack.includes(topic)) || terms.channels.some((channel) => haystack.includes(channel));
}

function pickSparkLine(challenges) {
  const opportunity = ensureArray(challenges?.opportunities)[0];
  if (!opportunity) {
    return 'No challenge spark available yet. Pull fresh data and try again.';
  }

  return `${opportunity.category}: ${opportunity.suggestedSolution}`;
}

function listText(items, formatter, emptyMessage) {
  const rows = items.slice(0, 5).map((item, index) => `${index + 1}. ${formatter(item)}`);
  return rows.length ? rows.join('\n') : emptyMessage;
}

function applyTemplate(body, context) {
  return body.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return String(context[key]);
    }
    return '';
  });
}

function trimTelegramMessage(text) {
  if (text.length <= 3900) return text;
  return `${text.slice(0, 3870)}\n\n...truncated by Trend Sniffer`;
}

function getUnseenData(data) {
  const unseenSignals = ensureArray(data.signals).filter((item) => !store.seen.signals[item.id]);
  const unseenSearches = ensureArray(data.googleSearches).filter((item) => !store.seen.searches[item.id]);
  const unseenVideos = ensureArray(data.videos).filter((item) => !store.seen.videos[item.id]);

  return {
    unseenSignals,
    unseenSearches,
    unseenVideos
  };
}

function getPendingNew(data) {
  const terms = getWatchTerms();
  const unseen = getUnseenData(data);

  const matchedSignals = unseen.unseenSignals.filter((item) => matchesWatchlistForSignal(item, terms));
  const matchedSearches = unseen.unseenSearches.filter((item) => matchesWatchlistForSearch(item, terms));
  const matchedVideos = unseen.unseenVideos.filter((item) => matchesWatchlistForVideo(item, terms));

  return {
    signals: matchedSignals,
    searches: matchedSearches,
    videos: matchedVideos,
    total: matchedSignals.length + matchedSearches.length + matchedVideos.length,
    rawUnseenTotal: unseen.unseenSignals.length + unseen.unseenSearches.length + unseen.unseenVideos.length
  };
}

function getSourceMix(signals) {
  const counts = {};
  signals.forEach((item) => {
    const key = item.topic || 'Other';
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TrendSnifferBot/2.0 (+watchlist and new-item alerts)'
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
      'User-Agent': 'TrendSnifferBot/2.0 (+watchlist and new-item alerts)'
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
    } catch (_error) {
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
  try {
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
  } catch (_error) {
    return [];
  }
}

function getYouTubeSources() {
  const watchedSources = ensureArray(store.watchlist?.channels)
    .filter((channel) => channel.id)
    .map((channel) => ({ label: channel.label, id: channel.id }));

  const merged = [...BASE_YOUTUBE_CHANNELS, ...watchedSources];
  return merged.filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index);
}

async function getVideoRadar() {
  const channels = getYouTubeSources();

  const entries = await Promise.all(
    channels.map(async (channel) => {
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
      } catch (_error) {
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
  try {
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
  } catch (_error) {
    return {
      opportunities: [],
      source: 'Stack Overflow (Stack Exchange API)',
      questionsAnalyzed: 0,
      sampledQuestions: []
    };
  }
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

async function buildDashboardData() {
  const [signals, googleSearches, videos, challenges] = await Promise.all([
    getSignalFeeds(),
    getGoogleTrendsUS(),
    getVideoRadar(),
    getChallengesAndIdeas()
  ]);

  const pendingNew = getPendingNew({ signals, googleSearches, videos });

  return {
    generatedAt: new Date().toISOString(),
    references: {
      signals: 'Google News RSS, TechCrunch RSS, The Verge RSS',
      googleSearches: 'Google Trends Daily Search Trends (US)',
      videos: 'YouTube channel RSS feeds',
      challenges: challenges.source
    },
    telegramConfigured: canSendTelegram(),
    settings: {
      cron: process.env.TELEGRAM_CRON || null
    },
    watchlistSummary: {
      topics: store.watchlist.topics,
      channels: store.watchlist.channels
    },
    pendingNew: {
      signals: pendingNew.signals.length,
      searches: pendingNew.searches.length,
      videos: pendingNew.videos.length,
      total: pendingNew.total,
      rawUnseenTotal: pendingNew.rawUnseenTotal
    },
    creative: {
      sourceMix: getSourceMix(signals),
      sparkLine: pickSparkLine(challenges)
    },
    signals,
    googleSearches,
    videos,
    challenges,
    preferences: publicPreferences()
  };
}

function buildTemplateMessage(data, templateId, mode = 'new') {
  const pending = getPendingNew(data);
  const template = getActiveTemplate(templateId);
  const terms = getWatchTerms();

  const signalItems = mode === 'full' ? data.signals.slice(0, 5) : pending.signals;
  const searchItems = mode === 'full' ? data.googleSearches.slice(0, 5) : pending.searches;
  const videoItems = mode === 'full' ? data.videos.slice(0, 5) : pending.videos;

  const context = {
    generatedAt: new Date(data.generatedAt).toLocaleString(),
    watchTopics: terms.topics.length ? terms.topics.join(', ') : 'all topics',
    watchChannels: terms.channels.length ? terms.channels.join(', ') : 'all channels',
    newSignalsCount: signalItems.length,
    newSearchesCount: searchItems.length,
    newVideosCount: videoItems.length,
    signalsList: listText(
      signalItems,
      (item) => `${item.title}\n${item.link}`,
      'No signal updates.'
    ),
    searchesList: listText(
      searchItems,
      (item) => `${item.query} (${item.approxTraffic})\n${item.link}`,
      'No search updates.'
    ),
    videosList: listText(
      videoItems,
      (item) => `${item.title} - ${item.channel}\n${item.link}`,
      'No video updates.'
    ),
    sparkLine: pickSparkLine(data.challenges)
  };

  const rawMessage = applyTemplate(template.body, context);
  const text = trimTelegramMessage(rawMessage);

  return {
    text,
    counts: {
      signals: signalItems.length,
      searches: searchItems.length,
      videos: videoItems.length,
      total: signalItems.length + searchItems.length + videoItems.length
    },
    rawPendingTotal: pending.total
  };
}

async function sendDigest({ mode = 'new', templateId } = {}) {
  const data = await buildDashboardData();
  const digest = buildTemplateMessage(data, templateId, mode);

  if (mode !== 'full' && digest.counts.total === 0) {
    return {
      ok: true,
      sent: false,
      reason: 'No new watchlist-matching items yet.',
      counts: digest.counts,
      generatedAt: data.generatedAt
    };
  }

  const telegramResponse = await sendTelegramMessage(digest.text);
  markDashboardSeen(data);

  return {
    ok: true,
    sent: true,
    mode,
    counts: digest.counts,
    generatedAt: data.generatedAt,
    telegramResponse
  };
}

if (process.env.TELEGRAM_CRON) {
  cron.schedule(process.env.TELEGRAM_CRON, async () => {
    try {
      if (!canSendTelegram()) return;
      const result = await sendDigest({ mode: 'new' });
      if (result.sent) {
        // eslint-disable-next-line no-console
        console.log(`[telegram] sent ${result.counts.total} new items at ${new Date().toISOString()}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[telegram] digest failed:', error.message);
    }
  });
}

app.get('/api/dashboard', async (_req, res) => {
  try {
    const dashboard = await buildDashboardData();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/preferences', (_req, res) => {
  res.json(publicPreferences());
});

app.put('/api/preferences', (req, res) => {
  try {
    const nextStore = {
      ...store,
      watchlist: req.body?.watchlist || store.watchlist,
      templates: req.body?.templates || store.templates,
      activeTemplateId: req.body?.activeTemplateId || store.activeTemplateId,
      settings: req.body?.settings || store.settings,
      seen: store.seen
    };

    store = normalizeStore(nextStore);
    persistStore();

    res.json({ ok: true, preferences: publicPreferences() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/notify/telegram/preview', async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'new';
    const templateId = stripHtml(req.body?.templateId || '');
    const data = await buildDashboardData();
    const preview = buildTemplateMessage(data, templateId, mode);

    res.json({
      ok: true,
      mode,
      counts: preview.counts,
      generatedAt: data.generatedAt,
      text: preview.text
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/notify/telegram/digest', async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'new';
    const templateId = stripHtml(req.body?.templateId || '');
    const result = await sendDigest({ mode, templateId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/alerts/acknowledge', async (_req, res) => {
  try {
    const data = await buildDashboardData();
    markDashboardSeen(data);
    res.json({ ok: true, message: 'Current feed marked as seen.' });
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
    now: new Date().toISOString(),
    activeTemplateId: store.activeTemplateId
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Trend Sniffer running on http://localhost:${PORT}`);
});
