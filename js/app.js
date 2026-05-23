/**
 * 50ka — Party Invitation Website
 * Main application script
 */

/* ============================================================
   USER IDENTIFICATION
   Each visitor gets a stable UUID stored in localStorage.
   All responses are keyed by this ID when sent to the server.
   ============================================================ */
function getOrCreateUserId() {
  let id = localStorage.getItem('50ka_uid');
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      // Cryptographically-secure fallback via getRandomValues (RFC 4122 v4)
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
      id = [...bytes]
        .map((b, i) => {
          const hex = b.toString(16).padStart(2, '0');
          return [4, 6, 8, 10].includes(i) ? '-' + hex : hex;
        })
        .join('');
    }
    localStorage.setItem('50ka_uid', id);
  }
  return id;
}

const USER_ID = getOrCreateUserId();

/* ============================================================
   CYCLING NUMBER IMAGE
   Cycles between 50 → 25 → 100 every 700 ms
   ============================================================ */
const NUMBER_IMAGES = [
  { src: 'images/50.svg',  alt: '50'  },
  { src: 'images/25.svg',  alt: '25'  },
  { src: 'images/100.svg', alt: '100' },
];

let cycleIndex = 0;

function initCyclingNumber() {
  const img = document.getElementById('cycling-img');
  if (!img) return;

  // Pre-load images so there's no flash on swap
  NUMBER_IMAGES.forEach(({ src }) => {
    const preload = new Image();
    preload.src = src;
  });

  setInterval(() => {
    cycleIndex = (cycleIndex + 1) % NUMBER_IMAGES.length;
    const { src, alt } = NUMBER_IMAGES[cycleIndex];

    img.style.opacity = '0';
    img.style.transition = 'opacity 0.25s ease';

    setTimeout(() => {
      img.src = src;
      img.alt = alt;
      img.style.opacity = '1';
    }, 250);
  }, 700);
}

/* ============================================================
   SCROLL ANIMATION
   The face starts transparent and blurry, then settles
   into its final state as the user scrolls through #zoom-zone.
   When the face is ready the split buttons fade in.
   ============================================================ */
