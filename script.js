const MODEL_NAMES = ['GPT-4o', 'Claude 3.5 Sonnet', 'Gemini 1.5 Pro'];
const CARD_COLORS = ['green', 'orange', 'blue'];
const CONFETTI_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];

// Mock response generator — swap this out once real model APIs are wired up.
const RESPONSE_TEMPLATES = [
  (q) => `Here's a clear, structured breakdown of "${q}": first the core concept, then why it matters, and finally a practical example you can apply right away. I've kept the explanation concise while covering the key nuances so it's easy to act on immediately.`,
  (q) => `Great question. When it comes to "${q}", there are a few important angles worth considering. Let me walk through the reasoning step by step, highlighting the trade-offs and edge cases so you get the complete picture rather than just a surface-level answer.`,
  (q) => `Regarding "${q}" — here's a quick summary followed by supporting details and context, plus a couple of actionable tips you can use right away. I've also flagged one common misconception that's worth avoiding.`,
];

const state = {
  question: '',
  models: [],
  winnerIndex: 0,
  confidence: 0,
};

const screens = document.querySelectorAll('.screen');
function showScreen(id) {
  screens.forEach((s) => s.classList.toggle('screen--active', s.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max).trim() + '…' : text;
}

function buildResponses(question) {
  return MODEL_NAMES.map((name, i) => ({
    name,
    response: RESPONSE_TEMPLATES[i](question),
  }));
}

function showToast(button, message, revertDelay = 1400) {
  const original = button.textContent;
  button.textContent = message;
  setTimeout(() => { button.textContent = original; }, revertDelay);
}

// ---------- Landing ----------
const questionForm = document.getElementById('question-form');
const questionInput = document.getElementById('question-input');

questionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  startComparison(question);
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    questionInput.value = chip.textContent;
    startComparison(chip.textContent);
  });
});

document.querySelector('[data-action="get-started"]').addEventListener('click', () => {
  showScreen('screen-landing');
  questionInput.focus();
});

document.querySelector('[data-action="go-landing"]').addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('screen-landing');
});

// ---------- Loading ----------
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const loadingModelsList = document.getElementById('loading-models');
const loadingSubtitle = document.getElementById('loading-subtitle');

function startComparison(question) {
  state.question = question;
  state.models = buildResponses(question);
  state.winnerIndex = Math.floor(Math.random() * MODEL_NAMES.length);
  state.confidence = 85 + Math.floor(Math.random() * 13);

  loadingSubtitle.textContent = `Getting the best answers from ${MODEL_NAMES.join(', ')}.`;
  loadingModelsList.innerHTML = state.models
    .map(
      (m, i) => `
      <li id="loading-model-${i}">
        <span>${m.name}</span>
        <span class="loading-status">Generating Response…</span>
      </li>`
    )
    .join('');

  showScreen('screen-loading');
  animateProgress();
}

function animateProgress() {
  const duration = 2200;
  const start = performance.now();
  const total = state.models.length;

  function tick(now) {
    const elapsed = now - start;
    const pct = Math.min(100, Math.round((elapsed / duration) * 100));
    progressFill.style.width = pct + '%';
    progressPercent.textContent = pct + '%';

    for (let i = 0; i < total; i++) {
      if (pct >= Math.round(((i + 1) / total) * 100)) {
        const status = document.querySelector(`#loading-model-${i} .loading-status`);
        if (status && !status.classList.contains('loading-status--done')) {
          status.textContent = '✓ Response ready';
          status.classList.add('loading-status--done');
        }
      }
    }

    if (pct < 100) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(populateResults, 400);
    }
  }
  requestAnimationFrame(tick);
}

// ---------- Results ----------
const questionText = document.getElementById('question-text');
const resultsCards = document.getElementById('results-cards');
const resultsTableBody = document.getElementById('results-table-body');
const resultsTable = document.getElementById('results-table');
const verdictSummary = document.getElementById('verdict-summary');
const confidenceFill = document.getElementById('confidence-fill');
const confidencePercent = document.getElementById('confidence-percent');

