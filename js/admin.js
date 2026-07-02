const CHART_COLORS = [
  '#ff6384',
  '#36a2eb',
  '#ffce56',
  '#4bc0c0',
  '#9966ff',
  '#ff9f40',
  '#8dd17e',
  '#e76f51',
  '#2a9d8f',
  '#577590',
];

const STATIC_FIELDS = [
  {
    key: 'faceChoice',
    label: 'Koho máš raději?',
    getValue: (response) => response.choice || 'nezadano',
  },
];

const QUESTION_LABELS = {
  1: 'Účast 12.9.',
  3: 'Přijdeš',
  4: 'Čas příchodu',
  5: 'Počet lidí',
  6: 'Děti',
  7: 'Jídlo',
  8: 'Typ jídla',
  9: 'Pití',
  10: 'Hudba',
  11: 'Přespání',
  12: 'Odvoz',
  13: 'Snídaně',
  98: 'Podpora dobra',
};

function safeText(value, fallback = '—') {
  if (value == null) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function parseAnswers(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === 'object');
  } catch {
    return [];
  }
}

function formatChoice(choice) {
  const map = {
    lenku: 'Lenku',
    petra: 'Petra',
    nezadano: 'Nezadáno',
  };

  return map[choice] || safeText(choice, 'Nezadáno');
}

function getChartLabelForAnswer(answer) {
  if (!answer || !Number.isInteger(answer.stepId)) return safeText(answer && answer.question, 'Otázka');
  return QUESTION_LABELS[answer.stepId] || safeText(answer.question, `Otázka ${answer.stepId}`);
}

function normalizeResponses(rows) {
  return rows.map((row) => ({
    ...row,
    name: safeText(row.name, 'Neuvedeno'),
    email: safeText(row.email, 'Neuvedeno'),
    phone: safeText(row.phone, 'Neuvedeno'),
    choice: formatChoice(row.choice),
    answers: parseAnswers(row.answers_json),
  }));
}

function buildDynamicFields(responses) {
  const fields = new Map();

  responses.forEach((response) => {
    response.answers.forEach((answer) => {
      if (!Number.isInteger(answer.stepId)) return;
      const key = `step-${answer.stepId}`;
      if (!fields.has(key)) {
        fields.set(key, {
          key,
          label: getChartLabelForAnswer(answer),
          getValue: (item) => {
            const found = item.answers.find((entry) => entry.stepId === answer.stepId);
            return safeText(found?.answer, 'bez odpovědi');
          },
        });
      }
    });
  });

  return [...fields.values()].sort((a, b) => {
    const aNumber = Number(a.key.replace('step-', ''));
    const bNumber = Number(b.key.replace('step-', ''));
    return aNumber - bNumber;
  });
}

function countValues(responses, field) {
  const counts = new Map();

  responses.forEach((response) => {
    const value = safeText(field.getValue(response), 'bez odpovědi');
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'cs'));
}

