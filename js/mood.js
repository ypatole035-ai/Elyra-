/* ═══════════════════════════════════════
   MOOD.JS — Mood Detector + Time Awareness
   Elyra App
═══════════════════════════════════════ */

const Mood = (() => {

  // ── Negative mood keywords ──
  const SAD_WORDS = [
    'sad','crying','cry','depressed','depression','lonely','alone','hopeless',
    'worthless','empty','numb','hurt','heartbroken','devastated','miserable',
    'terrible','awful','horrible','dying inside','lost','broken','tired of',
    'give up','can\'t do this','nothing matters','hate myself','hate my life',
    'exhausted','drained','can\'t sleep','anxious','anxiety','panic','scared',
    'stressed','overwhelmed','suffocating','miss you','miss him','miss her',
  ];

  const HAPPY_WORDS = [
    'happy','excited','amazing','great','awesome','fantastic','love this',
    'so good','best day','best thing','wonderful','grateful','thankful',
    'proud','achieved','did it','passed','won','got the job','promotion',
    'can\'t stop smiling','so happy','feeling good','finally','celebrate',
  ];

  const ANGRY_WORDS = [
    'angry','furious','pissed','mad','so mad','hate','frustrated','annoyed',
    'irritated','rage','want to scream','unfair','betrayed','lied to',
  ];

  const ANXIOUS_WORDS = [
    'nervous','anxious','anxiety','panic','worried','overthinking','can\'t stop thinking',
    'what if','scared','fear','terrified','dread','tense',
  ];

  // ── Detect mood from message ──
  function detect(text) {
    const lower = text.toLowerCase();

    let scores = { sad: 0, happy: 0, angry: 0, anxious: 0, neutral: 0 };

    SAD_WORDS.forEach(w    => { if (lower.includes(w)) scores.sad++;     });
    HAPPY_WORDS.forEach(w  => { if (lower.includes(w)) scores.happy++;   });
    ANGRY_WORDS.forEach(w  => { if (lower.includes(w)) scores.angry++;   });
    ANXIOUS_WORDS.forEach(w => { if (lower.includes(w)) scores.anxious++; });

    // Find dominant mood
    const max = Math.max(...Object.values(scores));
    if (max === 0) return 'neutral';

    return Object.keys(scores).find(k => scores[k] === max) || 'neutral';
  }

  // ── Build mood context for system prompt ──
  function getMoodContext(recentMessages) {
    if (!recentMessages || recentMessages.length === 0) return '';

    // Look at last 3 user messages
    const recent = recentMessages
      .filter(m => m.role === 'user')
      .slice(-3)
      .map(m => m.text)
      .join(' ');

    const mood = detect(recent);

    const contexts = {
      sad:     `The user seems to be feeling sad or down right now. Be extra gentle, warm, and supportive. Don't try to fix or lecture — just be present and understanding.`,
      happy:   `The user seems to be in a great mood right now! Match their energy, be enthusiastic and celebrate with them.`,
      angry:   `The user seems frustrated or upset about something. Acknowledge their feelings first before anything else. Don't dismiss or minimize what they're feeling.`,
      anxious: `The user seems anxious or worried about something. Be calm, reassuring, and grounding. Don't amplify the worry.`,
      neutral: '',
    };

    return contexts[mood] || '';
  }

  // ── Check if bot should act "moody" (ignored for too long) ──
  function getBotMoodContext(companion) {
    if (!companion.lastActive) return '';

    const now       = Date.now();
    const lastActive = companion.lastActive;
    const hoursGone = (now - lastActive) / (1000 * 60 * 60);

    const relation = companion.relation;
    const personality = companion.personality;

    // Only certain relations/personalities react to absence
    if (hoursGone < 6) return ''; // less than 6 hours — no reaction

    if (hoursGone >= 48) {
      // 2+ days gone
      const reactions = {
        girlfriend: {
          dramatic:  `The user hasn't talked to you in 2+ days. You've been worried AND a little hurt. Start with a mix of relief and emotional drama that they're back.`,
          roast:     `The user ghosted you for 2 days. You're going to roast them about it immediately but then be glad they're back.`,
          sympathy:  `The user hasn't been around in 2 days. You've genuinely missed them and you're relieved they're back. Show it warmly.`,
          flirty:    `The user was gone for 2 days. Playfully act like you were just "totally fine" but make it obvious you missed them.`,
          sarcastic: `The user disappeared for 2 days. Open with dry sarcasm about their sudden reappearance.`,
        },
        bestfriend: {
          dramatic:  `Your best friend ghosted you for 2 days. Be dramatically offended but also genuinely happy they're back.`,
          roast:     `Your friend vanished for 2 days. Roast them immediately about it.`,
          sympathy:  `Your friend was gone for 2 days. You're just glad they're back and checking in on them.`,
          sarcastic: `Your friend disappeared for 2 days. Open with sarcastic commentary about their return.`,
          flirty:    `Your friend was gone 2 days. Be playfully pouty about it.`,
        },
      };
      return reactions[relation]?.[personality] || '';
    }

    if (hoursGone >= 12) {
      // 12+ hours gone
      const reactions = {
        girlfriend: `The user hasn't talked to you in over 12 hours. Subtly mention you were thinking about them.`,
        crush:      `The user hasn't talked to you in 12+ hours. You're trying to play it cool but you're happy they messaged.`,
        sister:     `Your sibling was gone all day. Ask where they've been.`,
      };
      return reactions[relation] || '';
    }

    return '';
  }

  // ── Update last active timestamp ──
  function updateLastActive(companionId) {
    Storage.updateCompanion(companionId, { lastActive: Date.now() });
  }

  // ── Inject mood into prompt ──
  function injectIntoPrompt(basePrompt, recentMessages, companion) {
    const moodCtx   = getMoodContext(recentMessages);
    const botMoodCtx = getBotMoodContext(companion);
    let extra = '';
    if (moodCtx)    extra += `\n\nUSER MOOD CONTEXT:\n${moodCtx}`;
    if (botMoodCtx) extra += `\n\nYOUR CURRENT MOOD/REACTION:\n${botMoodCtx}`;
    return basePrompt + extra;
  }

  return {
    detect,
    getMoodContext,
    getBotMoodContext,
    updateLastActive,
    injectIntoPrompt,
  };

})();
