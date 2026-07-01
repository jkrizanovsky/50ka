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
let hasMadeFaceChoice = false;
let hasInitializedFunFactBox = false;
const FUN_FACT_HIDDEN_STEPS = new Set([97, 98, 99]);

const FUN_FACTS = [
  '50 let je v přepočtu přes 26 milionů minut. Dohromady to tedy znamená že naši oslavenci již strávili na zemi přes 52 milionů minut života.',
  'Kdyby průměrný člověk ušel 25 km za den, za 50 let by ušel 547 875 km. Takže pokud dnes Petr vyrazí, bude další oslava na měsíci.',
  'Lenka se narodila ve stejný den jako Andrej Ševčenko, naopak Petr má stejné narozeniny jako Alfred Hitchcock... jen teda o 77 let později.',
  'Kdyby se rozhodlo přijít 100 plejtváků obrovských, museli bychom zarezervovat 2 fotbalová hřiště a cca 1000 tun planktonu.',
  '50 průměrných dětí by dokázalo utáhnout 1 osobní auto do mírného kopce. Dotazy jak jsme zajistili odvoz nepřijímáme!!!',
  'nejrychlejší jedlík historie by za 25 let dokázal spořádat přes 109 milionů párků, pokud by to chtěl někdo zkusit, Lenka nakoupí párky.',
  'nejstarší maso pozřené člověkem bylo z 50 000 let starého bizona, uchovaného v permafrostu. Američtí vědci si z něj udělali guláš.',
  'Letos slaví 50 let krom Petra a Lenky i legendární Pito, to naštěstí nepodáváme. Co se týče piva, dokonce 100 let letos slaví Stella Artois.',
  'Výročí 50 let od založení letos slaví U2, The Clash a The Cure. Dohromady ti tyto tři kapely přinesou přes 50 hodin kvalitní muziky.',
  'Bohužel na 50 let člověk usnout nemůže, oficiální rekord dokázali nezávisle na sobě dva chlapci a pohybuje se okolo 11 nepřetržitých dní.',
  'Kdyby se jelo příštích 50 let nepřetržitě autem za rychlosti 100km/h, byla by další oslava dokonce na Venuši, snad to náš... ehm řidič zvládne.',
  'Na přípravu jednoho espressa v průměru padne 50 zrnek kávy. Průměrný kávovník by tedy vyprodukoval pouhých 4000 espress za 50 let.',
];

const FUN_FACT_STEP_ORDER = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/* ============================================================
   CYCLING NUMBER IMAGE
   Cycles in number pattern 25 → 50 → 100 every 700 ms
   while randomly picking a visual variant for each number.
   ============================================================ */
const NUMBER_SEQUENCE = ['25', '50', '100'];

const NUMBER_VARIANTS = {
  '25': [
    'images/25.svg',
    'images/25.png',
    'images/25-01.png',
    'images/25-02.png',
    'images/25-03.png',
    'images/25-04.png',
    'images/25-05.png',
    'images/25-06.png',
    'images/25-07.png',
    'images/25-08.png',
    'images/25-09.png',
  ],
  '50': [
    'images/50.svg',
    'images/50.png',
    'images/50-01.png',
    'images/50-02.png',
    'images/50-03.png',
    'images/50-04.png',
    'images/50-05.png',
    'images/50-06.png',
    'images/50-07.png',
    'images/50-08.png',
    'images/50-09.png',
  ],
  '100': [
    'images/100.svg',
    'images/100.png',
    'images/100-01.png',
    'images/100-02.png',
    'images/100-03.png',
    'images/100-04.png',
    'images/100-05.png',
    'images/100-06.png',
    'images/100-07.png',
    'images/100-08.png',
    'images/100-09.png',
  ],
};

let cycleIndex = 0;

function pickRandomVariant(numberKey) {
  const variants = NUMBER_VARIANTS[numberKey] || [];
  if (variants.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * variants.length);
  return { src: variants[randomIndex], alt: numberKey };
}