function drawPieChart(canvas, dataset) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const radius = Math.min(width, height) * 0.34;
  const centerX = width / 2;
  const centerY = height / 2;
  const total = dataset.reduce((sum, item) => sum + item.count, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (!total) {
    ctx.fillStyle = '#333333';
    ctx.font = '600 20px Montserrat';
    ctx.textAlign = 'center';
    ctx.fillText('Zatím žádná data', centerX, centerY);
    return;
  }

  let startAngle = -Math.PI / 2;
  dataset.forEach((item, index) => {
    const sliceAngle = (item.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.fillStyle = '#111111';
  ctx.font = '600 16px Montserrat';
  ctx.textAlign = 'center';
  ctx.fillText('Celkem', centerX, centerY - 10);
  ctx.font = '700 32px Anton';
  ctx.fillText(String(total), centerX, centerY + 26);
}

function renderLegend(legendEl, dataset) {
  legendEl.replaceChildren();
  const total = dataset.reduce((sum, item) => sum + item.count, 0);

  dataset.forEach((item, index) => {
    const percentage = total ? Math.round((item.count / total) * 100) : 0;
    const li = document.createElement('li');
    li.className = 'chart-legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'chart-legend-swatch';
    swatch.style.backgroundColor = CHART_COLORS[index % CHART_COLORS.length];

    const label = document.createElement('span');
    label.className = 'chart-legend-label';
    label.textContent = `${item.label} — ${item.count} (${percentage} %)`;

    li.append(swatch, label);
    legendEl.appendChild(li);
  });
}

function createMetaRow(label, value) {
  const row = document.createElement('p');
  row.className = 'response-meta-row';
  const strong = document.createElement('strong');
  strong.textContent = `${label}:`;
  row.append(strong, ` ${safeText(value)}`);
  return row;
}

function createAnswerRow(label, value) {
  const item = document.createElement('li');
  item.className = 'response-answer-item';

  const question = document.createElement('span');
  question.className = 'response-answer-question';
  question.textContent = label;

  const answer = document.createElement('span');
  answer.className = 'response-answer-value';
  answer.textContent = safeText(value);

  item.append(question, answer);
  return item;
}

function renderResponsesList(listEl, countEl, responses) {
  listEl.replaceChildren();
  countEl.textContent = `${responses.length} odpovědí`;

  if (!responses.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'Zatím tu nejsou žádné odpovědi.';
    listEl.appendChild(empty);
    return;
  }

  responses.forEach((response) => {
    const card = document.createElement('article');
    card.className = 'response-card';

    const title = document.createElement('h3');
    title.className = 'response-card-title';
    title.textContent = response.name;

    const meta = document.createElement('div');
    meta.className = 'response-meta';
    meta.append(
      createMetaRow('Email', response.email),
      createMetaRow('Telefon', response.phone),
      createMetaRow('Odesláno', response.timestamp || response.created_at || '—'),
      createMetaRow('Volba obličeje', response.choice),
    );

    const answersList = document.createElement('ul');
    answersList.className = 'response-answers';
    response.answers.forEach((answer) => {
      answersList.appendChild(createAnswerRow(answer.question, answer.answer));
    });

    card.append(title, meta, answersList);
    listEl.appendChild(card);
  });
}

function initAdminPage() {
  const selectEl = document.getElementById('chart-field-select');
  const canvas = document.getElementById('answers-chart');
  const legendEl = document.getElementById('chart-legend');
  const listEl = document.getElementById('responses-list');
  const countEl = document.getElementById('responses-count');

  if (!selectEl || !canvas || !legendEl || !listEl || !countEl) return;

  fetch('/api/responses')
    .then((response) => {
      if (!response.ok) throw new Error('Nepodařilo se načíst odpovědi.');
      return response.json();
    })
    .then((rows) => {
      const responses = normalizeResponses(rows);
      const dynamicFields = buildDynamicFields(responses);
      const fields = [...STATIC_FIELDS, ...dynamicFields];

      renderResponsesList(listEl, countEl, responses);

      if (!fields.length) {
        drawPieChart(canvas, []);
        return;
      }

      fields.forEach((field) => {
        const option = document.createElement('option');
        option.value = field.key;
        option.textContent = field.label;
        selectEl.appendChild(option);
      });

      const renderChartForField = () => {
        const activeField = fields.find((field) => field.key === selectEl.value) || fields[0];
        const dataset = countValues(responses, activeField);
        drawPieChart(canvas, dataset);
        renderLegend(legendEl, dataset);
      };

      selectEl.value = fields[0].key;
      selectEl.addEventListener('change', renderChartForField);
      renderChartForField();
    })
    .catch((error) => {
      countEl.textContent = '0 odpovědí';
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = safeText(error.message, 'Nepodařilo se načíst odpovědi.');
      listEl.replaceChildren(empty);

      STATIC_FIELDS.forEach((field) => {
        const option = document.createElement('option');
        option.value = field.key;
        option.textContent = field.label;
        selectEl.appendChild(option);
      });

      const renderChartForField = () => {
        drawPieChart(canvas, []);
        renderLegend(legendEl, []);
      };
      if (STATIC_FIELDS.length) {
        selectEl.value = STATIC_FIELDS[0].key;
        selectEl.addEventListener('change', renderChartForField);
      }
      renderChartForField();
    });
}

document.addEventListener('DOMContentLoaded', initAdminPage);
