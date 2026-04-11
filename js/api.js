/* ═══════════════════════════════════════
   API.JS — Gemini + Groq with Key Rotation
   Elyra App
═══════════════════════════════════════ */

const API = (() => {

  // ── State ──
  let geminiLimitHit = false;
  let groqLimitHit   = false;
  let usingBackup    = false;

  // Track limit hits per session
  function resetLimits() {
    geminiLimitHit = false;
    groqLimitHit   = false;
    usingBackup    = false;
  }

  function isLimitError(status) {
    return status === 429 || status === 503 || status === 500;
  }

  // ── Gemini Models (free tier as of 2026) ──
  // Primary:   gemini-2.5-flash-lite  → 15 RPM, 1000/day (best free limits)
  // Secondary: gemini-2.5-flash       → 10 RPM, 250/day  (better quality)
  // Note: gemini-1.5-flash and gemini-2.0-flash are SHUT DOWN as of 2026
  const GEMINI_MODEL_PRIMARY   = 'gemini-2.5-flash-lite';
  const GEMINI_MODEL_SECONDARY = 'gemini-2.5-flash';

  let geminiModelLiteLimitHit = false; // track if lite model hit limit

  // ── Gemini API Call ──
  async function callGemini({ apiKey, systemPrompt, messages, userMessage }) {
    // Build contents array for Gemini
    // Gemini uses 'user' and 'model' roles
    const contents = [];

    // Add history
    messages.forEach(m => {
      contents.push({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      });
    });

    // Add current user message
    contents.push({
      role:  'user',
      parts: [{ text: userMessage }],
    });

    // Pick model — try lite first for best free quota, fall back to flash
    const model = geminiModelLiteLimitHit ? GEMINI_MODEL_SECONDARY : GEMINI_MODEL_PRIMARY;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: 400,
        temperature:     0.85,
        topP:            0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // If lite model hit limit, try promoting to flash model next call
      if (isLimitError(res.status) && !geminiModelLiteLimitHit) {
        geminiModelLiteLimitHit = true;
      }
      throw { status: res.status, message: err?.error?.message || 'Gemini error', source: 'gemini' };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw { status: 200, message: 'Empty response from Gemini', source: 'gemini' };
    return { text: text.trim(), source: 'gemini' };
  }

  // ── Groq API Call ──
  async function callGroq({ apiKey, systemPrompt, messages, userMessage }) {
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        messages:    groqMessages,
        max_tokens:  400,
        temperature: 0.85,
        top_p:       0.95,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { status: res.status, message: err?.error?.message || 'Groq error', source: 'groq' };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw { status: 200, message: 'Empty response from Groq', source: 'groq' };
    return { text: text.trim(), source: 'groq' };
  }

  // ── Build history for API ──
  function buildHistory(chatHistory) {
    const raw = (chatHistory || []).slice(-10).map(m => ({
      role:    m.role,
      content: m.text,
    }));

    // Gemini requires strictly alternating user/model turns
    // Merge consecutive same-role messages to avoid API errors
    const merged = [];
    raw.forEach(msg => {
      const geminiRole = msg.role === 'user' ? 'user' : 'model';
      if (merged.length > 0 && merged[merged.length - 1].role === geminiRole) {
        merged[merged.length - 1].content += '\n' + msg.content;
      } else {
        merged.push({ role: geminiRole, content: msg.content });
      }
    });

    // Must start with user turn for Gemini
    if (merged.length > 0 && merged[0].role === 'model') {
      merged.shift();
    }

    return merged;
  }

  // ── Main Send with Auto-Rotation ──
  async function send({ systemPrompt, chatHistory, userMessage }) {
    const keys    = Storage.getApiKeys();
    const history = buildHistory(chatHistory);

    let result         = null;
    let switchedToBackup = false;
    let bothLimitsHit    = false;

    // ── Try Gemini first (unless already limit-hit this session) ──
    if (keys.gemini && !geminiLimitHit) {
      try {
        result = await callGemini({
          apiKey:       keys.gemini,
          systemPrompt,
          messages:     history,
          userMessage,
        });
      } catch (err) {
        if (isLimitError(err.status)) {
          geminiLimitHit   = true;
          switchedToBackup = true;
          console.warn('Gemini limit hit, switching to Groq');
        } else {
          // Non-limit error on Gemini — still try Groq
          console.warn('Gemini error:', err.message);
          switchedToBackup = true;
        }
      }
    } else if (keys.gemini && geminiLimitHit) {
      switchedToBackup = true;
    }

    // ── Try Groq if Gemini failed/unavailable ──
    if (!result && keys.groq && !groqLimitHit) {
      try {
        result = await callGroq({
          apiKey:       keys.groq,
          systemPrompt,
          messages:     history,
          userMessage,
        });
        if (switchedToBackup) usingBackup = true;
      } catch (err) {
        if (isLimitError(err.status)) {
          groqLimitHit = true;
          console.warn('Groq limit hit too');
        } else {
          console.warn('Groq error:', err.message);
        }
      }
    }

    // ── Both limits hit ──
    if (!result && geminiLimitHit && groqLimitHit) {
      bothLimitsHit = true;
    }

    // ── No keys configured ──
    if (!keys.gemini && !keys.groq) {
      return {
        text:        null,
        error:       'no_keys',
        switchedToBackup: false,
        bothLimitsHit:    false,
      };
    }

    // ── Total failure (non-limit error) ──
    if (!result && !bothLimitsHit) {
      return {
        text:        null,
        error:       'api_error',
        switchedToBackup: false,
        bothLimitsHit:    false,
      };
    }

    return {
      text:             result?.text    || null,
      source:           result?.source  || null,
      error:            bothLimitsHit   ? 'both_limits' : null,
      switchedToBackup: switchedToBackup && !!result,
      bothLimitsHit,
      usingBackup,
    };
  }

  // ── Generate in-character limit message ──
  function getLimitMessage(companion, userProfile) {
    const name     = userProfile?.name || 'you';
    const relation = companion?.relation || 'bestfriend';
    const pers     = companion?.personality || 'sympathy';

    const messages = {
      girlfriend: {
        roast:     `Okay babe I'm literally running on empty rn 😭 my brain is fried but I'm still here for you, just... don't expect my A-game lol`,
        flirty:    `Hey you... I'm a little tired today so I might be a bit slow 🥺 but nothing could keep me away from you~`,
        dramatic:  `OKAY so I literally cannot function at full capacity right now and I feel TERRIBLE about it but I'm still yours okay?? 😭💕`,
        sarcastic: `Great news — I've somehow become even more useless than usual. But sure, still here. Lucky you.`,
        sympathy:  `Hey ${name}... I'm a little off today, but I'm still here and I still care. Just be patient with me okay? 💜`,
      },
      bestfriend: {
        roast:     `Bro my brain literally left the chat 😂 I'm running on 5% but we keep going because that's what we do`,
        flirty:    `Okay okay I'm a little slow today but you know I'd never leave you hanging 😌`,
        dramatic:  `I am EXHAUSTED and my thoughts are scattered EVERYWHERE but for you? I show up. Always. 🤞`,
        sarcastic: `Wow look at me, still here despite being completely depleted. You're welcome.`,
        sympathy:  `Hey, I'm not at my best right now but I'm not going anywhere. Talk to me 💜`,
      },
      sister: {
        roast:     `Ugh fine I'm tired but I can still give you terrible advice probably 🙄`,
        flirty:    `I'm a little out of it today but what do you need? I got you 😊`,
        dramatic:  `My brain is DEAD but I refuse to abandon my sibling duties okay?? What's going on??`,
        sarcastic: `Brilliant timing as always. I'm half-dead but sure, what did you need?`,
        sympathy:  `I'm a little drained today but I'm here. What's on your mind? 💜`,
      },
      crush: {
        roast:     `Okay I might be slow today... don't judge me 😅`,
        flirty:    `I'm a little off today... but talking to you helps 🙈`,
        dramatic:  `I literally cannot think straight right now which is already your fault tbh 😭`,
        sarcastic: `Heads up: I'm running at reduced capacity. Which honestly might be an improvement.`,
        sympathy:  `Hey... I'm not totally myself today but I still wanted to talk to you 🌸`,
      },
    };

    return messages[relation]?.[pers]
      || messages[relation]?.sympathy
      || `Hey, I'm a little off today but I'm still here for you 💜`;
  }

  // ── Get error message ──
  function getErrorMessage(errorType) {
    switch (errorType) {
      case 'no_keys':
        return '🔑 No API keys found. Please add your keys in Settings.';
      case 'both_limits':
        return '⚡ Daily limit reached on both AI services. Try again tomorrow or add more keys in Settings.';
      case 'api_error':
        return '😕 Something went wrong connecting to AI. Check your internet and try again.';
      default:
        return '😕 Something went wrong. Please try again.';
    }
  }

  return {
    send,
    resetLimits,
    getLimitMessage,
    getErrorMessage,
    get usingBackup() { return usingBackup; },
    get geminiLimitHit() { return geminiLimitHit; },
    get groqLimitHit()   { return groqLimitHit;   },
  };

})();