function populateResults() {
  questionText.textContent = state.question;

  resultsCards.innerHTML = state.models
    .map(
      (m, i) => `
      <div class="result-card">
        <h3>${m.name}</h3>
        <p><span class="response-label">Response:</span><br>${truncate(m.response, 140)}</p>
        <button class="read-more-btn read-more-btn--${CARD_COLORS[i]}" data-action="read-full" data-index="${i}">
          Read full response &rarr;
        </button>
      </div>`
    )
    .join('');

  resultsTableBody.innerHTML = state.models
    .map(
      (m, i) => `
      <tr>
        <td class="model-cell">${m.name}</td>
        <td class="response-cell">${truncate(m.response, 100)}</td>
        <td><button class="read-more-btn read-more-btn--${CARD_COLORS[i]}" data-action="read-full" data-index="${i}">Read full response &rarr;</button></td>
      </tr>`
    )
    .join('');

  const winner = state.models[state.winnerIndex];
  verdictSummary.innerHTML = `<strong>${winner.name}</strong> provides the most actionable, detailed, and well-structured answer.`;

  animateBar(confidenceFill, confidencePercent, state.confidence);

  showScreen('screen-results');
}

function animateBar(fillEl, labelEl, target) {
  fillEl.style.width = '0%';
  labelEl.textContent = '0%';
  requestAnimationFrame(() => {
    fillEl.style.width = target + '%';
  });
  let current = 0;
  const step = () => {
    current += 2;
    if (current >= target) {
      labelEl.textContent = target + '%';
      return;
    }
    labelEl.textContent = current + '%';
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

document.querySelectorAll('[data-action="new-question"]').forEach((btn) =>
  btn.addEventListener('click', () => showScreen('screen-landing'))
);

document.querySelectorAll('.toggle-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('toggle-btn--active'));
    btn.classList.add('toggle-btn--active');
    const isTable = btn.dataset.view === 'table';
    resultsTable.classList.toggle('hidden', !isTable);
    resultsCards.classList.toggle('hidden', isTable);
  });
});

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-action="read-full"]');
  if (!trigger) return;
  const index = Number(trigger.dataset.index);
  openExpanded(index);
});

document.querySelector('[data-action="view-verdict"]').addEventListener('click', () => {
  showVerdict();
});

document.querySelectorAll('[data-action="share"]').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const shareData = { title: 'LLM Router', text: state.question, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast(btn, 'Link copied!');
      }
    } catch (err) {
      /* user cancelled share — no-op */
    }
  })
);

// ---------- Expanded response ----------
const expandedModel = document.getElementById('expanded-model');
const expandedResponse = document.getElementById('expanded-response');
let expandedIndex = 0;

function openExpanded(index) {
  expandedIndex = index;
  const model = state.models[index];
  expandedModel.textContent = `${model.name} — Full Response`;
  expandedResponse.textContent = model.response;
  showScreen('screen-expanded');
}

document.querySelector('[data-action="back-to-results"]').addEventListener('click', () => {
  showScreen('screen-results');
});

document.querySelector('[data-action="copy-response"]').addEventListener('click', async (e) => {
  await navigator.clipboard.writeText(state.models[expandedIndex].response);
  showToast(e.currentTarget, 'Copied!');
});

// ---------- Verdict / Winner ----------
const winnerModel = document.getElementById('winner-model');
const winnerSubtitle = document.getElementById('winner-subtitle');
const winnerConfidenceFill = document.getElementById('winner-confidence-fill');
const winnerConfidencePercent = document.getElementById('winner-confidence-percent');
const confettiContainer = document.getElementById('confetti');

function showVerdict() {
  const winner = state.models[state.winnerIndex];
  winnerModel.textContent = winner.name;
  winnerSubtitle.textContent = `${winner.name} provides the most comprehensive, actionable, and well-structured answer.`;
  animateBar(winnerConfidenceFill, winnerConfidencePercent, state.confidence);
  spawnConfetti();
  showScreen('screen-verdict');
}

function spawnConfetti() {
  confettiContainer.innerHTML = '';
  const pieces = 40;
  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('span');
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = 1.8 + Math.random() * 1.4 + 's';
    piece.style.animationDelay = Math.random() * 0.6 + 's';
    confettiContainer.appendChild(piece);
  }
}

document.querySelector('[data-action="ask-another"]').addEventListener('click', () => {
  questionInput.value = '';
  showScreen('screen-landing');
});
