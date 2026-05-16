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
  // Progress at which buttons start fading in (0–1)
  const BUTTONS_FADE_START = 0.44;

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

    // Fade in the overlay buttons near the end
    if (faceOverlay) {
      const fadeProgress = Math.max(
        0,
        Math.min(1, (progress - BUTTONS_FADE_START) / (1 - BUTTONS_FADE_START))
      );
      faceOverlay.style.opacity = fadeProgress;
      if (fadeProgress > 0.05) {
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
function initAvailabilityPage() {
  const pageEl = document.querySelector('.availability-page');
  if (!pageEl) return; // Not on this page

  const buttons = pageEl.querySelectorAll('.avail-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.dataset.answer;
      saveAvailability(answer);
    });
  });
}

function saveAvailability(answer) {
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

  // Show confirmation
  showConfirmation(answer);
}

function showConfirmation(answer) {
  const msgEl = document.getElementById('confirm-message');
  if (!msgEl) return;

  const messages = {
    ano:     'Super! Těšíme se na tebe! 🎉',
    ne:      'Škoda! Budeme tě postrádat. 😢',
    uvidime: 'Dej nám vědět, až budeš vědět! 😊',
  };

  msgEl.textContent = messages[answer] || 'Díky za odpověď!';
  msgEl.classList.add('visible');

  // Disable all buttons after answering
  document.querySelectorAll('.avail-btn').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.5';
    b.style.cursor  = 'default';
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
