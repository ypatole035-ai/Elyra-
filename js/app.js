/* ═══════════════════════════════════════
   APP.JS — Router, Launch Logic, Utils
   Elyra App
═══════════════════════════════════════ */

const App = (() => {

  // ── Current page detection ──
  const PAGE = {
    INDEX:       'index.html',
    ONBOARDING:  'onboarding.html',
    HOME:        'home.html',
    CHAT:        'chat.html',
    SETTINGS:    'settings.html',
  };

  function currentPage() {
    const path = window.location.pathname;
    const file = path.split('/').pop() || 'index.html';
    return file || 'index.html';
  }

  // ── Route guard ──
  // Called on every page load to redirect if needed
  function guard() {
    const page = currentPage();

    // Always allow index (key setup) and pin screen
    if (page === PAGE.INDEX || page === 'pin.html' || page === '') return;

    // Must have setup done
    if (!Storage.isSetupDone()) {
      redirect(PAGE.INDEX);
      return;
    }

    // Must have onboarding done (except on onboarding page itself)
    if (!Storage.isOnboardDone() && page !== PAGE.ONBOARDING) {
      redirect(PAGE.ONBOARDING);
      return;
    }

    // PIN lock check (except settings and onboarding)
    if (
      Storage.isPinEnabled() &&
      page !== PAGE.SETTINGS &&
      page !== PAGE.ONBOARDING
    ) {
      const unlocked = sessionStorage.getItem('elyra_unlocked');
      if (!unlocked) {
        // Store intended destination
        sessionStorage.setItem('elyra_pin_dest', window.location.href);
        redirect('pin.html');
        return;
      }
    }
  }

  function redirect(page) {
    window.location.href = page;
  }

  // ── Query params ──
  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
  }

  // ── Toast ──
  let toastTimer = null;
  function toast(message, duration = 2500) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  // ── Time utils ──
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now  = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hrs  < 24)  return date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7)   return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatChatTime(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }

  function getTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  function getGreeting(name) {
    const t = getTimeOfDay();
    const greetings = {
      morning:   `Good morning, ${name} ☀️`,
      afternoon: `Hey ${name} 👋`,
      evening:   `Good evening, ${name} 🌙`,
      night:     `Still up, ${name}? 🌙`,
    };
    return greetings[t];
  }

  // ── Relation display helpers ──
  const RELATION_MAP = {
    girlfriend: { label: 'Girlfriend',   emoji: '💕' },
    bestfriend: { label: 'Best Friend',  emoji: '🤝' },
    sister:     { label: 'Sister',       emoji: '👧' },
    crush:      { label: 'Crush',        emoji: '😍' },
  };

  const PERSONALITY_MAP = {
    sympathy:  { label: 'Sympathy Mode',  emoji: '🥺' },
    sarcastic: { label: 'Sarcastic',      emoji: '😏' },
    flirty:    { label: 'Flirty',         emoji: '😘' },
    dramatic:  { label: 'Dramatic',       emoji: '😭' },
    roast:     { label: 'Roast Machine',  emoji: '🔥' },
  };

  function getRelationDisplay(id) {
    return RELATION_MAP[id] || { label: id, emoji: '✨' };
  }

  function getPersonalityDisplay(id) {
    return PERSONALITY_MAP[id] || { label: id, emoji: '🎭' };
  }

  // ── Scroll helpers ──
  function scrollToBottom(el, smooth = true) {
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  // ── Auto-resize textarea ──
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // ── Debounce ──
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  // ── Cooldown for send button ──
  let lastSent = 0;
  function canSend(cooldownMs = 1500) {
    const now = Date.now();
    if (now - lastSent < cooldownMs) return false;
    lastSent = now;
    return true;
  }

  // ── Header scroll shadow ──
  function initHeaderScroll(headerEl, scrollEl) {
    if (!headerEl || !scrollEl) return;
    scrollEl.addEventListener('scroll', () => {
      headerEl.classList.toggle('scrolled', scrollEl.scrollTop > 10);
    });
  }

  // ── Expose ──
  return {
    guard,
    redirect,
    getParam,
    toast,
    formatTime,
    formatChatTime,
    getTimeOfDay,
    getGreeting,
    getRelationDisplay,
    getPersonalityDisplay,
    scrollToBottom,
    autoResize,
    debounce,
    canSend,
    initHeaderScroll,
    PAGE,
  };

})();

// Run guard on every page
document.addEventListener('DOMContentLoaded', () => App.guard());