function initScrollZoom() {
  const welcomeSection = document.getElementById('welcome');
  const zoomZone   = document.getElementById('zoom-zone');
  const faceImg    = document.getElementById('face-img');
  const faceOverlay = document.getElementById('face-overlay');
  const scrollCue = document.getElementById('scroll-cue');
  if (!zoomZone || !faceImg) return;
  if (!welcomeSection) {
    console.warn('[face-reveal] Missing #welcome section; using viewport fallback for reveal timing.');
  }

  const startBlurPx = parseFloat(
    getComputedStyle(faceImg).getPropertyValue('--face-start-blur').trim()
  );
  if (!Number.isFinite(startBlurPx)) return;
  const ANIMATION_END_PROGRESS = 0.48;
  const REVEAL_SEED_OPACITY = 0.12;
  const REVEAL_START_THRESHOLD = 0.5;
  const CUE_FADE_THRESHOLD = 0.22;
  const MIN_REVEAL_RANGE = 1;
  const OVERLAY_REVEAL_PROGRESS = 0.995;

  function onScroll() {
    const scrollY    = window.scrollY;
    const zoneTop    = zoomZone.offsetTop;
    const zoneHeight = zoomZone.offsetHeight;
    const vh         = window.innerHeight;
    const welcomeHeight = welcomeSection ? welcomeSection.offsetHeight : vh;

    // Scrollable distance within the zone
    const totalScrollable = zoneHeight - vh;
    const scrollInZone    = scrollY - zoneTop;
    const progress = Math.max(0, Math.min(1, scrollInZone / totalScrollable));
    const revealStartY = zoneTop - (welcomeHeight * REVEAL_START_THRESHOLD);
    const revealEndY = zoneTop + (totalScrollable * ANIMATION_END_PROGRESS);
    const safeRevealEndY = Math.max(revealEndY, revealStartY + MIN_REVEAL_RANGE);
    const revealRange = safeRevealEndY - revealStartY;
    const animationProgress = Math.max(
      0,
      Math.min(1, (scrollY - revealStartY) / revealRange)
    );
    const hasStartedReveal = scrollY >= revealStartY;

    // Far away: blurrier + transparent. Close: sharp + opaque.
    const easedClarity = 1 - Math.pow(1 - animationProgress, 2.4);
    const clarity = hasStartedReveal
      ? REVEAL_SEED_OPACITY + ((1 - REVEAL_SEED_OPACITY) * easedClarity)
      : 0;
    const blurPx = startBlurPx * (1 - clarity);
    faceImg.style.filter = `blur(${blurPx}px)`;
    faceImg.style.opacity = clarity;

    if (scrollCue) {
      const cueFadeProgress = Math.max(0, Math.min(1, scrollY / (welcomeHeight * CUE_FADE_THRESHOLD)));
      scrollCue.style.opacity = 1 - cueFadeProgress;
    }

    // Reveal overlay when the face image reaches its final state
    if (faceOverlay) {
      const shouldShowOverlay = animationProgress >= OVERLAY_REVEAL_PROGRESS;
      faceOverlay.style.opacity = shouldShowOverlay ? 1 : 0;
      if (shouldShowOverlay) {
        faceOverlay.classList.add('visible');
      } else {
        faceOverlay.classList.remove('visible');
      }
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Run once on load in case page is already scrolled
  onScroll();
}

/* ============================================================
   TRANSITION FLASH
   Shows a full-screen message for ~2 s then navigates away.
   ============================================================ */
function showTransitionThenNavigate(mainText, subText, destination) {
  // Note: caller (chooseLeft / chooseRight) already stored the choice in sessionStorage.
  const overlay   = document.getElementById('transition-overlay');
  const mainEl    = document.getElementById('transition-main');
  const subEl     = document.getElementById('transition-sub');
  if (!overlay) return;

  mainEl.textContent = mainText;
  subEl.textContent  = subText;

  // Activate (CSS handles the opacity fade-in)
  overlay.classList.add('active');

  // Navigate after delay
  setTimeout(() => {
    window.location.href = destination;
  }, 2200);
}

/* ============================================================
   BUTTON HANDLERS (called from HTML onclick)
   ============================================================ */
function chooseLeft() {
  // Save choice so availability page can log it with user ID
  sessionStorage.setItem('50ka_choice', 'left');
  showTransitionThenNavigate(
    'GIRLIE PARTYYY',
    'ale neříkej to nahlas aby Petr nežárlil...',
    'availability.html'
  );
}

function chooseRight() {
  sessionStorage.setItem('50ka_choice', 'right');
  showTransitionThenNavigate(
    'Ožerem seee!',
    'ale Lenka je žárlivá, tak víc potichu ju?',
    'availability.html'
  );
}

/* ============================================================
   AVAILABILITY PAGE LOGIC
   ============================================================ */
const formSteps = {
  1: {
    question: 'Máš čas 12.9.2026?',
    options: [
      { text: 'Ano', reaction: 'To zní nadějně...', nextId: 2 },
      { text: 'Ne', reaction: 'To je škoda, ale měl by ses ještě zamyslet', nextId: 2 },
      { text: 'Uvidíme', reaction: 'Snad tě přesvědčíme', nextId: 2 },
    ],
  },
  2: {
    question: 'Koho máš rád?',
    description: 'Koho máš rád? S kým se chceš vidět?',
    options: [
      { text: 'Lenku', reaction: 'Neříkej to tak nahlas, Petr je žárlivej', nextId: 3 },
      { text: 'Petra', reaction: 'Neříkej to tak nahlas, Lenka je žárlivá', nextId: 3 },
      { text: 'Oba', reaction: 'Švédská trojka je fajn', nextId: 3 },
      { text: 'Jen sebe', reaction: 'Zeptej se Csákové, proč tě nikdo nemá rád.', nextId: 3 },
    ],
  },
  3: {
    question: 'Přijdeš?',
    description: 'Chceš se pořádně napít a najíst? A nevadí, že při tom uvidíš kromě L a P i další lidi?',
    options: [
      { text: 'Ano', reaction: 'Rádi tě uvidíme, co tě čeká si přečteš na konci.', nextId: 4 },
      { text: 'Ne', reaction: 'Rozmysli si to, co by tě čekalo si přečteš na konci.', nextId: 98 },
      { text: 'Uvidíme', reaction: 'Rozmysli si to, co by tě čekalo si přečteš na konci.', nextId: 4 },
    ],
  },
  4: {
    question: 'V kolik dorazíš?',
    options: [
      { text: 'odpoledne (14-16)', nextId: 5 },
      { text: 'pozdní odpoledne (16-19)', nextId: 5 },
      { text: 'večer (19-20)', nextId: 5 },
      { text: 'To bude tajemství', nextId: 5 },
    ],
  },
  5: {
    question: 'Kolik vás přijde?',
    options: [
      { text: '1', reaction: 'Tady sám nebudeš!', nextId: 7 },
      { text: '2', reaction: 'Takže poloviční zábava?', nextId: 6 },
      { text: 'více', reaction: 'Dobře, vezměte si montérky...', nextId: 6 },
    ],
  },
  6: {
    question: 'Vezmeš i děti / vezmou tě děti?',
    options: [
      { text: 'Ano jedno', reaction: 'Jedno se ztratí...', nextId: 7 },
      { text: 'Ano dvě nebo víc', reaction: 'Ztratí se všechny...', nextId: 7 },
      { text: 'Vezmu sestřičku z děcáku', reaction: 'Správně, ale musí mít jen 18...', nextId: 7 },
      { text: 'Vyrobíme až na místě', reaction: 'Správně, kondomy na místě nebudou', nextId: 7 },
    ],
  },
  7: {
    question: 'Co jíš?',
    description: 'Abychom věděli co připravit (alergie?)',
    options: [
      { text: 'Jsem masožrout', reaction: 'Něco se pro tebe najde', nextId: 8 },
      { text: 'Jsem kytkožrout', reaction: 'Něco se pro tebe najde', nextId: 8 },
      { text: 'Vše co projde kolem', reaction: 'To abychom něco schovali', nextId: 8 },
      { text: 'Žiju ze vzduchu', reaction: 'Správně, to je vítaný host!', nextId: 9 },
    ],
  },
  8: {
    question: 'Na jakém si pošmákneš?',
    options: [
      { text: 'Vepřo/hovězo', reaction: 'Pořádná prasečina/volovina', nextId: 9 },
      { text: 'Drůbež', reaction: 'Pipka z VIPka', nextId: 9 },
      { text: 'Ryba', reaction: 'Jestli budou brát, raději si přines', nextId: 9 },
      { text: 'cokoli', reaction: 'Něco najdeme', nextId: 9 },
    ],
  },
  9: {
    question: 'Co piješ?',
    options: [
      { text: 'Pivo', reaction: 'Něco se pro tebe najde', nextId: 10 },
      { text: 'Víno', reaction: 'Něco se pro tebe najde', nextId: 10 },
      { text: 'Tvrdé', reaction: 'Něco málo se pro tebe najde', nextId: 10 },
      { text: 'Nealko', reaction: 'Nedoporučuji to, ale něco se najde', nextId: 10 },
    ],
  },
  10: {
    question: 'Co posloucháš?',
    options: [
      { text: 'Rock', reaction: 'Něco se pro tebe najde', nextId: 11 },
      { text: 'Metal', reaction: 'Něco se pro tebe najde', nextId: 11 },
      { text: 'Punk', reaction: 'Něco se pro tebe najde', nextId: 11 },
      { text: 'Dechmetal', reaction: 'Tak to budeš muset donést vlastní fujaru', nextId: 11 },
    ],
  },
  11: {
    question: 'Potřebuješ přespat?',
    options: [
      { text: 'Ve stanu', reaction: 'Na zahradě bude místa dost, stan vlastní', nextId: 12 },
      { text: 'V posteli', reaction: 'Ubytovat se můžeš někde poblíž, odvoz zajistíme', nextId: 12 },
      { text: 'Nepotřebuji', reaction: 'Skvělé, někdo soběstačný', nextId: 12 },
      { text: 'Kdo by chodil spát?', reaction: 'Správně, domů Až ráno', nextId: 12 },
    ],
  },
  12: {
    question: 'Potřebuješ odvoz?',
    description: 'Bude zajištěna kyvadlová doprava do Prachatic a blízkého okolí',
    options: [
      { text: 'Přijedu, zaparkuji u vás a pak odjedu', reaction: 'Hlavně při couvání nezbořit Pražákovi sloupek', nextId: 13 },
      { text: 'Přivezou mne a odvezou - jako medvěda', reaction: 'Přivezou i odvezou - jako medvěda.', nextId: 13 },
      { text: 'Odvoz by bodnul', reaction: 'Neboj, zajistíme (v nějaké rozumné vzdálenosti)', nextId: 97 },
    ],
  },
  13: {
    question: 'Potřebuješ snídani?',
    options: [
      { text: 'Snídaně hromadně', nextId: 97 },
      { text: 'Snídaní až doma', nextId: 97 },
    ],
  },
  97: {
    type: 'info',
    title: 'Hlavní instrukce',
    content: `
      <strong>Kde:</strong> Kulturák Běleč<br>
      Běleč 66, 383 01 Těšovice - Běleč, Jihočeský kraj, Česko;<br>
      <a href="https://mapy.cz/s/mekoragefe" target="_blank" rel="noopener noreferrer">Odkaz na mapu</a><br>
      GPS: 49.0485053N, 14.0348231E<br><br>
      <strong>Kdy:</strong> 12.9.2026 od 17:00<br><br>
      <strong>Co:</strong> párty L+P. Čeká nás posezení v pohodlném prostředí, nějaké pivo, víno, občerstvení, reprodukovaná hudba...<br>
      <strong>Co s sebou:</strong> Dobrou náladu! (Pokud spíš: stan, karimatku, spacák).<br>
      Dary prosím nenos (játra si zničit nenecháme :-)).<br><br>
      <p>Pro organizaci je důležité mít přehled, proto prosím dotazník vyplň svědomitě.</p>
      <p>Tipy na ubytování v okolí: <a href="https://www.pthotel.cz" target="_blank" rel="noopener noreferrer">pthotel.cz</a>, <a href="https://www.hotelparkan.cz" target="_blank" rel="noopener noreferrer">hotelparkan.cz</a>...</p>
    `,
    nextBtnText: 'Pokračovat k dárkům',
    nextId: 98,
  },
  98: {
    question: 'Místo daru udělejme dobro. Ať už přijdeš nebo ne, dobro podpořit můžeš.',
    options: [
      { text: 'Děti (Arpida)', url: 'https://www.arpida.cz/nabizim-pomoc/jak-nas-podporit', nextId: 99 },
      { text: 'Důchodci (Hospic)', url: 'https://www.hospicpt.cz/vase-pomoc/', nextId: 99 },
      { text: 'Kočky', url: 'https://www.kockycb.cz/jak-nas-podporit/', nextId: 99 },
    ],
  },
  99: {
    type: 'finalForm',
    title: 'Podepiš se :-)',
    description: 'Formulář pro vložení jména, mailu a telefonu.',
    fields: ['Jméno', 'Email', 'Telefon'],
    submitBtnText: 'Odeslat',
  },
};

const QUESTIONNAIRE_STORAGE_KEY = '50ka_questionnaire';

function initAvailabilityPage() {
  const flowEl = document.getElementById('questionnaire-flow');
  if (!flowEl) return;

  const state = {
    answers: [],
    completed: false,
  };

  const showStep = (stepId) => {
    const step = formSteps[stepId];
    if (!step) return;

    const card = document.createElement('article');
    card.className = 'step-card';
    card.dataset.stepId = String(stepId);

    if (step.type === 'info') {
      renderInfoStep(stepId, step, card, showStep, state);
    } else if (step.type === 'finalForm') {
      renderFinalForm(stepId, step, card, state);
    } else {
      renderQuestionStep(stepId, step, card, showStep, state);
    }

    flowEl.replaceChildren(card);
    requestAnimationFrame(() => card.classList.add('visible'));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  showStep(1);
}

const QUESTIONNAIRE_TRANSITION_DISPLAY_MS = 900;
const QUESTIONNAIRE_TRANSITION_FADE_MS = 220;

function getSafeDisplayUrl(urlValue) {
  const safeUrl = getSafeExternalUrl(urlValue);
  if (!safeUrl) return '';
  const parsed = new URL(safeUrl);
  return parsed.host;
}

function getSafeExternalUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      ? parsed.href
      : '';
  } catch {
    return '';
  }
}

function showQuestionnaireTransition(mainText, subText, onDone) {
  const overlay = document.getElementById('transition-overlay');
  const mainEl = document.getElementById('transition-main');
  const subEl = document.getElementById('transition-sub');
  if (!overlay || !mainEl || !subEl) {
    if (typeof onDone === 'function') onDone();
    return;
  }

  mainEl.textContent = mainText || '';
  subEl.textContent = subText || '';
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (typeof onDone === 'function') onDone();
    }, QUESTIONNAIRE_TRANSITION_FADE_MS);
  }, QUESTIONNAIRE_TRANSITION_DISPLAY_MS);
}

