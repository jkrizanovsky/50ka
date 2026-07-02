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

const LEGACY_STATIC_FIELDS = [
  {
    fieldKey: 'face-choice',
    label: 'Koho máš raději?',
    sortOrder: 0,
    getValue: (response) => response.choice || 'Nezadáno',
  },
  {
    fieldKey: 'attendance',
    label: 'Účast 12.9.',
    sortOrder: 1,
    getValue: (response) => response.available || 'Uvidíme',
  },
  {
    fieldKey: 'contact-name',
    label: 'Jméno',
    sortOrder: 9000,
    getValue: (response) => response.name || 'Neuvedeno',
  },
  {
    fieldKey: 'contact-email',
    label: 'Email',
    sortOrder: 9001,
    getValue: (response) => response.email || 'Neuvedeno',
  },
  {
    fieldKey: 'contact-phone',
    label: 'Telefon',
    sortOrder: 9002,
    getValue: (response) => response.phone || 'Neuvedeno',
  },
];

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

function formatAvailable(available) {
  const map = {
    ano: 'Ano',
    ne: 'Ne',
    uvidime: 'Uvidíme',
  };

  return map[available] || safeText(available, 'Uvidíme');
}

function normalizeAnswerFields(answerFields, row, answers) {
  if (Array.isArray(answerFields) && answerFields.length) {
    return answerFields
      .filter((field) => field && typeof field === 'object' && field.fieldKey && field.label)
      .map((field) => ({
        fieldKey: String(field.fieldKey),
        label: safeText(field.label, 'Položka'),
        value: safeText(field.value, 'bez odpovědi'),
        sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : 9999,
      }));
  }

  const legacyFields = LEGACY_STATIC_FIELDS.map((field) => ({
    fieldKey: field.fieldKey,
    label: field.label,
    value: safeText(field.getValue(row), 'bez odpovědi'),
    sortOrder: field.sortOrder,
  }));
  const legacyAnswers = answers.map((answer) => ({
    fieldKey: `step-${answer.stepId}`,
    label: safeText(answer.question, `Otázka ${answer.stepId}`),
    value: safeText(answer.answer, 'bez odpovědi'),
    sortOrder: answer.stepId,
  }));

  return [...legacyFields, ...legacyAnswers];
}

function normalizeResponses(rows) {
  return rows.map((row) => {
    const answers = parseAnswers(row.answers_json);
    const normalizedRow = {
      ...row,
      name: safeText(row.name, 'Neuvedeno'),
      email: safeText(row.email, 'Neuvedeno'),
      phone: safeText(row.phone, 'Neuvedeno'),
      choice: formatChoice(row.choice),
      available: formatAvailable(row.available),
      answers,
    };

    return {
      ...normalizedRow,
      answerFields: normalizeAnswerFields(row.answer_fields, normalizedRow, answers),
    };
  });
}

function buildFilterFields(responses) {
  const fields = new Map();

  responses.forEach((response) => {
    response.answerFields.forEach((field) => {
      if (fields.has(field.fieldKey)) return;
      fields.set(field.fieldKey, {
        key: field.fieldKey,
        label: field.label,
        sortOrder: field.sortOrder,
        getValue: (item) => {
          const found = item.answerFields.find((entry) => entry.fieldKey === field.fieldKey);
          return safeText(found?.value, 'bez odpovědi');
        },
      });
    });
  });

  return [...fields.values()].sort((a, b) => {
    return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'cs');
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

function getResponseTimestamp(response) {
  return safeText(response.timestamp ?? response.created_at, '—');
}

function createResponseCard(response) {
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
    createMetaRow('Odesláno', getResponseTimestamp(response)),
    createMetaRow('Volba obličeje', response.choice),
    createMetaRow('Účast 12.9.', response.available),
  );

  const answersList = document.createElement('ul');
  answersList.className = 'response-answers';
  response.answers.forEach((answer) => {
    answersList.appendChild(createAnswerRow(answer.question, answer.answer));
  });

  card.append(title, meta, answersList);
  return card;
}

function renderResponseDetail(detailEl, response, emptyMessage = 'Klikni na jméno v seznamu a zobrazí se detail odpovědi.') {
  detailEl.replaceChildren();

  if (!response) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = emptyMessage;
    detailEl.appendChild(empty);
    return;
  }

  detailEl.appendChild(createResponseCard(response));
}

function renderResponsesList(listEl, detailEl, countEl, responses) {
  listEl.replaceChildren();
  countEl.textContent = `${responses.length} odpovědí`;
  renderResponseDetail(detailEl, null);

  if (!responses.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-empty';
    empty.textContent = 'Zatím tu nejsou žádné odpovědi.';
    listEl.appendChild(empty);
    renderResponseDetail(detailEl, null, 'Zatím tu nejsou žádné odpovědi.');
    return;
  }

  let activeButton = null;

  responses.forEach((response) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'response-list-item';

    const title = document.createElement('span');
    title.className = 'response-list-item-title';
    title.textContent = response.name;

    const meta = document.createElement('span');
    meta.className = 'response-list-item-meta';
    meta.textContent = getResponseTimestamp(response);

    button.append(title, meta);
    button.addEventListener('click', () => {
      if (activeButton) {
        activeButton.classList.remove('active');
        activeButton.setAttribute('aria-pressed', 'false');
      }
      button.classList.add('active');
      button.setAttribute('aria-pressed', 'true');
      activeButton = button;
      renderResponseDetail(detailEl, response);
    });

    button.setAttribute('aria-pressed', 'false');
    listEl.appendChild(button);
  });
}

function initAdminPage() {
  const selectEl = document.getElementById('chart-field-select');
  const canvas = document.getElementById('answers-chart');
  const legendEl = document.getElementById('chart-legend');
  const listEl = document.getElementById('responses-list');
  const detailEl = document.getElementById('response-detail');
  const countEl = document.getElementById('responses-count');

  if (!selectEl || !canvas || !legendEl || !listEl || !detailEl || !countEl) return;

  fetch('https://50ka-backend-production.up.railway.app/api/responses')
    .then((response) => {
      if (!response.ok) throw new Error('Nepodařilo se načíst odpovědi.');
      return response.json();
    })
    .then((rows) => {
      const responses = normalizeResponses(rows);
      const fields = buildFilterFields(responses);

      renderResponsesList(listEl, detailEl, countEl, responses);

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
      renderResponseDetail(detailEl, null, empty.textContent);

      LEGACY_STATIC_FIELDS.forEach((field) => {
        const option = document.createElement('option');
        option.value = field.fieldKey;
        option.textContent = field.label;
        selectEl.appendChild(option);
      });

      const renderChartForField = () => {
        drawPieChart(canvas, []);
        renderLegend(legendEl, []);
      };
      if (LEGACY_STATIC_FIELDS.length) {
        selectEl.value = LEGACY_STATIC_FIELDS[0].fieldKey;
        selectEl.addEventListener('change', renderChartForField);
      }
      renderChartForField();
    });
}

document.addEventListener('DOMContentLoaded', initAdminPage);
