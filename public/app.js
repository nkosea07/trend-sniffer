const state = {
  dashboard: null,
  preferences: null,
  tab: 'signals',
  query: '',
  editingTemplateId: null
};

const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  searchInput: document.getElementById('searchInput'),
  stats: document.getElementById('stats'),
  sourceMix: document.getElementById('sourceMix'),
  pendingStrip: document.getElementById('pendingStrip'),
  sparkText: document.getElementById('sparkText'),
  sparkBtn: document.getElementById('sparkBtn'),
  signalsGrid: document.getElementById('signalsGrid'),
  searchesGrid: document.getElementById('searchesGrid'),
  videosGrid: document.getElementById('videosGrid'),
  challengesGrid: document.getElementById('challengesGrid'),
  evidenceGrid: document.getElementById('evidenceGrid'),
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
  studioStatus: document.getElementById('studioStatus')
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
  return state.preferences || {
    watchlist: { topics: [], channels: [] },
    templates: [],
    activeTemplateId: null,
    settings: { sendOnlyNewItems: true }
  };
}

function setStatus(element, message, tone = 'normal') {
  element.textContent = message;
  element.classList.remove('warn', 'good');
  if (tone === 'warn') element.classList.add('warn');
  if (tone === 'good') element.classList.add('good');
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

  elements.signalsGrid.innerHTML = signals.length
    ? signals.map(createSignalCard).join('')
    : emptyCard('No signal matches your filter.');

  elements.searchesGrid.innerHTML = searches.length
    ? searches.map(createSearchCard).join('')
    : emptyCard('No Google search trend matches your filter.');

  elements.videosGrid.innerHTML = videos.length
    ? videos.map(createVideoCard).join('')
    : emptyCard('No video matches your filter.');

  elements.challengesGrid.innerHTML = opportunities.length
    ? opportunities.map(createChallengeCard).join('')
    : emptyCard('No challenge opportunity matches your filter.');

  elements.evidenceGrid.innerHTML = evidence.length
    ? evidence.map(createEvidenceCard).join('')
    : emptyCard('No challenge evidence matches your filter.');

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

  elements.telegramStatus.textContent = data.telegramConfigured
    ? 'Telegram configured'
    : 'Telegram not configured (set .env values)';
  elements.telegramStatus.className = `pill ${data.telegramConfigured ? 'good' : 'warn'}`;

  renderPulse();
  renderSourceMix();
  renderPreferences();
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
  const templateId = elements.alertTemplateSelect.value;
  const btn = mode === 'full' ? elements.sendFullDigestBtn : elements.sendDigestBtn;
  btn.disabled = true;

  try {
    const response = await fetch('/api/notify/telegram/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, templateId })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed sending digest');

    if (data.sent) {
      setStatus(elements.alertStatus, `Alert sent (${data.counts.total} items).`, 'good');
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
  elements.refreshBtn.addEventListener('click', loadDashboard);
  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });

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
}

function init() {
  bindTabs();
  bindEvents();
  loadDashboard();
}

init();
