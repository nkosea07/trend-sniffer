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
const MAX_COPILOT_ACTIONS = 120;
const MAX_BRIEFING_HISTORY = 40;
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const DEFAULT_BRIEFING_TIME = '06:30';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  trimValues: true
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RSS_PRESET_PACKS = {
  'business-maker': [
    {
      id: 'preset-startup-funding',
      name: 'Startup Funding Pulse',
      category: 'Business',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=startup+funding+venture+capital+saas&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-maker-economy',
      name: 'Maker Economy',
      category: 'Maker',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=indie+hacker+maker+creator+economy+product&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-small-business-tech',
      name: 'Small Business Tools',
      category: 'Business',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=small+business+automation+software+tools&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-product-growth',
      name: 'Product & Growth',
      category: 'Growth',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=product+growth+retention+activation+startup&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-hn-maker',
      name: 'Hacker News',
      category: 'Maker',
      preset: true,
      enabled: true,
      url: 'https://news.ycombinator.com/rss'
    }
  ],
  'technology-core': [
    {
      id: 'preset-ai-robotics',
      name: 'AI & Robotics',
      category: 'Technology',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=artificial+intelligence+robotics+industry&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-cloud-platform',
      name: 'Cloud & Platform',
      category: 'Technology',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=cloud+platform+engineering+enterprise&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-cybersecurity',
      name: 'Cybersecurity',
      category: 'Technology',
      preset: true,
      enabled: true,
      url: 'https://news.google.com/rss/search?q=cybersecurity+breach+zero+day+technology&hl=en-US&gl=US&ceid=US:en'
    },
    {
      id: 'preset-techcrunch',
      name: 'TechCrunch',
      category: 'Technology',
      preset: true,
      enabled: true,
      url: 'https://techcrunch.com/feed/'
    },
    {
      id: 'preset-verge',
      name: 'The Verge',
      category: 'Technology',
      preset: true,
      enabled: true,
      url: 'https://www.theverge.com/rss/index.xml'
    }
  ]
};

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

function isValidTime(timeValue) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(timeValue || ''));
}

function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch (_error) {
    return false;
  }
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

function sanitizeRssSource(value, fallbackIdPrefix = 'source') {
  const candidateUrl = stripHtml(value?.url || '');
  const name = stripHtml(value?.name || value?.topic || '').slice(0, 90);
  const category = stripHtml(value?.category || 'General').slice(0, 40) || 'General';

  if (!candidateUrl || !/^https?:\/\//i.test(candidateUrl)) return null;

  try {
    const parsedUrl = new URL(candidateUrl);
    const normalizedUrl = parsedUrl.toString();

    return {
      id: stripHtml(value?.id || makeId(fallbackIdPrefix)).slice(0, 90),
      name: name || parsedUrl.hostname,
      url: normalizedUrl,
      category,
      enabled: value?.enabled !== false,
      preset: Boolean(value?.preset)
    };
  } catch (_error) {
    return null;
  }
}

function sanitizeCopilotAction(raw) {
  const id = stripHtml(raw?.id || makeId('action')).slice(0, 100);
  const type = stripHtml(raw?.type || '').slice(0, 60);
  const summary = stripHtml(raw?.summary || '').slice(0, 240);
  if (!id || !type) return null;

  return {
    id,
    type,
    summary,
    risk: stripHtml(raw?.risk || 'low').slice(0, 20) || 'low',
    status: ['pending', 'confirmed', 'rejected', 'failed'].includes(raw?.status) ? raw.status : 'pending',
    payload: raw?.payload && typeof raw.payload === 'object' ? raw.payload : {},
    origin: stripHtml(raw?.origin || 'copilot').slice(0, 20) || 'copilot',
    createdAt: toISOStringOrNow(raw?.createdAt),
    updatedAt: toISOStringOrNow(raw?.updatedAt || raw?.createdAt)
  };
}

function defaultRssSources() {
  return RSS_PRESET_PACKS['business-maker'].map((entry) => ({ ...entry }));
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
    },
    rssSources: defaultRssSources(),
    copilot: {
      requireConfirmation: true,
      pendingActions: [],
      history: []
    },
    briefing: {
      schedule: {
        time: DEFAULT_BRIEFING_TIME,
        timezone: DEFAULT_TIMEZONE
      },
      delivery: {
        inApp: true,
        telegram: true,
        telegramPaused: false
      },
      behavior: {
        askBeforeGenerateWhenTelegramPaused: true,
        defaultContinueWhenPaused: true
      },
      lastGeneratedAt: null,
      history: []
    }
  };
}

