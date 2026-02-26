const state = {
  dashboard: null,
  preferences: null,
  tab: 'signals',
  query: '',
  editingTemplateId: null,
  copilotActions: [],
  pagination: {
    signals: 1,
    searches: 1,
    videos: 1,
    challenges: 1,
    evidence: 1,
    actions: 1,
    sources: 1
  }
};
const DEFAULT_PAGE_SIZE = 8;
const MIN_PAGE_SIZE = 4;
const MAX_PAGE_SIZE = 30;

const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  searchInput: document.getElementById('searchInput'),
  cardsPerPageInput: document.getElementById('cardsPerPageInput'),
  stats: document.getElementById('stats'),
  sourceMix: document.getElementById('sourceMix'),
  pendingStrip: document.getElementById('pendingStrip'),
  sparkText: document.getElementById('sparkText'),
  sparkBtn: document.getElementById('sparkBtn'),
  signalsGrid: document.getElementById('signalsGrid'),
  signalsPager: document.getElementById('signalsPager'),
  searchesGrid: document.getElementById('searchesGrid'),
  searchesPager: document.getElementById('searchesPager'),
  videosGrid: document.getElementById('videosGrid'),
  videosPager: document.getElementById('videosPager'),
  challengesGrid: document.getElementById('challengesGrid'),
  challengesPager: document.getElementById('challengesPager'),
  evidenceGrid: document.getElementById('evidenceGrid'),
  evidencePager: document.getElementById('evidencePager'),
  sourcesList: document.getElementById('sourcesList'),
  timestamp: document.getElementById('timestamp'),
  telegramStatus: document.getElementById('telegramStatus'),
  sendDigestBtn: document.getElementById('sendDigestBtn'),
  sendFullDigestBtn: document.getElementById('sendFullDigestBtn'),
  previewDigestBtn: document.getElementById('previewDigestBtn'),
  acknowledgeBtn: document.getElementById('acknowledgeBtn'),
  alertTemplateSelect: document.getElementById('alertTemplateSelect'),
  alertStatus: document.getElementById('alertStatus'),
  previewOutput: document.getElementById('previewOutput'),
  customMessage: document.getElementById('customMessage'),
  sendMessageBtn: document.getElementById('sendMessageBtn'),
  watchTopicsList: document.getElementById('watchTopicsList'),
  topicInput: document.getElementById('topicInput'),
  addTopicBtn: document.getElementById('addTopicBtn'),
  watchChannelsList: document.getElementById('watchChannelsList'),
  channelLabelInput: document.getElementById('channelLabelInput'),
  channelIdInput: document.getElementById('channelIdInput'),
  addChannelBtn: document.getElementById('addChannelBtn'),
  templateSelect: document.getElementById('templateSelect'),
  templateNameInput: document.getElementById('templateNameInput'),
  templateBodyInput: document.getElementById('templateBodyInput'),
  newTemplateBtn: document.getElementById('newTemplateBtn'),
  saveTemplateBtn: document.getElementById('saveTemplateBtn'),
  deleteTemplateBtn: document.getElementById('deleteTemplateBtn'),
  activateTemplateBtn: document.getElementById('activateTemplateBtn'),
  studioStatus: document.getElementById('studioStatus'),
  copilotInput: document.getElementById('copilotInput'),
  copilotAskBtn: document.getElementById('copilotAskBtn'),
  copilotOutput: document.getElementById('copilotOutput'),
  copilotActionsList: document.getElementById('copilotActionsList'),
  actionsPager: document.getElementById('actionsPager'),
  refreshActionsBtn: document.getElementById('refreshActionsBtn'),
  applyBusinessMakerPresetBtn: document.getElementById('applyBusinessMakerPresetBtn'),
  applyTechPresetBtn: document.getElementById('applyTechPresetBtn'),
  rssNameInput: document.getElementById('rssNameInput'),
  rssUrlInput: document.getElementById('rssUrlInput'),
  rssCategoryInput: document.getElementById('rssCategoryInput'),
  addRssBtn: document.getElementById('addRssBtn'),
  rssSourcesList: document.getElementById('rssSourcesList'),
  sourcesPager: document.getElementById('sourcesPager'),
  briefingTimeInput: document.getElementById('briefingTimeInput'),
  briefingTimezoneInput: document.getElementById('briefingTimezoneInput'),
  briefingInAppInput: document.getElementById('briefingInAppInput'),
  briefingTelegramInput: document.getElementById('briefingTelegramInput'),
  briefingTelegramPausedInput: document.getElementById('briefingTelegramPausedInput'),
  saveBriefingSettingsBtn: document.getElementById('saveBriefingSettingsBtn'),
  generateBriefingBtn: document.getElementById('generateBriefingBtn'),
  copilotStatus: document.getElementById('copilotStatus')
};

const defaultTemplateBody = [
  'Trend Sniffer Alert - {{generatedAt}}',
  'Watch Topics: {{watchTopics}}',
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
].join('\n');

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function normalizeText(value) {
  return String(value || '');
}