function renderQuestionStep(stepId, step, card, showStep, state) {
  const questionEl = document.createElement('h2');
  questionEl.className = 'step-question';
  questionEl.textContent = step.question;
  card.appendChild(questionEl);

  if (step.description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'step-description';
    descriptionEl.textContent = step.description;
    card.appendChild(descriptionEl);
  }

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'step-options';

  step.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'step-option-btn';
    button.textContent = option.text;

    button.addEventListener('click', () => {
      if (button.disabled) return;

      optionsWrap.querySelectorAll('.step-option-btn').forEach((btn) => {
        btn.disabled = true;
      });
      button.classList.add('selected');

      const answer = {
        stepId,
        question: step.question,
        answer: option.text,
        nextId: option.nextId ?? null,
      };
      if (option.url) answer.url = option.url;
      state.answers.push(answer);
      persistQuestionnaireState(state);

      let transitionText = option.reaction || '';
      const safeUrl = option.url ? getSafeExternalUrl(option.url) : '';
      if (!transitionText && safeUrl) {
        const safeLinkText = getSafeDisplayUrl(safeUrl);
        transitionText = safeLinkText ? `Otevíráme: ${safeLinkText}` : 'Otevíráme externí odkaz...';
      }

      if (stepId === 1) {
        saveLegacyAvailability(option.text);
      }

      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }

      if (option.nextId != null) {
        const goNext = () => showStep(option.nextId);
        if (transitionText) {
          showQuestionnaireTransition('', transitionText, goNext);
        } else {
          setTimeout(goNext, QUESTIONNAIRE_TRANSITION_FADE_MS);
        }
      }
    });

    optionsWrap.appendChild(button);
  });

  card.appendChild(optionsWrap);
}

