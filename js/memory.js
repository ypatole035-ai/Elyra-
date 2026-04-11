/* ═══════════════════════════════════════
   MEMORY.JS — Memory & Summary System
   Elyra App
═══════════════════════════════════════ */

const Memory = (() => {

  const SUMMARY_EVERY = 20; // summarize every N messages

  // ── Extract pinned facts from a message ──
  // Simple keyword-based extraction for important personal info
  function extractFacts(text, userName) {
    const facts = [];
    const lower = text.toLowerCase();

    // Name mentions
    const nameMatch = text.match(/(?:my name is|call me|i'm|i am)\s+([A-Z][a-z]+)/i);
    if (nameMatch) facts.push({ key: 'real name', value: nameMatch[1] });

    // Age
    const ageMatch = text.match(/i(?:'m| am) (\d{1,2}) years? old/i) || text.match(/my age is (\d{1,2})/i);
    if (ageMatch) facts.push({ key: 'age', value: ageMatch[1] + ' years old' });

    // Location
    const locMatch = text.match(/i(?:'m| am) from ([A-Z][a-zA-Z\s]+)/i) || text.match(/i live in ([A-Z][a-zA-Z\s]+)/i);
    if (locMatch) facts.push({ key: 'location', value: locMatch[1].trim() });

    // Job / study
    const jobMatch = text.match(/i(?:'m| am) (?:a |an )?([a-z]+ (?:developer|engineer|student|teacher|doctor|designer|manager|artist|writer|nurse|chef))/i);
    if (jobMatch) facts.push({ key: 'occupation', value: jobMatch[1] });

    const studyMatch = text.match(/i(?:'m| am) (?:studying|a student (?:of|at))\s+([a-zA-Z\s]+)/i);
    if (studyMatch) facts.push({ key: 'studying', value: studyMatch[1].trim() });

    // Hobby / interest
    const hobbyMatch = text.match(/i (?:love|like|enjoy|am into)\s+([a-zA-Z\s]+)/i);
    if (hobbyMatch && hobbyMatch[1].length < 40) {
      facts.push({ key: 'likes', value: hobbyMatch[1].trim() });
    }

    // Feeling / mood
    const feelMatch = text.match(/i(?:'m| am| feel) (?:feeling )?(very |really |so )?(sad|happy|stressed|anxious|excited|tired|depressed|lonely|bored|angry|frustrated|overwhelmed)/i);
    if (feelMatch) facts.push({ key: 'recent mood', value: feelMatch[2] || feelMatch[1] });

    // Pet
    const petMatch = text.match(/(?:my|i have a?) (dog|cat|pet|puppy|kitten) (?:named?|called)?\s*([A-Z][a-z]+)?/i);
    if (petMatch) facts.push({ key: 'pet', value: `${petMatch[1]}${petMatch[2] ? ' named ' + petMatch[2] : ''}` });

    return facts;
  }

  // ── Process a new message for memory ──
  function processMessage(companionId, messageText, role) {
    if (role !== 'user') return; // only extract from user messages

    const facts = extractFacts(messageText);
    facts.forEach(f => {
      Storage.addPinnedFact(companionId, f.key, f.value);
    });
  }

  // ── Check if summary is needed ──
  function needsSummary(companionId) {
    const history = Storage.getChatHistory(companionId);
    const memory  = Storage.getMemory(companionId);
    const coveredUpTo = memory.summaryUpTo || 0;
    const uncovered   = history.length - coveredUpTo;
    return uncovered >= SUMMARY_EVERY && history.length > SUMMARY_EVERY;
  }

  // ── Generate summary via API ──
  async function generateSummary(companionId, apiKeys) {
    const history     = Storage.getChatHistory(companionId);
    const memory      = Storage.getMemory(companionId);
    const coveredUpTo = memory.summaryUpTo || 0;

    // Messages to summarize (older ones not yet summarized)
    const toSummarize = history.slice(coveredUpTo, history.length - 10);
    if (toSummarize.length < 5) return; // not enough to summarize

    const convo = toSummarize.map(m =>
      `${m.role === 'user' ? 'User' : 'Companion'}: ${m.text}`
    ).join('\n');

    const prompt = `Summarize this conversation in 3-5 sentences. Focus on key facts shared, emotional moments, and important topics discussed. Be concise and factual.\n\nConversation:\n${convo}\n\nSummary:`;

    try {
      let summaryText = '';

      // Try Gemini first
      if (apiKeys.gemini) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${apiKeys.gemini}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }

      // Fallback to Groq
      if (!summaryText && apiKeys.groq) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeys.groq}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          summaryText = data?.choices?.[0]?.message?.content || '';
        }
      }

      if (summaryText) {
        // Combine with existing summary
        const existing = memory.summary ? memory.summary + '\n\nLater: ' : '';
        Storage.saveMemory(companionId, {
          ...memory,
          summary:      existing + summaryText.trim(),
          summaryUpTo:  history.length - 10,
        });
      }
    } catch (err) {
      console.warn('Summary generation failed:', err);
    }
  }

  // ── Get memory context string for display ──
  function getMemoryDisplay(companionId) {
    const memory = Storage.getMemory(companionId);
    return {
      pinned:  memory.pinned  || [],
      summary: memory.summary || '',
    };
  }

  return {
    processMessage,
    needsSummary,
    generateSummary,
    getMemoryDisplay,
    extractFacts,
  };

})();