function matchesQuery(text) {
  return normalizeText(text).toLowerCase().includes(state.query.toLowerCase());
}

function emptyCard(message) {
  return `<div class="card feed-card"><p>${message}</p></div>`;
}

function templateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function currentPreferences() {
  return (
    state.preferences || {
      watchlist: { topics: [], channels: [] },
      templates: [],
      activeTemplateId: null,
      settings: { sendOnlyNewItems: true, cardsPerPage: DEFAULT_PAGE_SIZE },
      rssSources: [],
      briefing: {
        schedule: { time: '06:30', timezone: 'Africa/Johannesburg' },
        delivery: { inApp: true, telegram: true, telegramPaused: false },
        behavior: { askBeforeGenerateWhenTelegramPaused: true, defaultContinueWhenPaused: true }
      },
      copilot: { requireConfirmation: true }
    }
  );
}

function setStatus(element, message, tone = 'normal') {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('warn', 'good');
  if (tone === 'warn') element.classList.add('warn');
  if (tone === 'good') element.classList.add('good');
}

function resetFeedPagination() {
  ['signals', 'searches', 'videos', 'challenges', 'evidence'].forEach((key) => {
    state.pagination[key] = 1;
  });
}

function resetAllPagination() {
  Object.keys(state.pagination).forEach((key) => {
    state.pagination[key] = 1;
  });
}

function cardsPerPage() {
  const value = Number(currentPreferences()?.settings?.cardsPerPage);
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  const rounded = Math.round(value);
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, rounded));
}

function getPagedCollection(items, key) {
  const list = Array.isArray(items) ? items : [];
  const pageSize = cardsPerPage();
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));

  if (!state.pagination[key] || state.pagination[key] < 1) {
    state.pagination[key] = 1;
  }
  if (state.pagination[key] > totalPages) {
    state.pagination[key] = totalPages;
  }

  const page = state.pagination[key];
  const start = (page - 1) * pageSize;
  const pagedItems = list.slice(start, start + pageSize);

  return {
    items: pagedItems,
    page,
    totalPages,
    total: list.length
  };
}

function renderPager(element, key, page, totalPages, total) {
  if (!element) return;
  const pageSize = cardsPerPage();

  if (total <= pageSize) {
    element.innerHTML = '';
    return;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  const numberButtons = [];
  for (let value = adjustedStart; value <= end; value += 1) {
    numberButtons.push(
      `<button class="btn pager-btn ${value === page ? 'active' : ''}" data-page-key="${key}" data-page-value="${value}">${value}</button>`
    );
  }

  element.innerHTML = `
    <div class="pager-row">
      <button class="btn pager-btn" data-page-key="${key}" data-page-value="${Math.max(1, page - 1)}" ${
        page <= 1 ? 'disabled' : ''
      }>Prev</button>
      ${numberButtons.join('')}
      <button class="btn pager-btn" data-page-key="${key}" data-page-value="${Math.min(totalPages, page + 1)}" ${
        page >= totalPages ? 'disabled' : ''
      }>Next</button>
      <span class="pager-meta">Page ${page} of ${totalPages} (${total})</span>
    </div>
  `;
}

function createSignalCard(item) {
  const image = item.image ? `<img src="${item.image}" alt="${item.title}" loading="lazy" />` : '';
  return `
    <article class="card feed-card">
      ${image}
      <div class="meta">
        <span class="badge">${item.topic}</span>
        <span>${item.source}</span>
        <span>${formatDate(item.publishedAt)}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.summary || 'No summary available.'}</p>
      <a class="ref-link" href="${item.link}" target="_blank" rel="noreferrer">Open source reference</a>
    </article>
  `;
}

function createSearchCard(item) {
  const related = (item.relatedNews || [])
    .slice(0, 3)
    .map(
      (news) =>
        `<li><a href="${news.url}" target="_blank" rel="noreferrer">${news.title}</a> <span class="meta">(${news.source})</span></li>`
    )
    .join('');

  const image = item.picture ? `<img src="${item.picture}" alt="${item.query}" loading="lazy" />` : '';

  return `
    <article class="card feed-card">
      ${image}
      <div class="meta">
        <span class="badge">${item.approxTraffic}</span>
        <span>${formatDate(item.publishedAt)}</span>
      </div>
      <h3>${item.query}</h3>
      <p>Google Trends traffic estimate: ${item.approxTraffic}</p>
      <ul class="news-list">${related || '<li>No related stories listed.</li>'}</ul>
      <a class="ref-link" href="${item.link}" target="_blank" rel="noreferrer">View on Google Trends</a>
    </article>
  `;
}

function createVideoCard(item) {
  const image = item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.title}" loading="lazy" />` : '';
  return `
    <article class="card feed-card">
      ${image}
      <div class="meta">
        <span class="badge">${item.channel}</span>
        <span>${formatDate(item.publishedAt)}</span>
      </div>
      <h3>${item.title}</h3>
      <a class="ref-link" href="${item.link}" target="_blank" rel="noreferrer">Watch source video</a>
    </article>
  `;
}

