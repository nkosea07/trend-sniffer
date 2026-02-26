const state = {
  dashboard: null,
  tab: 'signals',
  query: ''
};

const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  searchInput: document.getElementById('searchInput'),
  stats: document.getElementById('stats'),
  signalsGrid: document.getElementById('signalsGrid'),
  searchesGrid: document.getElementById('searchesGrid'),
  videosGrid: document.getElementById('videosGrid'),
  challengesGrid: document.getElementById('challengesGrid'),
  evidenceGrid: document.getElementById('evidenceGrid'),
  sourcesList: document.getElementById('sourcesList'),
  timestamp: document.getElementById('timestamp'),
  telegramStatus: document.getElementById('telegramStatus'),
  sendDigestBtn: document.getElementById('sendDigestBtn'),
  customMessage: document.getElementById('customMessage'),
  sendMessageBtn: document.getElementById('sendMessageBtn')
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function matchesQuery(text) {
  return String(text).toLowerCase().includes(state.query.toLowerCase());
}

function emptyCard(message) {
  return `<div class="card feed-card"><p>${message}</p></div>`;
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
    { label: 'Questions Analyzed', value: data.challenges.questionsAnalyzed }
  ]
    .map(
      (item) =>
        `<div class="stat"><strong>${item.value}</strong><span>${item.label}</span></div>`
    )
    .join('');

  elements.sourcesList.innerHTML = Object.entries(data.references)
    .map(([key, source]) => `<li><strong>${key}:</strong> ${source}</li>`)
    .join('');

  elements.timestamp.textContent = `Last refresh: ${formatDate(data.generatedAt)}`;

  elements.telegramStatus.textContent = data.telegramConfigured
    ? 'Telegram configured'
    : 'Telegram not configured (set .env values)';
  elements.telegramStatus.className = `pill ${data.telegramConfigured ? 'good' : 'warn'}`;
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

async function sendDigest() {
  elements.sendDigestBtn.disabled = true;
  elements.sendDigestBtn.textContent = 'Sending...';

  try {
    const response = await fetch('/api/notify/telegram/digest', { method: 'POST' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Failed sending digest');
    alert('Digest sent to Telegram.');
  } catch (error) {
    alert(`Digest failed: ${error.message}`);
  } finally {
    elements.sendDigestBtn.disabled = false;
    elements.sendDigestBtn.textContent = 'Send Digest to Telegram';
  }
}

async function sendCustomMessage() {
  const message = elements.customMessage.value.trim();
  if (!message) {
    alert('Write a message first.');
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
    alert('Message sent to Telegram.');
  } catch (error) {
    alert(`Message failed: ${error.message}`);
  } finally {
    elements.sendMessageBtn.disabled = false;
    elements.sendMessageBtn.textContent = 'Send Message';
  }
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

function init() {
  bindTabs();
  elements.refreshBtn.addEventListener('click', loadDashboard);
  elements.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });
  elements.sendDigestBtn.addEventListener('click', sendDigest);
  elements.sendMessageBtn.addEventListener('click', sendCustomMessage);
  loadDashboard();
}

init();
