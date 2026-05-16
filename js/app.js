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
  const zoomZone   = document.getElementById('zoom-zone');
  const faceImg    = document.getElementById('face-img');
  const faceOverlay = document.getElementById('face-overlay');
  if (!zoomZone || !faceImg) return;

  const startBlur = parseFloat(getComputedStyle(faceImg).getPropertyValue('--face-start-blur')) || 18;
  const ANIMATION_END = 0.48;
  // Progress at which buttons start fading in (0–1)
  const BUTTONS_FADE_START = 0.44;

  function onScroll() {
    const scrollY    = window.scrollY;
    const zoneTop    = zoomZone.offsetTop;
    const zoneHeight = zoomZone.offsetHeight;
    const vh         = window.innerHeight;

    // Scrollable distance within the zone
    const totalScrollable = zoneHeight - vh;
    const scrollInZone    = scrollY - zoneTop;
    const progress = Math.max(0, Math.min(1, scrollInZone / totalScrollable));
    const animationProgress = Math.min(progress / ANIMATION_END, 1);

    // Far away: blurrier + transparent. Close: sharp + opaque.
    const clarity = 1 - Math.pow(1 - animationProgress, 2.4);
    const blurPx = startBlur * (1 - clarity);
    faceImg.style.filter = `blur(${blurPx}px)`;
    faceImg.style.opacity = clarity;

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