function sanitizeBriefing(rawBriefing) {
  const fallback = defaultStore().briefing;

  const time = isValidTime(rawBriefing?.schedule?.time)
    ? rawBriefing.schedule.time
    : fallback.schedule.time;

  const timezone = isValidTimezone(rawBriefing?.schedule?.timezone)
    ? rawBriefing.schedule.timezone
    : fallback.schedule.timezone;

  const history = ensureArray(rawBriefing?.history)
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, MAX_BRIEFING_HISTORY)
    .map((entry) => ({
      id: stripHtml(entry.id || makeId('briefing')).slice(0, 100),
      generatedAt: toISOStringOrNow(entry.generatedAt),
      mode: entry.mode === 'full' ? 'full' : 'new',
      counts: {
        signals: Number(entry?.counts?.signals || 0),
        searches: Number(entry?.counts?.searches || 0),
        videos: Number(entry?.counts?.videos || 0),
        total: Number(entry?.counts?.total || 0)
      },
      sentToTelegram: Boolean(entry.sentToTelegram),
      note: stripHtml(entry.note || '').slice(0, 200),
      text: String(entry.text || '').slice(0, 4200)
    }));

  return {
    schedule: {
      time,
      timezone
    },
    delivery: {
      inApp: rawBriefing?.delivery?.inApp !== false,
      telegram: rawBriefing?.delivery?.telegram !== false,
      telegramPaused: rawBriefing?.delivery?.telegramPaused === true
    },
    behavior: {
      askBeforeGenerateWhenTelegramPaused: rawBriefing?.behavior?.askBeforeGenerateWhenTelegramPaused !== false,
      defaultContinueWhenPaused: rawBriefing?.behavior?.defaultContinueWhenPaused !== false
    },
    lastGeneratedAt: rawBriefing?.lastGeneratedAt ? toISOStringOrNow(rawBriefing.lastGeneratedAt) : null,
    history
  };
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

  const rssSources = ensureArray(rawStore?.rssSources)
    .map((entry) => sanitizeRssSource(entry))
    .filter(Boolean)
    .filter((entry, index, all) => all.findIndex((value) => value.url === entry.url) === index)
    .slice(0, 80);

  const sanitizedRssSources = rssSources.length ? rssSources : defaultRssSources();

  const pendingActions = ensureArray(rawStore?.copilot?.pendingActions)
    .map(sanitizeCopilotAction)
    .filter(Boolean)
    .slice(0, MAX_COPILOT_ACTIONS);

  const history = ensureArray(rawStore?.copilot?.history)
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 80)
    .map((entry) => ({
      id: stripHtml(entry.id || makeId('chat')).slice(0, 100),
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      message: stripHtml(entry.message || '').slice(0, 800),
      createdAt: toISOStringOrNow(entry.createdAt)
    }));

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
    },
    rssSources: sanitizedRssSources,
    copilot: {
      requireConfirmation: rawStore?.copilot?.requireConfirmation !== false,
      pendingActions,
      history
    },
    briefing: sanitizeBriefing(rawStore?.briefing || {})
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
  } catch (_error) {
    return defaultStore();
  }
}

let store = loadStore();
let briefingJob = null;

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
    settings: store.settings,
    rssSources: store.rssSources,
    briefing: store.briefing,
    copilot: {
      requireConfirmation: store.copilot.requireConfirmation
    }
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
      'User-Agent': 'TrendSnifferBot/3.0 (+copilot + configurable rss + local persistence)'
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
      'User-Agent': 'TrendSnifferBot/3.0 (+copilot + configurable rss + local persistence)'
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

function getEnabledRssSources() {
  const enabled = ensureArray(store.rssSources).filter((source) => source.enabled);
  return enabled.length ? enabled : defaultRssSources();
}