function createChallengeCard(item) {
  const refs = (item.references || [])
    .slice(0, 3)
    .map((ref) => `<li><a href="${ref.link}" target="_blank" rel="noreferrer">${ref.title}</a></li>`)
    .join('');

  return `
    <article class="card feed-card">
      <div class="meta"><span class="badge">${item.category}</span></div>
      <h3>${item.challenge}</h3>
      <p><strong>Build:</strong> ${item.suggestedSolution}</p>
      <p><strong>Monetize:</strong> ${item.monetization}</p>
      <ul class="news-list">${refs}</ul>
    </article>
  `;
}

function createEvidenceCard(item) {
  return `
    <article class="card feed-card">
      <div class="meta">
        <span class="badge">Score ${item.score}</span>
        <span>${item.tags.join(', ')}</span>
      </div>
      <h3>${item.title}</h3>
      <a class="ref-link" href="${item.link}" target="_blank" rel="noreferrer">Open challenge reference</a>
    </article>
  `;
}

function randomSparkFromChallenges() {
  const opportunities = state.dashboard?.challenges?.opportunities || [];
  if (!opportunities.length) return 'No spark yet. Refresh to analyze new challenges.';
  const pick = opportunities[Math.floor(Math.random() * opportunities.length)];
  return `${pick.category}: ${pick.suggestedSolution}`;
}

function renderSourceMix() {
  const mix = state.dashboard?.creative?.sourceMix || [];
  if (!mix.length) {
    elements.sourceMix.innerHTML = '<p class="hint">No mix data yet.</p>';
    return;
  }

  const max = Math.max(...mix.map((entry) => entry.count));
  elements.sourceMix.innerHTML = mix
    .map((entry) => {
      const width = Math.max(15, Math.round((entry.count / max) * 100));
      return `
        <div class="mix-item">
          <span>${entry.name}</span>
          <div class="mix-bar"><i style="width:${width}%"></i></div>
          <strong>${entry.count}</strong>
        </div>
      `;
    })
    .join('');
}

function renderPulse() {
  const pending = state.dashboard?.pendingNew;
  if (!pending) {
    elements.pendingStrip.textContent = 'No pending data yet.';
    return;
  }

  elements.pendingStrip.textContent = `${pending.total} watchlist-matching new items pending (${pending.signals} signals, ${pending.searches} searches, ${pending.videos} videos).`;
}

function renderRssSources() {
  const sources = currentPreferences().rssSources || [];
  const paged = getPagedCollection(sources, 'sources');

  if (!paged.total) {
    elements.rssSourcesList.innerHTML = '<p class="hint">No RSS sources configured.</p>';
    renderPager(elements.sourcesPager, 'sources', 1, 1, 0);
    return;
  }

  elements.rssSourcesList.innerHTML = paged.items
    .map(
      (source) => `
        <div class="source-item" data-source-id="${source.id}">
          <strong>${source.name}</strong>
          <div class="source-meta">
            <span>${source.category}</span>
            <span>${source.preset ? 'Preset' : 'Custom'}</span>
            <span>${source.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <p>${source.url}</p>
          <div class="button-row">
            <button class="btn" data-source-action="toggle" data-source-id="${source.id}" data-enabled="${source.enabled}">${
              source.enabled ? 'Disable' : 'Enable'
            }</button>
            <button class="btn" data-source-action="remove" data-source-id="${source.id}">Remove</button>
          </div>
        </div>
      `
    )
    .join('');

  renderPager(elements.sourcesPager, 'sources', paged.page, paged.totalPages, paged.total);
}

function renderActions() {
  const paged = getPagedCollection(state.copilotActions, 'actions');

  if (!paged.total) {
    elements.copilotActionsList.innerHTML = '<p class="hint">No pending actions.</p>';
    renderPager(elements.actionsPager, 'actions', 1, 1, 0);
    return;
  }

  elements.copilotActionsList.innerHTML = paged.items
    .map(
      (action) => `
        <div class="action-item">
          <strong>${action.summary}</strong>
          <div class="source-meta">
            <span>${action.type}</span>
            <span>Risk: ${action.risk}</span>
            <span>${formatDate(action.createdAt)}</span>
          </div>
          <div class="button-row">
            <button class="btn btn-primary" data-action-control="confirm" data-action-id="${action.id}">Confirm</button>
            <button class="btn" data-action-control="reject" data-action-id="${action.id}">Reject</button>
          </div>
        </div>
      `
    )
    .join('');

  renderPager(elements.actionsPager, 'actions', paged.page, paged.totalPages, paged.total);
}