function initCyclingNumber() {
  const img = document.getElementById('cycling-img');
  if (!img) return;

  // Pre-load images so there's no flash on swap
  Object.values(NUMBER_VARIANTS).flat().forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });

  const initial = pickRandomVariant(NUMBER_SEQUENCE[cycleIndex]);
  if (initial) {
    img.src = initial.src;
    img.alt = initial.alt;
  }

  setInterval(() => {
    cycleIndex = (cycleIndex + 1) % NUMBER_SEQUENCE.length;
    const next = pickRandomVariant(NUMBER_SEQUENCE[cycleIndex]);
    if (!next) return;

    img.style.opacity = '0';
    img.style.transition = 'opacity 0.25s ease';

    setTimeout(() => {
      img.src = next.src;
      img.alt = next.alt;
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
  const faceHelperHint = document.getElementById('face-helper-hint');
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
  const scrollListenerOptions = { passive: true };
  function hideHelperHint() {
    if (faceHelperHint) {
      faceHelperHint.classList.remove('visible');
    }
  }

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
        if (faceHelperHint && !hasMadeFaceChoice) {
          faceHelperHint.classList.add('visible');
        }
      } else {
        faceOverlay.classList.remove('visible');
        hideHelperHint();
      }
    }
  }

  function cleanupScrollZoom() {
    hideHelperHint();
    window.removeEventListener('scroll', onScroll, scrollListenerOptions);
    window.removeEventListener('pagehide', cleanupScrollZoom);
  }

  window.addEventListener('scroll', onScroll, scrollListenerOptions);
  window.addEventListener('pagehide', cleanupScrollZoom);
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
  if (!overlay || !mainEl || !subEl) return;

  const hasMainText = Boolean(mainText && String(mainText).trim());
  mainEl.textContent = hasMainText ? mainText : '';
  overlay.classList.toggle('no-main', !hasMainText);
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
  hasMadeFaceChoice = true;
  // Save choice so availability page can log it with user ID
  sessionStorage.setItem('50ka_choice', 'left');
  showTransitionThenNavigate(
    '',
    'ale neříkej to nahlas aby Petr nežárlil...',
    'availability.html'
  );
}