function parseAtomLink(entry) {
  const links = ensureArray(entry.link);
  if (!links.length) return null;

  const alternate = links.find((item) => item.rel === 'alternate' && item.href);
  if (alternate) return alternate.href;

  const firstHref = links.find((item) => item.href)?.href;
  if (firstHref) return firstHref;

  const firstString = links.find((item) => typeof item === 'string');
  return firstString || null;
}

function parseFeedItems(xmlText, feed) {
  const parsed = parser.parse(xmlText);
  const rssItems = ensureArray(parsed?.rss?.channel?.item);
  if (rssItems.length) {
    const sourceTitle = stripHtml(parsed?.rss?.channel?.title || feed.name || 'Unknown Source');
    return rssItems.slice(0, 12).map((item, index) => ({
      id: `${feed.id}-${index}-${item.guid || item.link || item.title}`,
      topic: feed.category || feed.name || 'General',
      title: stripHtml(item.title),
      summary: stripHtml(item.description || item['content:encoded'] || ''),
      link: item.link,
      source: stripHtml(item.source?.text || sourceTitle),
      publishedAt: toISOStringOrNow(item.pubDate),
      image: extractImageFromItem(item)
    }));
  }

  const atomEntries = ensureArray(parsed?.feed?.entry);
  if (atomEntries.length) {
    const sourceTitle = stripHtml(parsed?.feed?.title || feed.name || 'Unknown Source');
    return atomEntries.slice(0, 12).map((entry, index) => ({
      id: `${feed.id}-${index}-${entry.id || entry.link?.href || entry.title}`,
      topic: feed.category || feed.name || 'General',
      title: stripHtml(entry.title),
      summary: stripHtml(entry.summary || entry.content || ''),
      link: parseAtomLink(entry),
      source: sourceTitle,
      publishedAt: toISOStringOrNow(entry.published || entry.updated),
      image: null
    }));
  }

  return [];
}