function renderBriefingSettings() {
  const briefing = currentPreferences().briefing;
  if (!briefing) return;

  elements.briefingTimeInput.value = briefing.schedule?.time || '06:30';
  elements.briefingTimezoneInput.value = briefing.schedule?.timezone || 'Africa/Johannesburg';
  elements.briefingInAppInput.checked = briefing.delivery?.inApp !== false;
  elements.briefingTelegramInput.checked = briefing.delivery?.telegram !== false;
  elements.briefingTelegramPausedInput.checked = briefing.delivery?.telegramPaused === true;
}

function renderPreferences() {
  const prefs = currentPreferences();

  elements.watchTopicsList.innerHTML = prefs.watchlist.topics.length
    ? prefs.watchlist.topics
        .map(
          (topic, index) => `<button class="chip" data-kind="topic" data-index="${index}">${topic}<span>×</span></button>`
        )
        .join('')
    : '<p class="hint">No topics saved yet.</p>';

  elements.watchChannelsList.innerHTML = prefs.watchlist.channels.length
    ? prefs.watchlist.channels
        .map(
          (channel, index) =>
            `<button class="chip" data-kind="channel" data-index="${index}">${channel.label}${
              channel.id ? ` <small>${channel.id}</small>` : ''
            }<span>×</span></button>`
        )
        .join('')
    : '<p class="hint">No channels saved yet.</p>';

  elements.templateSelect.innerHTML = prefs.templates
    .map(
      (template) =>
        `<option value="${template.id}" ${template.id === state.editingTemplateId ? 'selected' : ''}>${template.name}</option>`
    )
    .join('');

  elements.alertTemplateSelect.innerHTML = prefs.templates
    .map(
      (template) =>
        `<option value="${template.id}" ${template.id === prefs.activeTemplateId ? 'selected' : ''}>${template.name}${
          template.id === prefs.activeTemplateId ? ' (active)' : ''
        }</option>`
    )
    .join('');

  if (!state.editingTemplateId) {
    state.editingTemplateId = prefs.activeTemplateId || prefs.templates[0]?.id || null;
  }

  const template = prefs.templates.find((entry) => entry.id === state.editingTemplateId) || prefs.templates[0];
  if (template) {
    elements.templateSelect.value = template.id;
    elements.templateNameInput.value = template.name;
    elements.templateBodyInput.value = template.body;
    state.editingTemplateId = template.id;
  }

  if (elements.cardsPerPageInput) {
    const pageSize = cardsPerPage();
    const hasOption = [...elements.cardsPerPageInput.options].some((option) => Number(option.value) === pageSize);
    if (!hasOption) {
      const option = document.createElement('option');
      option.value = String(pageSize);
      option.textContent = String(pageSize);
      elements.cardsPerPageInput.appendChild(option);
    }
    elements.cardsPerPageInput.value = String(pageSize);
  }

  renderRssSources();
  renderBriefingSettings();
}