function chooseRight() {
  hasMadeFaceChoice = true;
  sessionStorage.setItem('50ka_choice', 'right');
  showTransitionThenNavigate(
    '',
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
      { text: 'Ano', reaction: 'To zní nadějně...', nextId: 3 },
      { text: 'Ne', reaction: 'To je škoda, ale měl by ses ještě zamyslet', nextId: 3 },
      { text: 'Uvidíme', reaction: 'Snad tě přesvědčíme', nextId: 3 },
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
      { text: 'odpoledne (14-16)', reaction: 'ranní ptáče dál doskáče.', nextId: 5 },
      { text: 'pozdní odpoledne (16-19)', reaction: 'možná ještě budou teplý řízky...', nextId: 5 },
      { text: 'večer (19-20)', reaction: 'kdo pozdě chodí, sám sobě škodí!', nextId: 5 },
      { text: 'To bude tajemství', reaction: 'tajemnější než hrad v Karpatech...', nextId: 5 },
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
      { text: 'opravdu jsem kytkožrout', reaction: 'ne každý má to štěstí', nextId: 9 },
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
      { text: 'jiné', reaction: 'tak to máš nejspíš smůlu', nextId: 11 },
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
      { text: 'Snídaně hromadně', reaction: 'švédská trojka u švédského stolu?', nextId: 97 },
      { text: 'Snídaní až doma', reaction: 'hezky v soukromí.', nextId: 97 },
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
    nextBtnReaction: 'těšíme se na vás, ale ještě předtím...',
    nextId: 98,
  },
  98: {
    question: 'Místo daru udělejme dobro. Ať už přijdeš nebo ne, dobro podpořit můžeš.',
    options: [
      { text: 'Děti (Arpida)', url: 'https://www.arpida.cz/nabizim-pomoc/jak-nas-podporit-2', nextId: 99 },
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
const QUESTIONNAIRE_ANSWER_STEP_LIMIT = 97;
const STEP_ILLUSTRATIONS = {
  1: {
    src: 'images/noding_petr.png',
    alt: 'Petr kývá hlavou',
  },
  3: {
    src: 'images/thinking_lenka.png',
    alt: 'Lenka přemýšlí',
  },
  4: {
    src: 'images/cat clock.gif',
    alt: 'Kočka s hodinami',
  },
  5: {
    src: 'images/peace_lenka.png',
    alt: 'Lenka ukazuje peace',
  },
  6: {
    src: 'images/kid.gif',
    alt: 'Dítě',
  },
  7: {
    src: 'images/pointing_petr.png',
    alt: 'Petr ukazuje prstem',
  },
  8: {
    src: 'images/cat meat.gif',
    alt: 'Kočka a maso',
  },
  9: {
    src: 'images/pointing_lenka.png',
    alt: 'Lenka ukazuje prstem',
  },
  10: {
    src: 'images/winning_petr.png',
    alt: 'Petr slaví vítězství',
  },
  11: {
    src: 'images/patrick sleep.gif',
    alt: 'Patrick spí',
  },
  12: {
    src: 'images/thinking_petr.png',
    alt: 'Petr přemýšlí',
  },
  13: {
    src: 'images/breakfast gif.gif',
    alt: 'Snídaně',
  },
  98: {
    src: 'images/heart.gif',
    alt: 'Srdce',
  },
  99: {
    src: 'images/shaun.gif',
    alt: 'Shaun',
  },
};

function initQuestionnaireNumberBouncer() {
  const bouncerEl = document.getElementById('questionnaire-number-bouncer');
  const imgEl = document.getElementById('questionnaire-number-bouncer-img');
  if (!bouncerEl || !imgEl) return;

  let posX = 0;
  let posY = 0;
  let velocityX = 1.7;
  let velocityY = 1.7;
  let variantIndex = 0;
  let maxX = 0;
  let maxY = 0;
  let animationFrameId = null;
  let isActive = true;

  function recalculateBounds() {
    maxX = Math.max(0, window.innerWidth - bouncerEl.offsetWidth);
    maxY = Math.max(0, window.innerHeight - bouncerEl.offsetHeight);
  }

  function applyVariant() {
    const numberKey = NUMBER_SEQUENCE[variantIndex];
    const variant = pickRandomVariant(numberKey);
    if (variant) {
      imgEl.src = variant.src;
      imgEl.alt = variant.alt;
    }
    variantIndex = (variantIndex + 1) % NUMBER_SEQUENCE.length;
  }

  function clampInViewport() {
    recalculateBounds();
    posX = Math.max(0, Math.min(posX, maxX));
    posY = Math.max(0, Math.min(posY, maxY));
    bouncerEl.style.transform = `translate3d(${Math.round(posX)}px, ${Math.round(posY)}px, 0)`;
  }

  function animate() {
    if (!isActive) return;

    posX += velocityX;
    posY += velocityY;

    let hasBounced = false;

    if (posX <= 0) {
      posX = 0;
      velocityX = Math.abs(velocityX);
      hasBounced = true;
    } else if (posX >= maxX) {
      posX = maxX;
      velocityX = -Math.abs(velocityX);
      hasBounced = true;
    }

    if (posY <= 0) {
      posY = 0;
      velocityY = Math.abs(velocityY);
      hasBounced = true;
    } else if (posY >= maxY) {
      posY = maxY;
      velocityY = -Math.abs(velocityY);
      hasBounced = true;
    }

    if (hasBounced) {
      applyVariant();
    }

    bouncerEl.style.transform = `translate3d(${Math.round(posX)}px, ${Math.round(posY)}px, 0)`;
    animationFrameId = requestAnimationFrame(animate);
  }

  function cleanup() {
    if (!isActive) return;
    isActive = false;
    window.removeEventListener('resize', clampInViewport);
    window.removeEventListener('pagehide', cleanup);
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  }

  posX = Math.max(0, (window.innerWidth - bouncerEl.offsetWidth) / 2);
  posY = Math.max(0, (window.innerHeight - bouncerEl.offsetHeight) / 2);
  velocityX = Math.random() > 0.5 ? Math.abs(velocityX) : -Math.abs(velocityX);
  velocityY = Math.random() > 0.5 ? Math.abs(velocityY) : -Math.abs(velocityY);
  applyVariant();
  clampInViewport();

  window.addEventListener('resize', clampInViewport, { passive: true });
  window.addEventListener('pagehide', cleanup);
  animationFrameId = requestAnimationFrame(animate);
}

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

    const illustration = createStepIllustration(stepId);
    const sideImages = createInstructionSideImages(stepId);
    const parts = [card];
    if (illustration) parts.push(illustration);
    if (sideImages) parts.push(sideImages);
    flowEl.replaceChildren(...parts);
    updateFunFactVisibility(stepId);

    requestAnimationFrame(() => {
      card.classList.add('visible');
      if (illustration) {
        illustration.classList.add('visible');
      }
      if (sideImages) {
        sideImages.classList.add('visible');
      }
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  showStep(1);
}

function updateFunFactVisibility(stepId) {
  const factBox = document.getElementById('fun-fact-box');
  if (!factBox) return;
  const factIndex = FUN_FACT_STEP_ORDER.indexOf(stepId);
  const nextFact = factIndex === -1 || factIndex >= FUN_FACTS.length
    ? ''
    : FUN_FACTS[factIndex];

  factBox.textContent = nextFact;
  factBox.classList.toggle('visible', !FUN_FACT_HIDDEN_STEPS.has(stepId) && Boolean(nextFact));
}

function createStepIllustration(stepId) {
  const illustration = STEP_ILLUSTRATIONS[stepId];
  if (!illustration) return null;

  const figure = document.createElement('figure');
  figure.className = 'step-illustration';

  const image = document.createElement('img');
  image.src = illustration.src;
  image.alt = illustration.alt;
  image.width = 720;
  image.height = 720;
  image.loading = 'lazy';
  image.decoding = 'async';

  figure.appendChild(image);
  return figure;
}

function createInstructionSideImages(stepId) {
  if (stepId !== 97) return null;

  const wrap = document.createElement('div');
  wrap.className = 'step-side-images';

  const left = document.createElement('img');
  left.src = 'images/side_lenka.png';
  left.alt = 'Lenka vlevo';
  left.className = 'step-side-image step-side-image-left';
  left.width = 480;
  left.height = 720;
  left.loading = 'lazy';
  left.decoding = 'async';

  const right = document.createElement('img');
  right.src = 'images/side_petr.png';
  right.alt = 'Petr vpravo';
  right.className = 'step-side-image step-side-image-right';
  right.width = 480;
  right.height = 720;
  right.loading = 'lazy';
  right.decoding = 'async';

  wrap.append(left, right);
  return wrap;
}

const QUESTIONNAIRE_TRANSITION_DISPLAY_MS = 2200;
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

  const hasMainText = Boolean(mainText && String(mainText).trim());
  mainEl.textContent = hasMainText ? mainText : '';
  overlay.classList.toggle('no-main', !hasMainText);
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

      const transitionMainText = '';
      let transitionText = option.reaction || '';
      const safeUrl = option.url ? getSafeExternalUrl(option.url) : '';
      if (!transitionText && safeUrl) {
        const safeLinkText = getSafeDisplayUrl(safeUrl);
        transitionText = safeLinkText ? `Otevíráme: ${safeLinkText}` : 'Otevíráme externí odkaz...';
      }

      if (safeUrl) {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }

      if (option.nextId != null) {
        const goNext = () => showStep(option.nextId);
        if (transitionMainText || transitionText) {
          showQuestionnaireTransition(transitionMainText, transitionText, goNext);
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
      const goNext = () => showStep(step.nextId);
      const transitionText = step.nextBtnReaction || '';
      if (transitionText) {
        showQuestionnaireTransition('', transitionText, goNext);
      } else {
        setTimeout(goNext, QUESTIONNAIRE_TRANSITION_FADE_MS);
      }
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
    const fieldConfig = getFinalFormFieldConfig(field);
    const fieldWrap = document.createElement('label');
    fieldWrap.className = 'final-form-field';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = fieldConfig.label;
    fieldWrap.appendChild(labelSpan);

    const input = document.createElement('input');
    input.required = true;
    input.name = fieldConfig.name;
    input.type = fieldConfig.type;
    input.autocomplete = fieldConfig.autocomplete;

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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.completed) return;

    const formData = new FormData(form);
    const contact = Object.fromEntries(formData.entries());
    const finalAnswer = {
      stepId,
      question: step.title,
      answer: 'odesláno',
      fields: contact,
      nextId: null,
    };
    const existingAnswerIndex = state.answers.findIndex((entry) => entry.stepId === stepId);
    if (existingAnswerIndex === -1) {
      state.answers.push(finalAnswer);
    } else {
      state.answers[existingAnswerIndex] = finalAnswer;
    }
    persistQuestionnaireState(state);

    statusEl.textContent = 'Odesíláme...';
    statusEl.classList.add('visible');
    submitBtn.disabled = true;
    form.querySelectorAll('input').forEach((input) => {
      input.disabled = true;
    });

    const wasSaved = await submitQuestionnaireResponse(state, contact);
    if (!wasSaved) {
      statusEl.textContent = 'Odeslání se nepovedlo, zkus to prosím znovu.';
      submitBtn.disabled = false;
      form.querySelectorAll('input').forEach((input) => {
        input.disabled = false;
      });
      return;
    }

    state.completed = true;
    persistQuestionnaireState(state);
    statusEl.textContent = 'Děkujeme, těšíme se na tebe!';
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

function getFinalFormFieldConfig(fieldLabel) {
  const normalized = String(fieldLabel || '').toLowerCase();

  if (normalized.includes('mail')) {
    return {
      label: fieldLabel,
      name: 'email',
      type: 'email',
      autocomplete: 'email',
    };
  }

  if (normalized.includes('telefon')) {
    return {
      label: fieldLabel,
      name: 'phone',
      type: 'tel',
      autocomplete: 'tel',
    };
  }

  return {
    label: fieldLabel,
    name: 'name',
    type: 'text',
    autocomplete: 'name',
  };
}

function getLegacyChoiceValue(choice) {
  const map = {
    left: 'lenku',
    right: 'petra',
    lenku: 'lenku',
    petra: 'petra',
    nezadano: 'nezadano',
    unknown: 'nezadano',
  };
  return map[choice] || 'nezadano';
}

function persistQuestionnaireState(state) {
  localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify({
    userId: USER_ID,
    choice: sessionStorage.getItem('50ka_choice') || 'unknown',
    timestamp: new Date().toISOString(),
    ...state,
  }));
}

function getTrackedAnswers(answers) {
  return answers
    .filter((entry) => Number.isInteger(entry.stepId) && entry.stepId < QUESTIONNAIRE_ANSWER_STEP_LIMIT)
    .map((entry) => ({
      stepId: entry.stepId,
      question: entry.question,
      answer: entry.answer,
    }));
}

function buildQuestionnairePayload(state, contact) {
  const trackedAnswers = getTrackedAnswers(state.answers);
  const availability = getLegacyAvailabilityValue(trackedAnswers);
  const choice = getLegacyChoiceValue(sessionStorage.getItem('50ka_choice'));
  const payload = {
    userId: USER_ID,
    choice,
    available: availability,
    answers: trackedAnswers,
    contact: {
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
    },
    timestamp: new Date().toISOString(),
  };
  return payload;
}

async function submitQuestionnaireResponse(state, contact) {
  const payload = buildQuestionnairePayload(state, contact);

  localStorage.setItem('50ka_response', JSON.stringify(payload));

  try {
    const response = await fetch('/api/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function initFunFactBox() {
  if (hasInitializedFunFactBox) return;
  if (!document.body) return;
  if (!document.getElementById('questionnaire-flow')) return;

  const factBox = document.createElement('p');
  factBox.id = 'fun-fact-box';
  factBox.className = 'fun-fact-box';
  factBox.textContent = FUN_FACTS[0];

  document.body.appendChild(factBox);
  hasInitializedFunFactBox = true;
  requestAnimationFrame(() => {
    updateFunFactVisibility(1);
  });
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCyclingNumber();
  initScrollZoom();
  initQuestionnaireNumberBouncer();
  initAvailabilityPage();
  initFunFactBox();
});