function renderInfoStep(stepId, step, card, showStep, state) {
  const titleEl = document.createElement('h2');
  titleEl.className = 'step-question';
  titleEl.textContent = step.title;
  card.appendChild(titleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'step-info-content';
  contentEl.innerHTML = step.content;
  card.appendChild(contentEl);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'step-option-btn step-next-btn';
  button.textContent = step.nextBtnText || 'Pokračovat';

  button.addEventListener('click', () => {
    if (button.disabled) return;
    button.disabled = true;
    button.classList.add('selected');

    state.answers.push({
      stepId,
      question: step.title,
      answer: button.textContent,
      nextId: step.nextId ?? null,
    });
    persistQuestionnaireState(state);

    if (step.nextId != null) {
      setTimeout(() => showStep(step.nextId), QUESTIONNAIRE_TRANSITION_FADE_MS);
    }
  });

  card.appendChild(button);
}

function renderFinalForm(stepId, step, card, state) {
  card.classList.add('final-form-card');

  const titleEl = document.createElement('h2');
  titleEl.className = 'step-question availability-question';
  titleEl.textContent = step.title;
  card.appendChild(titleEl);

  if (step.description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'step-description';
    descriptionEl.textContent = step.description;
    card.appendChild(descriptionEl);
  }

  const form = document.createElement('form');
  form.className = 'final-form availability-form';

  step.fields.forEach((field) => {
    const fieldWrap = document.createElement('label');
    fieldWrap.className = 'final-form-field';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = field;
    fieldWrap.appendChild(labelSpan);

    const input = document.createElement('input');
    input.required = true;
    input.name = field.toLowerCase();

    if (field.toLowerCase().includes('mail')) {
      input.type = 'email';
      input.autocomplete = 'email';
    } else if (field.toLowerCase().includes('telefon')) {
      input.type = 'tel';
      input.autocomplete = 'tel';
    } else {
      input.type = 'text';
      input.autocomplete = 'name';
    }

    fieldWrap.appendChild(input);
    form.appendChild(fieldWrap);
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'step-option-btn step-next-btn';
  submitBtn.textContent = step.submitBtnText || 'Odeslat';
  form.appendChild(submitBtn);

  const statusEl = document.createElement('p');
  statusEl.className = 'final-form-status';
  form.appendChild(statusEl);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.completed) return;

    const formData = new FormData(form);
    const contact = Object.fromEntries(formData.entries());
    state.answers.push({
      stepId,
      question: step.title,
      answer: 'odesláno',
      fields: contact,
      nextId: null,
    });
    state.completed = true;
    persistQuestionnaireState(state);

    const legacyAvailability = getLegacyAvailabilityValue(state.answers);
    saveLegacyAvailabilityValue(legacyAvailability);

    statusEl.textContent = 'Děkujeme, těšíme se na tebe!';
    statusEl.classList.add('visible');
    submitBtn.disabled = true;
    form.querySelectorAll('input').forEach((input) => {
      input.disabled = true;
    });
  });

  card.appendChild(form);
}

