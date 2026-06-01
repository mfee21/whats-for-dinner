# What's For Dinner — Project Planning Document

> **How to use this doc:** Paste the contents into Claude Code at the start of every session.
> It gives the AI full context so you don't have to re-explain decisions.
> Update the "Current phase" and "Decision log" sections as you go.

---

## Project overview

**What it is:** A family meal planning web app. Upload or paste any recipe — from a photo,
URL, or raw text — and Claude extracts structured ingredients and step-by-step instructions
automatically. Plan meals for the week, auto-generate shopping lists, and get AI-powered
meal suggestions.

**Why it exists (personal):** Built for real use — my wife and I planning dinners for two adults,
with the option to expand for kids later.

**Why it exists (professional):** A portfolio showcase demonstrating full-stack development,
thoughtful AI integration, and the kind of rigorous decision-making that comes from
a QA engineering background. Every architecture decision in this project is documented
so it can be discussed in interviews.

**Repo:** `github.com/mfee21/whats-for-dinner` (public)

---

## Target roles

The roles I am building toward are at the intersection of AI systems and quality/validation:

- **Agentic solutions architect / AI implementation specialist** — roles where you plan,
  build, guide, and validate agentic AI solutions for businesses
- **AI QA / Evaluation engineer** — a fast-growing, undersupplied specialty; people who
  can design test strategies for non-deterministic AI systems
- **Full-stack developer with AI integration experience**

