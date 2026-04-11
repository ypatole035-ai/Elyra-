/* ═══════════════════════════════════════
   STORAGE.JS — localStorage Manager
   Elyra App
═══════════════════════════════════════ */

const Storage = (() => {

  const KEYS = {
    PROFILE:      'elyra_profile',
    COMPANIONS:   'elyra_companions',
    ACTIVE:       'elyra_active_companion',
    KEYS_SET:     'elyra_keys',
    PIN:          'elyra_pin',
    PIN_ENABLED:  'elyra_pin_enabled',
    SETUP_DONE:   'elyra_setup_done',
    ONBOARD_DONE: 'elyra_onboard_done',
  };

  // ── Helpers ──
  function get(key) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  // ── API Keys ──
  function getApiKeys() {
    return get(KEYS.KEYS_SET) || { gemini: '', groq: '' };
  }

  function setApiKeys(gemini, groq) {
    return set(KEYS.KEYS_SET, { gemini, groq });
  }

  function hasApiKeys() {
    const k = getApiKeys();
    return !!(k.gemini || k.groq);
  }

  // ── Profile ──
  function getProfile() {
    return get(KEYS.PROFILE) || null;
  }

  function setProfile(data) {
    return set(KEYS.PROFILE, {
      name:   data.name   || '',
      gender: data.gender || 'male',
      ...data
    });
  }

  // ── Companions ──
  function getCompanions() {
    return get(KEYS.COMPANIONS) || [];
  }

  function getCompanion(id) {
    const list = getCompanions();
    return list.find(c => c.id === id) || null;
  }

  function saveCompanion(companion) {
    const list = getCompanions();
    const idx  = list.findIndex(c => c.id === companion.id);
    if (idx >= 0) {
      list[idx] = companion;
    } else {
      list.push(companion);
    }
    return set(KEYS.COMPANIONS, list);
  }

  function deleteCompanion(id) {
    const list = getCompanions().filter(c => c.id !== id);
    set(KEYS.COMPANIONS, list);
    // also remove chat history
    remove(`elyra_chat_${id}`);
    remove(`elyra_memory_${id}`);
  }

  function createCompanion({ name, avatar, relation, personality, gender }) {
    const id = 'c_' + Date.now();
    const companion = {
      id,
      name,
      avatar,
      relation,
      personality,
      gender,           // bot gender (derived from user gender + relation)
      createdAt: Date.now(),
      lastMessage: null,
      lastMessageTime: null,
      xp: 0,
      level: 1,
      mood: 'neutral',
      lastActive: null,
    };
    saveCompanion(companion);
    return companion;
  }

  function updateCompanion(id, updates) {
    const c = getCompanion(id);
    if (!c) return false;
    return saveCompanion({ ...c, ...updates });
  }

  // ── Chat History ──
  function getChatHistory(companionId) {
    return get(`elyra_chat_${companionId}`) || [];
  }

  function saveChatHistory(companionId, messages) {
    return set(`elyra_chat_${companionId}`, messages);
  }

  function appendMessage(companionId, message) {
    const history = getChatHistory(companionId);
    history.push(message);
    saveChatHistory(companionId, history);
    // update companion last message preview
    if (message.role === 'bot') {
      updateCompanion(companionId, {
        lastMessage: message.text.slice(0, 60),
        lastMessageTime: message.timestamp,
      });
    }
    return history;
  }

  function createMessage(role, text) {
    return {
      id:        'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      role,      // 'user' | 'bot'
      text,
      timestamp: Date.now(),
    };
  }

  // ── Memory ──
  function getMemory(companionId) {
    return get(`elyra_memory_${companionId}`) || {
      pinned: [],       // array of { key, value } important facts
      summary: '',      // AI-generated summary of older messages
      summaryUpTo: 0,   // message index summary covers up to
    };
  }

  function saveMemory(companionId, memory) {
    return set(`elyra_memory_${companionId}`, memory);
  }

  function addPinnedFact(companionId, key, value) {
    const mem = getMemory(companionId);
    const idx = mem.pinned.findIndex(p => p.key === key);
    if (idx >= 0) {
      mem.pinned[idx].value = value;
    } else {
      mem.pinned.push({ key, value });
    }
    saveMemory(companionId, mem);
  }

  // ── Active Companion ──
  function getActiveCompanionId() {
    return localStorage.getItem(KEYS.ACTIVE) || null;
  }

  function setActiveCompanionId(id) {
    localStorage.setItem(KEYS.ACTIVE, id);
  }

  // ── Setup Flags ──
  function isSetupDone() {
    return localStorage.getItem(KEYS.SETUP_DONE) === 'true';
  }

  function markSetupDone() {
    localStorage.setItem(KEYS.SETUP_DONE, 'true');
  }

  function isOnboardDone() {
    return localStorage.getItem(KEYS.ONBOARD_DONE) === 'true';
  }

  function markOnboardDone() {
    localStorage.setItem(KEYS.ONBOARD_DONE, 'true');
  }

  // ── PIN Lock ──
  function isPinEnabled() {
    return localStorage.getItem(KEYS.PIN_ENABLED) === 'true';
  }

  function setPinEnabled(val) {
    localStorage.setItem(KEYS.PIN_ENABLED, val ? 'true' : 'false');
  }

  function getPin() {
    return localStorage.getItem(KEYS.PIN) || null;
  }

  function setPin(pin) {
    localStorage.setItem(KEYS.PIN, pin);
  }

  function verifyPin(input) {
    return getPin() === input;
  }

  // ── Clear All Data ──
  function clearAll() {
    const keysToKeep = []; // keep nothing
    Object.values(KEYS).forEach(k => remove(k));
    // clear all chat and memory keys
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(k => {
      if (k.startsWith('elyra_')) localStorage.removeItem(k);
    });
  }

  // ── XP System ──
  function addXP(companionId, amount = 10) {
    const c = getCompanion(companionId);
    if (!c) return;
    let xp    = (c.xp || 0) + amount;
    let level = c.level || 1;
    const xpForNextLevel = level * 100;
    let leveledUp = false;
    if (xp >= xpForNextLevel) {
      xp -= xpForNextLevel;
      level += 1;
      leveledUp = true;
    }
    updateCompanion(companionId, { xp, level });
    return { xp, level, leveledUp, xpForNextLevel };
  }

  function getXPProgress(companionId) {
    const c = getCompanion(companionId);
    if (!c) return { xp: 0, level: 1, percent: 0 };
    const level = c.level || 1;
    const xp    = c.xp    || 0;
    const max   = level * 100;
    return { xp, level, percent: Math.min((xp / max) * 100, 100), max };
  }

  // ── Expose ──
  return {
    // API keys
    getApiKeys, setApiKeys, hasApiKeys,
    // Profile
    getProfile, setProfile,
    // Companions
    getCompanions, getCompanion, saveCompanion,
    deleteCompanion, createCompanion, updateCompanion,
    // Chat
    getChatHistory, saveChatHistory, appendMessage, createMessage,
    // Memory
    getMemory, saveMemory, addPinnedFact,
    // Active
    getActiveCompanionId, setActiveCompanionId,
    // Flags
    isSetupDone, markSetupDone, isOnboardDone, markOnboardDone,
    // PIN
    isPinEnabled, setPinEnabled, getPin, setPin, verifyPin,
    // Utils
    clearAll, addXP, getXPProgress,
  };

})();