function render() {
  const data = state.dashboard;
  if (!data) return;

  const query = state.query.trim().toLowerCase();

  const signals = data.signals.filter((item) => {
    if (!query) return true;
    return [item.title, item.summary, item.topic, item.source].some(matchesQuery);
  });

  const searches = data.googleSearches.filter((item) => {
    if (!query) return true;
    const related = (item.relatedNews || []).map((news) => news.title).join(' ');
    return [item.query, item.approxTraffic, related].some(matchesQuery);
  });

  const videos = data.videos.filter((item) => {
    if (!query) return true;
    return [item.title, item.channel].some(matchesQuery);
  });

  const opportunities = data.challenges.opportunities.filter((item) => {
    if (!query) return true;
    return [item.category, item.challenge, item.suggestedSolution, item.monetization].some(matchesQuery);
  });

  const evidence = data.challenges.sampledQuestions.filter((item) => {
    if (!query) return true;
    return [item.title, item.tags.join(' ')].some(matchesQuery);
  });

  const pagedSignals = getPagedCollection(signals, 'signals');
  elements.signalsGrid.innerHTML = pagedSignals.total
    ? pagedSignals.items.map(createSignalCard).join('')
    : emptyCard('No signal matches your filter.');
  renderPager(elements.signalsPager, 'signals', pagedSignals.page, pagedSignals.totalPages, pagedSignals.total);

  const pagedSearches = getPagedCollection(searches, 'searches');
  elements.searchesGrid.innerHTML = pagedSearches.total
    ? pagedSearches.items.map(createSearchCard).join('')
    : emptyCard('No Google search trend matches your filter.');
  renderPager(elements.searchesPager, 'searches', pagedSearches.page, pagedSearches.totalPages, pagedSearches.total);

  const pagedVideos = getPagedCollection(videos, 'videos');
  elements.videosGrid.innerHTML = pagedVideos.total
    ? pagedVideos.items.map(createVideoCard).join('')
    : emptyCard('No video matches your filter.');
  renderPager(elements.videosPager, 'videos', pagedVideos.page, pagedVideos.totalPages, pagedVideos.total);

  const pagedChallenges = getPagedCollection(opportunities, 'challenges');
  elements.challengesGrid.innerHTML = pagedChallenges.total
    ? pagedChallenges.items.map(createChallengeCard).join('')
    : emptyCard('No challenge opportunity matches your filter.');
  renderPager(
    elements.challengesPager,
    'challenges',
    pagedChallenges.page,
    pagedChallenges.totalPages,
    pagedChallenges.total
  );

  const pagedEvidence = getPagedCollection(evidence, 'evidence');
  elements.evidenceGrid.innerHTML = pagedEvidence.total
    ? pagedEvidence.items.map(createEvidenceCard).join('')
    : emptyCard('No challenge evidence matches your filter.');
  renderPager(elements.evidencePager, 'evidence', pagedEvidence.page, pagedEvidence.totalPages, pagedEvidence.total);

  elements.stats.innerHTML = [
    { label: 'Signals', value: data.signals.length },
    { label: 'Google Trends', value: data.googleSearches.length },
    { label: 'Videos', value: data.videos.length },
    { label: 'Opportunities', value: data.challenges.opportunities.length },
    { label: 'Pending New', value: data.pendingNew.total }
  ]
    .map((item) => `<div class="stat"><strong>${item.value}</strong><span>${item.label}</span></div>`)
    .join('');

  elements.sourcesList.innerHTML = Object.entries(data.references)
    .map(([key, source]) => `<li><strong>${key}:</strong> ${source}</li>`)
    .join('');

  elements.timestamp.textContent = `Last refresh: ${formatDate(data.generatedAt)}`;
  elements.sparkText.textContent = data.creative?.sparkLine || randomSparkFromChallenges();

  const paused = currentPreferences().briefing?.delivery?.telegramPaused === true;
  elements.telegramStatus.textContent = data.telegramConfigured
    ? paused
      ? 'Telegram configured (paused)'
      : 'Telegram configured'
    : 'Telegram not configured (set .env values)';
  elements.telegramStatus.className = `pill ${data.telegramConfigured ? (paused ? 'warn' : 'good') : 'warn'}`;

  renderPulse();
  renderSourceMix();
  renderPreferences();
  renderActions();
}

async function persistPreferences(statusMessage = 'Preferences saved.') {
  const response = await fetch('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentPreferences())
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Failed saving preferences');
  }

  state.preferences = payload.preferences;
  setStatus(elements.studioStatus, statusMessage, 'good');
  renderPreferences();
}

async function loadActions() {
  try {
    const response = await fetch('/api/copilot/actions');
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Failed loading actions');
    }

    state.copilotActions = payload.pending || [];
    renderActions();
  } catch (error) {
    setStatus(elements.copilotStatus, `Failed loading action queue: ${error.message}`, 'warn');
  }
}

async function loadDashboard() {
  elements.refreshBtn.disabled = true;
  elements.refreshBtn.textContent = 'Refreshing...';
  const loading = document.getElementById('loadingTemplate').content.firstElementChild.outerHTML;

  elements.signalsGrid.innerHTML = loading;
  elements.searchesGrid.innerHTML = loading;
  elements.videosGrid.innerHTML = loading;
  elements.challengesGrid.innerHTML = loading;
  elements.evidenceGrid.innerHTML = loading;

  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) {
      throw new Error('Dashboard request failed');
    }

    state.dashboard = await response.json();
    state.preferences = state.dashboard.preferences;
    state.editingTemplateId = state.preferences.activeTemplateId;
    render();
    await loadActions();
  } catch (error) {
    const message = `<div class="card feed-card"><p>Failed loading dashboard: ${error.message}</p></div>`;
    elements.signalsGrid.innerHTML = message;
    elements.searchesGrid.innerHTML = message;
    elements.videosGrid.innerHTML = message;
    elements.challengesGrid.innerHTML = message;
    elements.evidenceGrid.innerHTML = message;
  } finally {
    elements.refreshBtn.disabled = false;
    elements.refreshBtn.textContent = 'Refresh Live Signals';
  }
}

async function sendDigest(mode = 'new') {
  const templateIdValue = elements.alertTemplateSelect.value;
  const btn = mode === 'full' ? elements.sendFullDigestBtn : elements.sendDigestBtn;
  btn.disabled = true;

  try {
    const response = await fetch('/api/notify/telegram/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, templateId: templateIdValue })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed sending digest');

    if (data.sent) {
      setStatus(elements.alertStatus, `Alert sent (${data.counts.total} items).`, 'good');
      await loadDashboard();
    } else if (data.generated) {
      setStatus(elements.alertStatus, `Digest generated in-app (${data.counts.total} items).`, 'good');
      await loadDashboard();
    } else {
      setStatus(elements.alertStatus, data.reason || 'No new items to send.');
    }
  } catch (error) {
    setStatus(elements.alertStatus, `Alert failed: ${error.message}`, 'warn');
  } finally {
    btn.disabled = false;
  }
}