**The narrative this project supports:** I have 10+ years of QA engineering experience
(Playwright/TypeScript, WebdriverIO, Selenium/C#, Postman/API testing, CI/CD). I am now
building real AI-integrated products from scratch — demonstrating that I can move from
*validating* systems to *building and validating* them. This project is proof of that transition.

**My edge over other candidates:** Most developers can call an AI API. Very few can also
think rigorously about whether the AI is doing the right thing, write tests for non-deterministic
behavior, and articulate *why* a system is trustworthy. That combination is rare and valuable.

---

## Tech stack

| Layer | Technology | Why this choice |
|---|---|---|
| Frontend | React + Vite | Industry standard; widely recognized in job applications; fast dev experience |
| Styling | Tailwind CSS | Practical, modern, shows CSS competency without framework lock-in |
| Backend/DB | Supabase (free tier) | Postgres + Auth + REST API with zero infrastructure overhead; scales if needed |
| Serverless functions | Vercel Edge Functions | Keeps secrets server-side; free tier; auto-deploys from GitHub |
| AI | Anthropic Claude API | Haiku for low-cost ops; Sonnet for suggestions; cached in Supabase to minimize spend |
| Calendar | Google Calendar API | OAuth integration; free; impressive on a portfolio |
| Version control | GitHub (public repo) | Portfolio visibility; CI/CD via Vercel |
| Testing | Playwright (later phases) | Leverages existing QA expertise; demonstrates AI agent validation thinking |

**Cost target:** Under $2/month in API spend at normal family usage.

**AI cost strategy:** Cache all Claude responses in Supabase. Re-use cached suggestions
unless the recipe library has changed. Only call Sonnet for the "suggest new meals" feature;
use Haiku for everything else (ingredient parsing, shopping list deduplication, etc.).

---

## Data model

```
recipes
  id           uuid PK
  user_id      uuid FK → auth.users
  name         text
  ingredients  jsonb        -- [{ name, amount, unit }]
  instructions text
  tags         text[]       -- e.g. ['quick', 'vegetarian', 'grillable']
  rating       int          -- 1–5, family rating after cooking
  notes        text         -- free-form family notes ("add more garlic next time")
  created_at   timestamptz
  updated_at   timestamptz

meal_plans
  id           uuid PK
  user_id      uuid FK → auth.users
  recipe_id    uuid FK → recipes
  planned_date date
  meal_slot    text         -- 'dinner' (expand to breakfast/lunch later)
  calendar_event_id text   -- Google Calendar event ID for sync
  created_at   timestamptz

shopping_list_cache
  id           uuid PK
  user_id      uuid FK → auth.users
  week_start   date
  items        jsonb        -- aggregated + deduplicated ingredient list
  generated_at timestamptz
```

**Row-level security:** All tables locked to `auth.users.id = user_id`.
No user can read another user's data.

---

## Feature phases

### Phase 1 — Foundation ✅ TODO
- [ ] Project scaffold: Vite + React + Tailwind
- [ ] Supabase project created, schema applied
- [ ] Auth: email/password login (Supabase Auth)
- [ ] Recipe library: list view, add recipe form
- [ ] Deploy to Vercel (even if empty)

**Why this order:** Get something live and deployed on day one.
A deployed URL is more impressive than local code.

### Phase 2 — Recipe ingestion (AI extraction)
- [ ] Vercel edge function: `/api/parse-recipe`
- [ ] Input method 1: paste raw text (copied from any website or cookbook)
- [ ] Input method 2: paste a URL (fetch page text server-side, send to Claude)
- [ ] Input method 3: upload a photo (send image to Claude vision)
- [ ] Claude extracts: recipe name, ingredients `[{ name, amount, unit }]`, and numbered steps
- [ ] User reviews the extracted result and can edit before saving
- [ ] Saves into the `recipes` table on confirm

**Why Claude here:** Extraction from unstructured text/images is exactly what LLMs are
genuinely good at. This is not AI for AI's sake — it removes the biggest friction point
in building a recipe library (manual data entry).

**Why a review step before saving:** AI extraction is not 100% reliable. Giving the user
a chance to correct before saving means bad data never enters the database. This is a
deliberate quality gate — and a good thing to talk about in interviews from a QA mindset.

**Input priority for build order:** Start with paste-text (simplest, no extra APIs),
then URL fetch, then photo upload (requires multipart form handling).

**Portfolio talking point:** "I built a human-in-the-loop review step because I know
AI output needs validation — that instinct comes directly from my QA background."

### Phase 3 — Meal planner
- [ ] Weekly calendar view (Sun–Sat grid)
- [ ] Drag recipe onto a day
- [ ] Swap meal / remove meal
- [ ] Random meal picker ("I don't know, surprise me")

**Why before AI:** Proves core product value without any API cost.
All logic is deterministic — good for testing.

### Phase 4 — Shopping list
- [ ] Aggregate ingredients from the week's meal plan
- [ ] Deduplicate and combine (e.g. 2× "garlic clove" entries → "4 garlic cloves")
- [ ] Render as interactive checklist
- [ ] Cache result in `shopping_list_cache`

**Why before AI:** Still deterministic. No API cost. Very useful feature.
The deduplication logic is a good algorithmic challenge to discuss in interviews.

### Phase 5 — AI meal suggestions
- [ ] Vercel edge function: `/api/suggest`
- [ ] Send Claude: current recipe library + this week's plan + household preferences
- [ ] Claude suggests 3 meals not already in the week's plan
- [ ] Cache suggestion in Supabase (invalidate when recipe library changes)
- [ ] "Refresh suggestions" button (re-calls API)

**Why Claude here:** This is where AI adds genuine value — contextual, personalized
suggestions based on *your* recipe library. Not generic recipe search.

**Portfolio talking point:** "I designed the caching layer so the AI only runs when
the underlying data changes — keeping costs near zero and response time fast."

### Phase 6 — Google Calendar sync
- [ ] OAuth 2.0 flow (Google)
- [ ] Push meal plan as all-day calendar events
- [ ] Update/delete events when plan changes

**Why this matters for the portfolio:** Most developers skip the OAuth + external API
integration. Finishing this signals you complete projects.

### Phase 7 — Testing layer (QA showcase)
- [ ] Playwright e2e tests for core user flows
- [ ] Tests for AI suggestion feature (mock Claude API, test UI behavior)
- [ ] GitHub Actions CI: run tests on every PR
- [ ] Document: "How do you test a non-deterministic AI feature?"

**Why this phase exists:** This is the QA-to-AI narrative made concrete.
A written doc in the repo explaining your approach to testing AI features is
genuinely rare and will be a conversation starter in every interview.

---

## Portfolio strategy

### What to make public
- The entire `whats-for-dinner` repo should be **public**
- Include a detailed README (see README guidelines below)
- Keep `.env` files out of the repo (Vercel handles secrets)

### What to keep private / separate
- Any experimental side branches or personal data scripts
- If you build other portfolio projects, keep them in separate repos

### The README is your cover letter
The README should tell the story of *why* decisions were made, not just *what* was built.
Include:
- A live demo link (your Vercel URL)
- A 1-paragraph project description
- A "Why I built it this way" section covering 3–4 key decisions
- A "What I'd do differently" section (shows self-awareness, interviewers love this)
- Screenshots or a short GIF of the app in use

### Commit discipline (important for portfolio visibility)
- Commit often, with clear messages: `feat: add recipe list view`, `fix: dedupe shopping list`
- Never commit secrets or `.env` files
- Use conventional commit format — it looks professional on GitHub
- Consider writing a brief commit message body explaining *why* on significant changes

### The "decision log" section below
Every time you make a significant technical decision, add it here.
In interviews, you will be asked "why did you choose X over Y?"
This document is your answer.

---

## Guardrails — scope boundaries

These features are explicitly OUT OF SCOPE until all 6 phases are complete:

- ❌ Kids' meal tracking (add later — keep scope tight)
- ❌ Nutrition/calorie tracking
- ❌ Social features / sharing recipes with others
- ❌ Mobile app / React Native
- ❌ Multiple household members with separate logins

> Recipe import (URL, photo, paste) is **in scope** as Phase 2 — do not expand it
> beyond the three input methods listed there until all other phases are complete.

**When you feel the urge to add a feature outside this list, write it down in
"Future ideas" below instead of building it. Then come back to the current phase.**

---

## Decision log

*Add entries here whenever a significant technical decision is made.
Format: date · decision · why.*

| Date | Decision | Why |
|---|---|---|
| 2026-05-31 | Chose Supabase over Firebase | Postgres is more transferable to enterprise environments; SQL is more universally understood in interviews; free tier is generous |
| 2026-05-31 | Chose Vercel edge functions over a full Express backend | No infrastructure to maintain; auto-deploys from GitHub; sufficient for this app's API surface |
| 2026-05-31 | Cache Claude API responses in Supabase | Keeps monthly cost under $2; faster response for repeat views; teaches cache invalidation patterns |
| 2026-05-31 | Added recipe ingestion as Phase 2 | Core feature — without easy recipe entry the library never gets populated; AI extraction removes the biggest friction point |
| 2026-05-31 | Added human review step before saving extracted recipes | AI extraction is fallible; a review gate prevents bad data entering the DB; reflects QA instinct |

---

## Future ideas (parking lot)

*Things that came to mind but are out of scope for now. Revisit after Phase 7.*

- Photo of fridge → Claude suggests meals from what's visible
- Kids' section with separate simpler meal plans
- Pantry tracker (what do we already have?)
- Weekly email digest with the meal plan

---

## Session startup prompt for Claude Code

*Copy-paste this at the start of every Claude Code session:*

```
I'm building "What's For Dinner" — a family meal planning web app.
Here is my full project plan: [paste this document]

Current phase: [FILL IN CURRENT PHASE]
What I want to accomplish this session: [FILL IN GOAL]
Last thing I completed: [FILL IN OR "starting fresh"]

Please review the plan and confirm you understand the stack and constraints
before we begin. If I suggest anything outside the current phase scope,
remind me of the guardrails.
```