function getLegacyAvailabilityValue(answers) {
  const stepOneAnswer = answers.find((entry) => entry.stepId === 1)?.answer;
  const normalized = (stepOneAnswer || '').toLowerCase();
  if (normalized === 'ano') return 'ano';
  if (normalized === 'ne') return 'ne';
  if (normalized === 'uvidíme' || normalized === 'uvidime') return 'uvidime';
  return 'uvidime';
}

function persistQuestionnaireState(state) {
  localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify({
    userId: USER_ID,
    choice: sessionStorage.getItem('50ka_choice') || 'unknown',
    timestamp: new Date().toISOString(),
    ...state,
  }));
}

function saveLegacyAvailability(answerText) {
  const normalized = String(answerText || '').toLowerCase();
  const mapped = normalized === 'ano'
    ? 'ano'
    : normalized === 'ne'
      ? 'ne'
      : 'uvidime';
  saveLegacyAvailabilityValue(mapped);
}

function saveLegacyAvailabilityValue(answer) {
  const choice  = sessionStorage.getItem('50ka_choice') || 'unknown';
  const payload = {
    userId:    USER_ID,
    choice:    choice,
    available: answer,
    timestamp: new Date().toISOString(),
  };

  // Persist locally always
  localStorage.setItem('50ka_response', JSON.stringify(payload));

  // Attempt to POST to server (graceful failure if offline)
  fetch('/api/response', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(() => {
    // Server not running — local storage is still saved
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCyclingNumber();
  initScrollZoom();
  initAvailabilityPage();
});