async function previewDigest() {
  try {
    const response = await fetch('/api/notify/telegram/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'new', templateId: elements.alertTemplateSelect.value })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed generating preview');

    elements.previewOutput.textContent = data.text;
    setStatus(elements.alertStatus, `Preview generated (${data.counts.total} items).`, 'good');
  } catch (error) {
    setStatus(elements.alertStatus, `Preview failed: ${error.message}`, 'warn');
  }
}

async function acknowledgeFeed() {
  try {
    const response = await fetch('/api/alerts/acknowledge', { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed acknowledging');
    setStatus(elements.alertStatus, data.message, 'good');
    await loadDashboard();
  } catch (error) {
    setStatus(elements.alertStatus, `Acknowledge failed: ${error.message}`, 'warn');
  }
}

async function sendCustomMessage() {
  const message = elements.customMessage.value.trim();
  if (!message) {
    setStatus(elements.alertStatus, 'Write a custom message first.', 'warn');
    return;
  }

  elements.sendMessageBtn.disabled = true;
  elements.sendMessageBtn.textContent = 'Sending...';

  try {
    const response = await fetch('/api/notify/telegram/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed sending message');

    elements.customMessage.value = '';
    setStatus(elements.alertStatus, 'Custom message sent.', 'good');
  } catch (error) {
    setStatus(elements.alertStatus, `Message failed: ${error.message}`, 'warn');
  } finally {
    elements.sendMessageBtn.disabled = false;
    elements.sendMessageBtn.textContent = 'Send Message';
  }
}

function addTopic() {
  const value = elements.topicInput.value.trim().toLowerCase();
  if (!value) return;

  const prefs = currentPreferences();
  if (!prefs.watchlist.topics.includes(value)) {
    prefs.watchlist.topics.push(value);
  }

  elements.topicInput.value = '';
  persistPreferences('Topic added.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function addChannel() {
  const label = elements.channelLabelInput.value.trim();
  const id = elements.channelIdInput.value.trim();

  if (!label) {
    setStatus(elements.studioStatus, 'Channel label is required.', 'warn');
    return;
  }

  const prefs = currentPreferences();
  prefs.watchlist.channels.push({ label, id });
  elements.channelLabelInput.value = '';
  elements.channelIdInput.value = '';

  persistPreferences('Channel saved.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function removeChip(event) {
  const btn = event.target.closest('.chip');
  if (!btn) return;

  const kind = btn.dataset.kind;
  const index = Number(btn.dataset.index);
  const prefs = currentPreferences();

  if (kind === 'topic') {
    prefs.watchlist.topics.splice(index, 1);
  }

  if (kind === 'channel') {
    prefs.watchlist.channels.splice(index, 1);
  }

  persistPreferences('Watchlist updated.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function selectTemplateForEditing() {
  state.editingTemplateId = elements.templateSelect.value;
  const template = currentPreferences().templates.find((entry) => entry.id === state.editingTemplateId);
  if (!template) return;

  elements.templateNameInput.value = template.name;
  elements.templateBodyInput.value = template.body;
}

function newTemplate() {
  state.editingTemplateId = null;
  elements.templateNameInput.value = '';
  elements.templateBodyInput.value = defaultTemplateBody;
}

function saveTemplate() {
  const name = elements.templateNameInput.value.trim();
  const body = elements.templateBodyInput.value.trim();

  if (!body) {
    setStatus(elements.studioStatus, 'Template body cannot be empty.', 'warn');
    return;
  }

  const prefs = currentPreferences();
  const resolvedName = name || 'Untitled Template';

  if (state.editingTemplateId) {
    const template = prefs.templates.find((entry) => entry.id === state.editingTemplateId);
    if (template) {
      template.name = resolvedName;
      template.body = body;
    }
  } else {
    const id = templateId();
    prefs.templates.push({ id, name: resolvedName, body });
    state.editingTemplateId = id;
  }

  persistPreferences('Template saved.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function deleteTemplate() {
  const prefs = currentPreferences();
  const id = elements.templateSelect.value;

  if (prefs.templates.length <= 1) {
    setStatus(elements.studioStatus, 'At least one template is required.', 'warn');
    return;
  }

  prefs.templates = prefs.templates.filter((entry) => entry.id !== id);
  if (prefs.activeTemplateId === id) {
    prefs.activeTemplateId = prefs.templates[0].id;
  }
  state.editingTemplateId = prefs.templates[0].id;

  persistPreferences('Template deleted.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function activateTemplate() {
  const prefs = currentPreferences();
  prefs.activeTemplateId = elements.templateSelect.value;

  persistPreferences('Template activated.').catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

async function askCopilot() {
  const message = elements.copilotInput.value.trim();
  if (!message) {
    setStatus(elements.copilotStatus, 'Type a prompt first.', 'warn');
    return;
  }

  elements.copilotAskBtn.disabled = true;
  elements.copilotAskBtn.textContent = 'Thinking...';

  try {
    const response = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Copilot request failed');
    }

    elements.copilotOutput.textContent = data.reply;
    if (data.needsConfirmation) {
      setStatus(elements.copilotStatus, 'Action(s) queued. Confirm or reject below.', 'good');
    } else {
      setStatus(elements.copilotStatus, 'Copilot response ready.', 'good');
    }

    elements.copilotInput.value = '';
    await loadActions();
    await loadDashboard();
  } catch (error) {
    setStatus(elements.copilotStatus, `Copilot failed: ${error.message}`, 'warn');
  } finally {
    elements.copilotAskBtn.disabled = false;
    elements.copilotAskBtn.textContent = 'Ask Copilot';
  }
}

async function confirmOrRejectAction(event) {
  const button = event.target.closest('button[data-action-control]');
  if (!button) return;

  const actionId = button.dataset.actionId;
  const control = button.dataset.actionControl;
  const endpoint = control === 'confirm' ? 'confirm' : 'reject';

  button.disabled = true;

  try {
    const response = await fetch(`/api/copilot/actions/${actionId}/${endpoint}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Failed to ${endpoint} action`);
    }

    setStatus(elements.copilotStatus, `Action ${endpoint}ed.`, 'good');
    await loadActions();
    await loadDashboard();
  } catch (error) {
    setStatus(elements.copilotStatus, `Action failed: ${error.message}`, 'warn');
  } finally {
    button.disabled = false;
  }
}

async function queuePresetApply(presetKey) {
  try {
    const response = await fetch('/api/sources/presets/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetKey })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed queueing preset action');
    }

    setStatus(elements.copilotStatus, 'Preset action queued. Confirm it in Pending Confirmations.', 'good');
    await loadActions();
  } catch (error) {
    setStatus(elements.copilotStatus, `Preset queue failed: ${error.message}`, 'warn');
  }
}

async function queueAddRssSource() {
  const name = elements.rssNameInput.value.trim();
  const url = elements.rssUrlInput.value.trim();
  const category = elements.rssCategoryInput.value.trim() || 'General';

  if (!name || !url) {
    setStatus(elements.copilotStatus, 'Source name and RSS URL are required.', 'warn');
    return;
  }

  try {
    const response = await fetch('/api/sources/rss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, category, enabled: true })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed queueing source');
    }

    elements.rssNameInput.value = '';
    elements.rssUrlInput.value = '';
    elements.rssCategoryInput.value = '';

    setStatus(elements.copilotStatus, 'Source add queued. Confirm it in Pending Confirmations.', 'good');
    await loadActions();
  } catch (error) {
    setStatus(elements.copilotStatus, `Queue source failed: ${error.message}`, 'warn');
  }
}

async function handleRssSourceAction(event) {
  const button = event.target.closest('button[data-source-action]');
  if (!button) return;

  const sourceId = button.dataset.sourceId;
  const action = button.dataset.sourceAction;

  try {
    if (action === 'toggle') {
      const enabled = button.dataset.enabled !== 'true';
      const response = await fetch(`/api/sources/rss/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed queueing toggle');
      setStatus(elements.copilotStatus, 'Source toggle queued. Confirm it in Pending Confirmations.', 'good');
    }

    if (action === 'remove') {
      const response = await fetch(`/api/sources/rss/${sourceId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Failed queueing remove');
      setStatus(elements.copilotStatus, 'Source removal queued. Confirm it in Pending Confirmations.', 'good');
    }

    await loadActions();
  } catch (error) {
    setStatus(elements.copilotStatus, `Source action failed: ${error.message}`, 'warn');
  }
}

async function queueBriefingSettingsUpdate() {
  const payload = {
    schedule: {
      time: elements.briefingTimeInput.value,
      timezone: elements.briefingTimezoneInput.value.trim()
    },
    delivery: {
      inApp: elements.briefingInAppInput.checked,
      telegram: elements.briefingTelegramInput.checked,
      telegramPaused: elements.briefingTelegramPausedInput.checked
    }
  };

  try {
    const response = await fetch('/api/copilot/briefings/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed queueing briefing settings update');
    }

    setStatus(elements.copilotStatus, 'Briefing settings update queued. Confirm it in Pending Confirmations.', 'good');
    await loadActions();
  } catch (error) {
    setStatus(elements.copilotStatus, `Queue settings failed: ${error.message}`, 'warn');
  }
}

async function generateBriefingNow() {
  elements.generateBriefingBtn.disabled = true;
  elements.generateBriefingBtn.textContent = 'Generating...';

  try {
    const response = await fetch('/api/copilot/briefings/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'new', templateId: currentPreferences().activeTemplateId })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed generating briefing');
    }

    if (data.needsConfirmationPrompt) {
      const shouldContinue = window.confirm(
        `${data.message}\n\nPress OK to continue generating in-app (default), or Cancel to stop.`
      );

      const secondResponse = await fetch('/api/copilot/briefings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'new',
          templateId: currentPreferences().activeTemplateId,
          pausedDecision: shouldContinue ? 'continue' : 'cancel'
        })
      });

      const secondData = await secondResponse.json();
      if (!secondResponse.ok || !secondData.ok) {
        throw new Error(secondData.error || 'Follow-up briefing request failed');
      }

      if (secondData.generated) {
        setStatus(
          elements.copilotStatus,
          secondData.sent
            ? `Briefing generated and sent (${secondData.counts.total} items).`
            : `Briefing generated in-app (${secondData.counts.total} items).`,
          'good'
        );
      } else {
        setStatus(elements.copilotStatus, secondData.reason || 'Briefing skipped.', 'warn');
      }
    } else if (data.generated) {
      setStatus(
        elements.copilotStatus,
        data.sent ? `Briefing generated and sent (${data.counts.total} items).` : `Briefing generated in-app (${data.counts.total} items).`,
        'good'
      );
    } else {
      setStatus(elements.copilotStatus, data.reason || 'No briefing generated.', 'warn');
    }

    await loadDashboard();
  } catch (error) {
    setStatus(elements.copilotStatus, `Generate briefing failed: ${error.message}`, 'warn');
  } finally {
    elements.generateBriefingBtn.disabled = false;
    elements.generateBriefingBtn.textContent = 'Generate Briefing Now';
  }
}

function updateCardsPerPage(event) {
  const value = Number(event.target.value);
  if (!Number.isFinite(value)) return;

  const prefs = currentPreferences();
  if (!prefs.settings) prefs.settings = {};
  prefs.settings.cardsPerPage = Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.round(value)));
  resetAllPagination();

  persistPreferences(`Cards per page set to ${prefs.settings.cardsPerPage}.`)
    .then(() => {
      render();
    })
    .catch((error) => setStatus(elements.studioStatus, error.message, 'warn'));
}

