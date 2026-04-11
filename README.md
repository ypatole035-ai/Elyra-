# 💜 Elyra
### *Create who you connect with.*

Elyra is a free, open-source AI companion web app. Create personalised AI companions with different relationships and personalities — and chat with them like real people.

---

## ✨ Features

- **4 Relations** — Girlfriend, Best Friend, Sister, Crush
- **5 Personalities** — Sympathy Mode, Sarcastic, Flirty, Dramatic, Roast Machine
- **Smart Memory** — Remembers facts about you across conversations
- **Mood Detection** — Detects your mood and adjusts responses
- **XP & Levels** — Your bond grows the more you chat
- **Personality Switch** — Change vibes mid-conversation
- **App Lock** — Optional 4-digit PIN protection
- **Multiple Companions** — Create and switch between different companions
- **Free AI** — Uses Gemini + Groq free APIs with auto-rotation

---

## 🚀 Getting Started

### 1. Get Free API Keys

| Service | Link | Free Limit |
|---|---|---|
| **Gemini 2.5 Flash-Lite** (Primary) | [aistudio.google.com](https://aistudio.google.com/app/apikey) | 1,000 req/day |
| **Gemini 2.5 Flash** (Secondary) | Same key, auto-used | 250 req/day |
| **Groq Llama 3.1** (Backup) | [console.groq.com/keys](https://console.groq.com/keys) | 14,400 req/day |

No credit card required for either. ✅

### 2. Deploy to GitHub Pages

```bash
# 1. Fork or clone this repo
git clone https://github.com/YOUR_USERNAME/elyra.git

# 2. Push to your GitHub repo
git add .
git commit -m "Initial commit"
git push origin main

# 3. Enable GitHub Pages
# Go to: Settings → Pages → Source → Deploy from branch → main → / (root)
# Your app will be live at: https://YOUR_USERNAME.github.io/elyra/
```

### 3. Open & Setup

1. Open your GitHub Pages URL
2. Enter your API keys (stored only on your device 🔒)
3. Set up your profile
4. Create your first companion
5. Start chatting 💜

---

## 🤖 AI Models Used

```
Primary:   Gemini 2.5 Flash-Lite  → 15 RPM, 1,000/day  (fastest free)
Secondary: Gemini 2.5 Flash       → 10 RPM, 250/day    (auto-fallback)
Backup:    Groq Llama 3.1 8B      → 30 RPM, 14,400/day (when Gemini hits limit)
```

When the primary model hits its daily limit, Elyra automatically switches to the next one — and tells your companion to deliver the news in-character. 😄

---

## 🗂 Project Structure

```
elyra/
├── index.html          → API key setup (first launch)
├── onboarding.html     → 4-step companion creation
├── home.html           → Companions list
├── chat.html           → Main chat screen
├── settings.html       → Settings, keys, PIN lock
├── pin.html            → PIN lock screen
├── css/
│   ├── base.css        → Design system & variables
│   ├── components.css  → Reusable UI components
│   └── screens.css     → Per-screen layouts
└── js/
    ├── storage.js      → All localStorage operations
    ├── app.js          → Router, utilities, guards
    ├── prompt.js       → System prompt builder
    ├── memory.js       → Memory & summary system
    ├── mood.js         → Mood detection & awareness
    └── api.js          → Gemini + Groq with auto-rotation
```

---

## 🔒 Privacy

- All data (chat history, memories, API keys) is stored **only on your device** using `localStorage`
- API keys go **directly** from your browser to Google/Groq — never through any third-party server
- No accounts, no tracking, no ads

---

## 📱 Android (Coming Soon)

Elyra is built with plain HTML/CSS/JS — ready to be wrapped with Capacitor for Android:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init Elyra com.elyra.app
npx cap add android
npx cap sync
npx cap open android
```

---

## 🗺 Roadmap

### v1.0 (Current)
- [x] Core chat with Gemini + Groq
- [x] 4 relations × 5 personalities
- [x] Memory system (pinned facts + AI summary)
- [x] Mood detection
- [x] XP / relationship levels
- [x] Multiple companions
- [x] PIN lock

### v2.0 (Planned)
- [ ] Voice messages (text-to-speech)
- [ ] More relations (Mother, Father, Mentor, Rival)
- [ ] More personalities
- [ ] Cloud sync
- [ ] Android app on Play Store
- [ ] Daily challenges & achievements

---

## 📄 License

MIT — free to use, modify, and distribute.

---

*Made with 💜 — Elyra. Create who you connect with.*