async function getSignalFeeds() {
  const sources = getEnabledRssSources();

  const requests = sources.map(async (feed) => {
    try {
      const xml = await fetchText(feed.url);
      return parseFeedItems(xml, feed);
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
      signals: getEnabledRssSources()
        .map((entry) => `${entry.name} (${entry.url})`)
        .slice(0, 8)
        .join(', '),
      googleSearches: 'Google Trends Daily Search Trends (US)',
      videos: 'YouTube channel RSS feeds',
      challenges: challenges.source
    },
    telegramConfigured: canSendTelegram(),
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
    preferences: publicPreferences(),
    copilot: {
      pendingActions: store.copilot.pendingActions.filter((action) => action.status === 'pending'),
      requireConfirmation: store.copilot.requireConfirmation
    }
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

function getTelegramPausePromptPayload(mode, digest) {
  return {
    ok: true,
    needsConfirmationPrompt: true,
    message: 'Telegram delivery is paused. Continue generating in-app summary?',
    defaultDecision: store.briefing.behavior.defaultContinueWhenPaused ? 'continue' : 'cancel',
    mode,
    counts: digest.counts
  };
}

async function sendDigest({ mode = 'new', templateId, pausedDecision, skipPausePrompt = false } = {}) {
  const data = await buildDashboardData();
  const digest = buildTemplateMessage(data, templateId, mode);

  if (mode !== 'full' && digest.counts.total === 0) {
    return {
      ok: true,
      sent: false,
      generated: false,
      reason: 'No new watchlist-matching items yet.',
      counts: digest.counts,
      generatedAt: data.generatedAt
    };
  }

  const telegramPaused = store.briefing.delivery.telegramPaused || !store.briefing.delivery.telegram;
  const shouldAsk = telegramPaused && store.briefing.behavior.askBeforeGenerateWhenTelegramPaused;

  if (shouldAsk && !skipPausePrompt && !['continue', 'cancel'].includes(pausedDecision)) {
    return getTelegramPausePromptPayload(mode, digest);
  }

  if (telegramPaused && pausedDecision === 'cancel') {
    return {
      ok: true,
      sent: false,
      generated: false,
      cancelled: true,
      reason: 'Briefing generation cancelled while telegram is paused.',
      counts: digest.counts,
      generatedAt: data.generatedAt
    };
  }

  let telegramResponse = null;
  let sent = false;

  if (!telegramPaused && canSendTelegram()) {
    telegramResponse = await sendTelegramMessage(digest.text);
    sent = true;
  }

  markDashboardSeen(data);

  return {
    ok: true,
    sent,
    generated: true,
    mode,
    counts: digest.counts,
    generatedAt: data.generatedAt,
    text: digest.text,
    telegramPaused,
    telegramResponse
  };
}

function appendBriefingHistory(entry) {
  store.briefing.history.unshift(entry);
  store.briefing.history = store.briefing.history.slice(0, MAX_BRIEFING_HISTORY);
}

async function generateBriefing(options = {}) {
  const mode = options.mode === 'full' ? 'full' : 'new';
  const templateId = stripHtml(options.templateId || store.activeTemplateId || '');

  let pausedDecision = options.pausedDecision;
  if (!pausedDecision && options.skipPausePrompt === true) {
    pausedDecision = store.briefing.behavior.defaultContinueWhenPaused ? 'continue' : 'cancel';
  }

  const result = await sendDigest({
    mode,
    templateId,
    pausedDecision,
    skipPausePrompt: options.skipPausePrompt === true
  });

  if (result.generated) {
    const generatedAt = result.generatedAt || new Date().toISOString();
    store.briefing.lastGeneratedAt = generatedAt;

    if (store.briefing.delivery.inApp && result.text) {
      appendBriefingHistory({
        id: makeId('briefing'),
        generatedAt,
        mode,
        counts: result.counts,
        sentToTelegram: Boolean(result.sent),
        note: result.sent ? 'Delivered to telegram and in-app.' : 'Generated in-app only.',
        text: result.text
      });
    }

    persistStore();
  }

  return result;
}

function queueCopilotAction({ type, payload = {}, summary, risk = 'low', origin = 'copilot' }) {
  const action = {
    id: makeId('action'),
    type,
    summary: stripHtml(summary || type).slice(0, 240),
    risk,
    status: 'pending',
    payload,
    origin,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.copilot.pendingActions.unshift(action);
  store.copilot.pendingActions = store.copilot.pendingActions.slice(0, MAX_COPILOT_ACTIONS);
  persistStore();
  return action;
}

function parseSchedulePatch(rawPatch) {
  const schedule = rawPatch?.schedule || {};
  const delivery = rawPatch?.delivery || {};
  const behavior = rawPatch?.behavior || {};

  if (schedule.time && !isValidTime(schedule.time)) {
    throw new Error('Invalid time format. Use HH:mm (24h).');
  }

  if (schedule.timezone && !isValidTimezone(schedule.timezone)) {
    throw new Error('Invalid timezone value.');
  }

  return {
    schedule: {
      time: schedule.time || store.briefing.schedule.time,
      timezone: schedule.timezone || store.briefing.schedule.timezone
    },
    delivery: {
      inApp: typeof delivery.inApp === 'boolean' ? delivery.inApp : store.briefing.delivery.inApp,
      telegram: typeof delivery.telegram === 'boolean' ? delivery.telegram : store.briefing.delivery.telegram,
      telegramPaused:
        typeof delivery.telegramPaused === 'boolean' ? delivery.telegramPaused : store.briefing.delivery.telegramPaused
    },
    behavior: {
      askBeforeGenerateWhenTelegramPaused:
        typeof behavior.askBeforeGenerateWhenTelegramPaused === 'boolean'
          ? behavior.askBeforeGenerateWhenTelegramPaused
          : store.briefing.behavior.askBeforeGenerateWhenTelegramPaused,
      defaultContinueWhenPaused:
        typeof behavior.defaultContinueWhenPaused === 'boolean'
          ? behavior.defaultContinueWhenPaused
          : store.briefing.behavior.defaultContinueWhenPaused
    }
  };
}

function applyPresetPack(presetKey) {
  const presets = RSS_PRESET_PACKS[presetKey];
  if (!presets) {
    throw new Error(`Unknown preset '${presetKey}'`);
  }

  const merged = [...store.rssSources];

  presets.forEach((entry) => {
    const clean = sanitizeRssSource(entry, 'preset-source');
    if (!clean) return;

    const existingIndex = merged.findIndex((value) => value.url === clean.url);
    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        name: clean.name,
        category: clean.category,
        enabled: true,
        preset: true
      };
      return;
    }

    merged.push(clean);
  });

  store.rssSources = merged;
  persistStore();

  return {
    addedOrEnabled: presets.length,
    presetKey,
    totalSources: store.rssSources.length
  };
}

function saveChatTurn(role, message) {
  if (!message) return;
  store.copilot.history.unshift({
    id: makeId('chat'),
    role,
    message: stripHtml(message).slice(0, 800),
    createdAt: new Date().toISOString()
  });
  store.copilot.history = store.copilot.history.slice(0, 80);
  persistStore();
}

function parseMessageToActionRequests(message) {
  const lower = message.toLowerCase();
  const actions = [];

  const urlMatch = message.match(/https?:\/\/[^\s]+/i);
  if (urlMatch && /(add|track|include).*(rss|feed|source)|rss|feed|source.*(add|track|include)/i.test(lower)) {
    try {
      const parsed = new URL(urlMatch[0]);
      actions.push({
        type: 'add_rss_source',
        summary: `Add RSS source ${parsed.hostname}`,
        risk: 'low',
        payload: {
          source: {
            name: parsed.hostname,
            url: parsed.toString(),
            category: 'General',
            enabled: true,
            preset: false
          }
        }
      });
    } catch (_error) {
      // ignore malformed URL in chat intent parsing
    }
  }

  if (/(pause).*(telegram)|(telegram).*(pause)/i.test(lower)) {
    actions.push({
      type: 'set_telegram_pause',
      summary: 'Pause telegram summary delivery',
      risk: 'low',
      payload: { paused: true }
    });
  }

  if (/(resume|unpause).*(telegram)|(telegram).*(resume|unpause)/i.test(lower)) {
    actions.push({
      type: 'set_telegram_pause',
      summary: 'Resume telegram summary delivery',
      risk: 'low',
      payload: { paused: false }
    });
  }

  const timeMatch = message.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  const timezoneMatch = message.match(/\b[A-Za-z_]+\/[A-Za-z_]+\b/);
  if ((/schedule|briefing|daily/i.test(lower) || timeMatch) && (timeMatch || timezoneMatch)) {
    actions.push({
      type: 'update_briefing_settings',
      summary: 'Update briefing schedule settings',
      risk: 'low',
      payload: {
        patch: {
          schedule: {
            time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : store.briefing.schedule.time,
            timezone: timezoneMatch ? timezoneMatch[0] : store.briefing.schedule.timezone
          }
        }
      }
    });
  }

  if (/business\s*\+?\s*maker|business\s+maker/i.test(lower)) {
    actions.push({
      type: 'apply_preset_pack',
      summary: 'Apply Business + Maker RSS presets',
      risk: 'low',
      payload: { presetKey: 'business-maker' }
    });
  }

  if (/technology\s+core|tech\s+preset/i.test(lower)) {
    actions.push({
      type: 'apply_preset_pack',
      summary: 'Apply Technology Core RSS presets',
      risk: 'low',
      payload: { presetKey: 'technology-core' }
    });
  }

  if (/(generate|create).*(briefing|summary)|(briefing|summary).*(generate|create)/i.test(lower)) {
    actions.push({
      type: 'generate_briefing',
      summary: 'Generate a fresh briefing now',
      risk: 'low',
      payload: {
        mode: 'new',
        templateId: store.activeTemplateId
      }
    });
  }

  return actions.slice(0, 3);
}

function composeCopilotReply(message, dashboard) {
  const lower = message.toLowerCase();
  const topSignals = dashboard.signals.slice(0, 3);
  const topChallenges = dashboard.challenges.opportunities.slice(0, 2);

  if (/challenge|problem|pain point|opportunit/i.test(lower)) {
    if (!topChallenges.length) {
      return 'No high-confidence challenge opportunities are available right now. Refresh and try again.';
    }

    const lines = topChallenges.map((entry, index) => `${index + 1}. ${entry.category}: ${entry.suggestedSolution}`);
    return `Top build opportunities right now:\n${lines.join('\n')}`;
  }

  if (/search|google trend/i.test(lower)) {
    const topSearches = dashboard.googleSearches.slice(0, 3);
    if (!topSearches.length) {
      return 'No Google trend entries are available right now.';
    }

    const lines = topSearches.map((entry, index) => `${index + 1}. ${entry.query} (${entry.approxTraffic})`);
    return `Top recent Google searches:\n${lines.join('\n')}`;
  }

  if (/what('| i)?s new|summary|update|highlights|brief/i.test(lower)) {
    if (!topSignals.length) {
      return 'No fresh signal headlines are available right now. Run a refresh.';
    }

    const lines = topSignals.map((entry, index) => `${index + 1}. ${entry.title}`);
    return [
      `Pending new items: ${dashboard.pendingNew.total} (${dashboard.pendingNew.signals} signals, ${dashboard.pendingNew.searches} searches, ${dashboard.pendingNew.videos} videos).`,
      `Top signals:\n${lines.join('\n')}`,
      `Spark: ${dashboard.creative.sparkLine}`
    ].join('\n\n');
  }

  return [
    'Copilot can help with summaries, challenges, and source configuration.',
    'Try prompts like:',
    '- "What is new today?"',
    '- "Add source https://example.com/feed"',
    '- "Set briefing to 06:30 Africa/Johannesburg"',
    '- "Pause telegram"'
  ].join('\n');
}

function toCronExpression(timeValue) {
  if (!isValidTime(timeValue)) {
    return null;
  }

  const [hour, minute] = timeValue.split(':').map((value) => Number(value));
  return `${minute} ${hour} * * *`;
}

function scheduleBriefingJob() {
  if (briefingJob) {
    briefingJob.stop();
    briefingJob = null;
  }

  const cronExpression = toCronExpression(store.briefing.schedule.time);
  const timezone = store.briefing.schedule.timezone;

  if (!cronExpression || !isValidTimezone(timezone)) {
    return;
  }

  briefingJob = cron.schedule(
    cronExpression,
    async () => {
      try {
        await generateBriefing({
          mode: 'new',
          templateId: store.activeTemplateId,
          skipPausePrompt: true,
          pausedDecision: store.briefing.behavior.defaultContinueWhenPaused ? 'continue' : 'cancel'
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[briefing] scheduled run failed:', error.message);
      }
    },
    {
      timezone
    }
  );
}

async function executeAction(action) {
  switch (action.type) {
    case 'add_rss_source': {
      const source = sanitizeRssSource(action.payload?.source, 'source');
      if (!source) {
        throw new Error('Invalid source payload.');
      }

      const exists = store.rssSources.find((entry) => entry.url === source.url);
      if (exists) {
        throw new Error('That source URL already exists.');
      }

      store.rssSources.unshift(source);
      persistStore();
      return { message: `Added source ${source.name}.` };
    }

    case 'update_rss_source': {
      const id = stripHtml(action.payload?.id || '');
      const patch = action.payload?.patch || {};
      const index = store.rssSources.findIndex((entry) => entry.id === id);
      if (index < 0) {
        throw new Error('Source not found.');
      }

      const current = store.rssSources[index];
      const updated = sanitizeRssSource(
        {
          ...current,
          ...patch,
          id: current.id,
          preset: current.preset
        },
        'source'
      );

      if (!updated) {
        throw new Error('Invalid source patch.');
      }

      const duplicate = store.rssSources.find((entry) => entry.url === updated.url && entry.id !== id);
      if (duplicate) {
        throw new Error('Another source already uses that URL.');
      }

      store.rssSources[index] = updated;
      persistStore();
      return { message: `Updated source ${updated.name}.` };
    }

    case 'remove_rss_source': {
      const id = stripHtml(action.payload?.id || '');
      const before = store.rssSources.length;
      store.rssSources = store.rssSources.filter((entry) => entry.id !== id);
      if (store.rssSources.length === before) {
        throw new Error('Source not found.');
      }

      persistStore();
      return { message: 'Source removed.' };
    }

    case 'apply_preset_pack': {
      const presetKey = stripHtml(action.payload?.presetKey || '');
      const result = applyPresetPack(presetKey);
      return { message: `Applied preset pack ${presetKey}.`, ...result };
    }

    case 'update_briefing_settings': {
      const patch = parseSchedulePatch(action.payload?.patch || {});
      store.briefing = sanitizeBriefing({
        ...store.briefing,
        ...patch,
        schedule: {
          ...store.briefing.schedule,
          ...patch.schedule
        },
        delivery: {
          ...store.briefing.delivery,
          ...patch.delivery
        },
        behavior: {
          ...store.briefing.behavior,
          ...patch.behavior
        }
      });

      persistStore();
      scheduleBriefingJob();
      return { message: 'Briefing settings updated.' };
    }

    case 'set_telegram_pause': {
      const paused = action.payload?.paused === true;
      store.briefing.delivery.telegramPaused = paused;
      persistStore();
      return { message: paused ? 'Telegram delivery paused.' : 'Telegram delivery resumed.' };
    }

    case 'generate_briefing': {
      const result = await generateBriefing({
        mode: action.payload?.mode === 'full' ? 'full' : 'new',
        templateId: action.payload?.templateId || store.activeTemplateId,
        skipPausePrompt: true,
        pausedDecision: store.briefing.behavior.defaultContinueWhenPaused ? 'continue' : 'cancel'
      });
      return {
        message: result.generated
          ? `Briefing generated (${result.counts.total} items).`
          : result.reason || 'Briefing not generated.',
        briefing: result
      };
    }

    default:
      throw new Error(`Unsupported action type '${action.type}'.`);
  }
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
      rssSources: req.body?.rssSources || store.rssSources,
      briefing: req.body?.briefing || store.briefing,
      copilot: {
        ...store.copilot,
        requireConfirmation: req.body?.copilot?.requireConfirmation !== false
      },
      seen: store.seen
    };

    store = normalizeStore(nextStore);
    persistStore();
    scheduleBriefingJob();

    res.json({ ok: true, preferences: publicPreferences() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/sources/rss', (_req, res) => {
  res.json({
    ok: true,
    sources: store.rssSources,
    presetKeys: Object.keys(RSS_PRESET_PACKS)
  });
});

app.post('/api/sources/presets/apply', (req, res) => {
  try {
    const presetKey = stripHtml(req.body?.presetKey || '');
    if (!presetKey) {
      return res.status(400).json({ ok: false, error: 'presetKey is required.' });
    }

    const action = queueCopilotAction({
      type: 'apply_preset_pack',
      payload: { presetKey },
      summary: `Apply preset pack '${presetKey}'`,
      risk: 'low',
      origin: 'manual'
    });

    return res.json({ ok: true, queued: true, action });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/sources/rss', (req, res) => {
  try {
    const source = sanitizeRssSource(req.body || {}, 'source');
    if (!source) {
      return res.status(400).json({ ok: false, error: 'Provide valid source name and RSS URL.' });
    }

    const action = queueCopilotAction({
      type: 'add_rss_source',
      payload: { source },
      summary: `Add source ${source.name}`,
      risk: 'low',
      origin: 'manual'
    });

    return res.json({ ok: true, queued: true, action });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch('/api/sources/rss/:id', (req, res) => {
  try {
    const id = stripHtml(req.params.id || '');
    const action = queueCopilotAction({
      type: 'update_rss_source',
      payload: {
        id,
        patch: {
          name: req.body?.name,
          url: req.body?.url,
          category: req.body?.category,
          enabled: req.body?.enabled
        }
      },
      summary: `Update source ${id}`,
      risk: 'low',
      origin: 'manual'
    });

    return res.json({ ok: true, queued: true, action });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.delete('/api/sources/rss/:id', (req, res) => {
  try {
    const id = stripHtml(req.params.id || '');
    const action = queueCopilotAction({
      type: 'remove_rss_source',
      payload: { id },
      summary: `Remove source ${id}`,
      risk: 'medium',
      origin: 'manual'
    });

    return res.json({ ok: true, queued: true, action });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/copilot/chat', async (req, res) => {
  try {
    const message = stripHtml(req.body?.message || '');
    if (!message) {
      return res.status(400).json({ ok: false, error: 'message is required.' });
    }

    saveChatTurn('user', message);

    const dashboard = await buildDashboardData();
    const reply = composeCopilotReply(message, dashboard);
    const requests = parseMessageToActionRequests(message);

    const queuedActions = requests.map((request) => queueCopilotAction(request));

    saveChatTurn('assistant', reply);

    return res.json({
      ok: true,
      reply,
      needsConfirmation: queuedActions.length > 0,
      queuedActions,
      suggestions: [
        'Ask for a summary of what is new.',
        'Add an RSS source URL to track another niche.',
        'Set or adjust schedule/timezone.',
        'Pause or resume telegram delivery.'
      ]
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/copilot/actions', (_req, res) => {
  const pending = store.copilot.pendingActions.filter((action) => action.status === 'pending');
  const recent = store.copilot.pendingActions.slice(0, 20);

  res.json({
    ok: true,
    requireConfirmation: store.copilot.requireConfirmation,
    pending,
    recent
  });
});

app.post('/api/copilot/actions/:id/confirm', async (req, res) => {
  try {
    const id = stripHtml(req.params.id || '');
    const action = store.copilot.pendingActions.find((entry) => entry.id === id);

    if (!action) {
      return res.status(404).json({ ok: false, error: 'Action not found.' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ ok: false, error: `Action already ${action.status}.` });
    }

    action.status = 'confirmed';
    action.updatedAt = new Date().toISOString();

    try {
      const result = await executeAction(action);
      action.result = result;
      persistStore();
      return res.json({ ok: true, action, result });
    } catch (error) {
      action.status = 'failed';
      action.updatedAt = new Date().toISOString();
      action.error = error.message;
      persistStore();
      return res.status(500).json({ ok: false, error: error.message, action });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/copilot/actions/:id/reject', (req, res) => {
  try {
    const id = stripHtml(req.params.id || '');
    const action = store.copilot.pendingActions.find((entry) => entry.id === id);

    if (!action) {
      return res.status(404).json({ ok: false, error: 'Action not found.' });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({ ok: false, error: `Action already ${action.status}.` });
    }

    action.status = 'rejected';
    action.updatedAt = new Date().toISOString();
    persistStore();

    return res.json({ ok: true, action });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/copilot/briefings', (_req, res) => {
  res.json({
    ok: true,
    briefing: store.briefing
  });
});

app.patch('/api/copilot/briefings/settings', (req, res) => {
  try {
    const patch = parseSchedulePatch(req.body || {});

    const action = queueCopilotAction({
      type: 'update_briefing_settings',
      payload: { patch },
      summary: `Update briefing schedule to ${patch.schedule.time} ${patch.schedule.timezone}`,
      risk: 'low',
      origin: 'manual'
    });

    return res.json({ ok: true, queued: true, action });
  } catch (error) {
    return res.status(400).json({ ok: false, error: error.message });
  }
});

app.post('/api/copilot/briefings/generate', async (req, res) => {
  try {
    const mode = req.body?.mode === 'full' ? 'full' : 'new';
    const templateId = stripHtml(req.body?.templateId || store.activeTemplateId || '');
    const pausedDecision = req.body?.pausedDecision;

    const result = await generateBriefing({
      mode,
      templateId,
      pausedDecision,
      skipPausePrompt: req.body?.skipPausePrompt === true
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
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

    const result = await sendDigest({
      mode,
      templateId,
      pausedDecision: store.briefing.behavior.defaultContinueWhenPaused ? 'continue' : 'cancel',
      skipPausePrompt: true
    });

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

    if (store.briefing.delivery.telegramPaused || !store.briefing.delivery.telegram) {
      return res.status(400).json({ ok: false, error: 'Telegram delivery is paused in briefing settings.' });
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
    activeTemplateId: store.activeTemplateId,
    briefingSchedule: store.briefing.schedule,
    telegramPaused: store.briefing.delivery.telegramPaused
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

scheduleBriefingJob();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Trend Sniffer running on http://localhost:${PORT}`);
});