function handlePagerClick(event) {
  const button = event.target.closest('button[data-page-key][data-page-value]');
  if (!button) return;

  const key = button.dataset.pageKey;
  const nextPage = Number(button.dataset.pageValue);
  if (!key || Number.isNaN(nextPage)) return;

  state.pagination[key] = Math.max(1, nextPage);

  if (state.dashboard) {
    render();
    return;
  }

  if (key === 'actions') renderActions();
  if (key === 'sources') renderRssSources();
}

function bindTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.tab;
      state.tab = target;
      tabButtons.forEach((value) => value.classList.toggle('active', value === button));
      tabPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === target));
    });
  });
}

function bindEvents() {
  document.addEventListener('click', handlePagerClick);
  elements.refreshBtn.addEventListener('click', loadDashboard);
  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    resetFeedPagination();
    render();
  });
  if (elements.cardsPerPageInput) {
    elements.cardsPerPageInput.addEventListener('change', updateCardsPerPage);
  }

  elements.sendDigestBtn.addEventListener('click', () => sendDigest('new'));
  elements.sendFullDigestBtn.addEventListener('click', () => sendDigest('full'));
  elements.previewDigestBtn.addEventListener('click', previewDigest);
  elements.acknowledgeBtn.addEventListener('click', acknowledgeFeed);
  elements.sendMessageBtn.addEventListener('click', sendCustomMessage);

  elements.addTopicBtn.addEventListener('click', addTopic);
  elements.addChannelBtn.addEventListener('click', addChannel);
  elements.watchTopicsList.addEventListener('click', removeChip);
  elements.watchChannelsList.addEventListener('click', removeChip);

  elements.templateSelect.addEventListener('change', selectTemplateForEditing);
  elements.newTemplateBtn.addEventListener('click', newTemplate);
  elements.saveTemplateBtn.addEventListener('click', saveTemplate);
  elements.deleteTemplateBtn.addEventListener('click', deleteTemplate);
  elements.activateTemplateBtn.addEventListener('click', activateTemplate);

  elements.sparkBtn.addEventListener('click', () => {
    elements.sparkText.textContent = randomSparkFromChallenges();
  });

  elements.copilotAskBtn.addEventListener('click', askCopilot);
  elements.refreshActionsBtn.addEventListener('click', loadActions);
  elements.copilotActionsList.addEventListener('click', confirmOrRejectAction);

  elements.applyBusinessMakerPresetBtn.addEventListener('click', () => queuePresetApply('business-maker'));
  elements.applyTechPresetBtn.addEventListener('click', () => queuePresetApply('technology-core'));
  elements.addRssBtn.addEventListener('click', queueAddRssSource);
  elements.rssSourcesList.addEventListener('click', handleRssSourceAction);

  elements.saveBriefingSettingsBtn.addEventListener('click', queueBriefingSettingsUpdate);
  elements.generateBriefingBtn.addEventListener('click', generateBriefingNow);
}

function init() {
  bindTabs();
  bindEvents();
  loadDashboard();
}

init();
