# Signal — Real-Time Interview Copilot

Next.js architecture: **Web Audio mic chunks → Deepgram STT → GPT-4o coach → SSE talking points**, with a glassmorphic dual-panel HUD.

## Architecture

```
[ Browser / Client ]
  useAudioCapture (Web Audio API)
    └── 16 kHz mono PCM windows (~1.8s)
          │
          ▼ POST /api/live { audioBase64, sttOnly: true }
          │     Deepgram STT → transcript
          ▼
  useInterviewCopilot (Vercel AI SDK useCompletion)
          │
          ▼ POST /api/copilot  { prompt, resume… }
[ Next.js + AI SDK ]
  streamText(gpt-4o) → toTextStreamResponse()
          │
          ▼ token stream → StreamingSuggestions HUD
```

### SSE events from `/api/live`

| Event | Payload |
| --- | --- |
| `status` | `{ stage: "stt" \| "coaching" \| … }` |
| `transcript` | `{ text, isFinal }` |
| `token` | `{ text }` streaming model tokens |
| `bullet` | `{ text }` (mock / progressive) |
| `result` | `{ title, bullets[] }` |
| `error` / `done` | terminal |

## App routes

| Path | Purpose |
| --- | --- |
| `/` | Resume + job description upload |
| `/session` | Live HUD (transcript ‖ AI bullets) |
| `/dashboard` | Post-interview history & scores |
| `POST /api/live` | Audio → STT → coach SSE |
| `POST /api/review` | End-of-session summary + score |
| `POST /api/transcription` | Optional Deepgram browser token |
| `POST /api/copilot` | Text-only coach SSE (legacy/helper) |

## Key modules

```
src/
├── hooks/
│   ├── useAudioCapture.ts   # Web Audio → PCM chunks/windows
│   └── useLiveCopilot.ts    # POST /api/live + SSE consumer
├── app/api/live/route.ts    # Deepgram + GPT-4o + SSE
├── components/copilot/
│   ├── AudioVisualizer.tsx
│   ├── LiveTranscriptFeed.tsx
│   └── ActionCardGrid.tsx
└── lib/
    ├── deepgram.ts
    ├── llm.ts
    └── prompts.ts           # INTERVIEW_COACH_SYSTEM
```

## Setup

```bash
npm install
cp .env.example .env.local
# set DEEPGRAM_API_KEY + OPENAI_API_KEY as needed
npx prisma migrate dev   # applies SQLite schema to prisma/dev.db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

- Local: SQLite via `DATABASE_URL="file:./dev.db"` → `prisma/dev.db`
- Prisma 6 (`prisma migrate` / `prisma generate`)
- Client helper: `src/lib/prisma.ts`

```bash
npm run db:migrate   # create/apply migrations
npm run db:studio    # browse data
```

### Auth (Auth.js / NextAuth v5)

- Config: `src/auth.ts` (Prisma adapter + Google + Email/Nodemailer)
- Route: `src/app/api/auth/[...nextauth]/route.ts`
- Protection: `src/proxy.ts` guards `/dashboard` and `/session`
- Sign-in UI: `/login`

```bash
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM="Signal <noreply@yourdomain.com>"
```

Without API keys you can still type questions in the live HUD — coaching falls back to local heuristics; STT requires Deepgram for mic windows.

### Desktop companion (Tauri)

```bash
npm run tauri:dev          # HUD against localhost:3000
npm run tauri:build:dmg    # macOS .app + .dmg (+ .sig with updater key)
npm run tauri:build:msi    # Windows .msi + NSIS (on Windows)
```

Signing, notarization, and GitHub Actions release tagging: [docs/desktop-release.md](docs/desktop-release.md).  
CI secrets checklist: [docs/github-release-secrets.md](docs/github-release-secrets.md).
