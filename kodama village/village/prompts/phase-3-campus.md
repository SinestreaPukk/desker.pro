# Kodama Village, Phase 3: Campus (after Phase 2 passes its gate)

Phases 0–2 are done, and village students stay on Desker longer than planner-only students. Phase 3 grows Kodama Village from friend groups to a campus:

- Public faculty study halls, so no one studies alone
- A Garden that records each student's degree
- Campus-wide events
- **Course intelligence**: anonymous data from many villages that gives every new student a realistic plan on day one
- Revenue, without breaking the "Leaves are earned only by studying" rule

Read `docs/village/SPEC.md` in full, including its **Status** section, before starting. The spec is the source of truth. If this prompt conflicts with it, or the code conflicts with either, stop and ask.

## Principles for this phase
- **Public spaces need stricter safety than private villages.** Ship moderation before the halls open.
- **Course data is aggregated and anonymous, or it isn't shown.** Never show data from fewer than 5 distinct students. Never reveal which village or person it came from.
- **Money buys looks and space, never advantage.** Leaves can't be bought. Focus rewards can't be bought. Nothing paid affects studying or the planner.
- **Don't make the free product worse to sell the paid one.** Everything from Phases 0–2 stays free.

## Gates to watch during this phase
- Students who use public halls but have no village become village members within 4 weeks (halls are a way in, not a replacement).
- Course intelligence improves first-week plan accuracy for new students (measured by Rhythm's "how close the plans were").
- Paying users ≥ 2% of monthly active village users, with no drop in free-user retention.

---

## Checkpoint 0: Review and plan (no code)

1. Read the code and the Status section; list anything to fix first.
2. Propose migrations for `village_public_hall`, `village_course_stat`, `village_purchase` and `village_entitlement` (SPEC §9), plus anything else this phase needs (moderator role, hall shard table, events).
3. **Public hall scaling plan:** sharding (instances of the same hall), how players are assigned to a shard (with friends first), and the capacity per shard after a load test.
4. **Payments.** Compare providers that work well for Thai students and Thai baht:
   - Opn Payments (Omise)
   - Stripe
   - PromptPay QR support
   - Card and mobile banking options
   - App-store rules if the village is ever wrapped as a native app

   Recommend one. All development uses the provider's **test mode** and test keys from env vars only.
5. **Privacy and legal checklist** for course intelligence and payments under Thailand's PDPA (what notice text changes, what consent is needed, data retention). Draft the text for me to review; don't publish it.
6. **Decisions to confirm** list (moderator staffing, prices, which faculties first, university email verification or not).

**Stop and wait for my approval.**

---

## Checkpoint 1: Moderation at scale (before anything public)

- **Moderator role** (Desker staff + trusted student volunteers): can act in any public hall.
- **Report queue dashboard** (`/admin/reports`, Desker admins + moderators only):
  - Filters
  - Context (chat log lines, reported text, reporter and target history)
  - Actions: dismiss, warn, mute 1 h / 24 h, ban from public halls, ban from Desker (admins only)
  - Every action written to the audit log
- **Automatic safety:**
  - 3 reports from different users within 10 minutes → automatic 30-minute mute in public halls, pending review.
  - New accounts (< 7 days, or no valid focus sessions) can't post in public halls for their first 24 h; they can still walk, sit, emote and study.
  - Links are not clickable in public halls.
- **Appeals:** a muted or banned user sees why and can send one appeal message to the queue.
- Optional verified university email (e.g. a `chula.ac.th` address via a one-time code) unlocks posting in that university's halls immediately and shows a small "verified" mark. Confirm with me in Checkpoint 0.

**Tests:**
- Auto-mute thresholds
- New-account limits
- Moderator permissions can't touch private villages

---

## Checkpoint 2: Public faculty study halls ⏸ STOP AND LET ME TEST

- **Hall** = a public village run by Desker for a faculty or a university-wide space (e.g. "Medicine Study Hall", "Engineering Study Hall", "Chula Library Hall"). Discover them from the village picker → **Study halls**.
- **Map:**
  - A larger "Grand Library" template: one big quiet hall with 80+ desks, a small Board plaza, a Lounge and an entrance garden.
  - Focus is on by default inside. Bubbles only work in the Lounge.
- **Shards:**
  - Each hall runs as several instances (capacity confirmed by load test; start at 80).
  - Joining puts you in the shard with the most of your friends, otherwise the fullest shard below 80%.
  - The picker shows "312 studying in Medicine Hall now".
- **Privacy in halls:**
  - Status defaults to "Studying" only, regardless of your village setting.
  - Name tags show display name only.
  - No knock from strangers (friends only, i.e. people who share a village with you).
  - No follow for strangers.
- **Hall Board:** run by moderators and Desker. University-wide dates (exam weeks, registration deadlines, holidays), plus a "Study tips" announcement. No member posts.
- **Ambient kodama helpers.** When a shard has fewer than 10 people, a few NPC kodamas sit at desks studying:
  - Clearly marked with a leaf badge and "Kodama helper" on hover.
  - They never chat or pretend to be people.
  - They exist only so the hall never feels empty.
- A gentle bridge to villages: after 3 hall visits, the Kodama NPC suggests "Study with your friends? Create a village or ask for an invite." It shows at most once a week.

**Stop here** and tell me how to load-test one hall with 3 shards and how to try it as two different users.

---

## Checkpoint 3: The Garden and course trees

- When a student finishes a course in Desker (course end date passed, or marked done), a **course tree** is planted in their personal garden plot. The plot is visible in each of their villages' Garden zones.
  - The species depends on the faculty or subject area (configurable mapping).
  - Tree size depends on valid focus minutes logged on that course.
  - A small wooden plaque shows the course code and semester (only if the student allows it).
- Village Garden view: all members' plots side by side. A semester summary sign: "This semester our village grew 23 trees".
- Hovering or tapping a tree shows course code, semester and hours, per the owner's sharing setting.
- Past monthly goal saplings from Phase 2 move here too.
- Trees can't be bought; they only grow from studying.

---

## Checkpoint 4: Events

- **Village crunch events** (owner/admin schedules them from the Board):
  - "Crunch night": a series of group sessions (e.g. 3 × 50/10) with a start time.
  - Members get one notification 30 minutes before.
  - **Gentle midnight stop:** at 00:00 local, kodamas yawn, the Kodama NPC says "Sleep is part of studying. See you tomorrow", and new sessions can't be started in that event.
- **Campus events** (run by Desker in halls), e.g. an exam-season "Snow Festival":
  - A shared campus-wide focus goal across all halls and villages.
  - A festival decoration set placed in halls.
  - A free, earn-only cosmetic for participants with 5+ valid sessions during the event.
- Event schedule config + admin UI to create, edit and cancel events. Events never create pressure messages ("only 2 hours left!"); the tone stays calm.

---

## Checkpoint 5: Course intelligence

**Goal:** a new student adding "DTIP 122 lab report" sees a realistic plan straight away, based on how long classmates actually took, before Desker has learned anything about them.

- **Data sources:**
  - Valid Desker focus sessions linked to tasks or deadlines, from **all** Desker users, not only village members (with the consent rules below)
  - Board items across villages, for dates
- **Matching:** course code (normalised) + item key (normalised title + kind, with simple synonym rules, e.g. "lab rep", "lab report", "รายงานแล็บ"). Unmatched items are ignored.
- **Nightly aggregation job** writes `village_course_stat` with:
  - n (distinct students)
  - Median and 80th-percentile total minutes
  - Typical start: median days before the due date that work began
  - Updated_at
- **k-anonymity:** a stat is only published when **n ≥ 5 distinct students from at least 2 different villages, or non-village users**. Never store or show which students, villages or sessions contributed.
- **Where it shows:**
  - **Board item:** a small line, "Classmates usually spend ~3.5 h · most start 4 days before"
  - **Desker planner** (behind a flag, in the desker.dev code): use the median as the starting estimate for a new student's task when they have little Rhythm data yet, labelled "based on classmates"
  - **Kodama NPC tip** when a deadline is added: "Students usually start this 4 days early. Want me to plan it?"
- **Consent and control:**
  - A clear notice and a setting, "Help classmates with anonymous time data" (on by default only if the PDPA review in Checkpoint 0 says that's acceptable; otherwise off with a friendly ask).
  - Turning it off removes that user's data from the next aggregation.
- **Quality checks:**
  - Ignore outliers (outside 5–95th percentile).
  - Recompute nightly.
  - Show nothing rather than something misleading when data is thin.

**Tests:**
- k-anonymity enforcement
- Opt-out removal
- Title normalisation and synonyms (English and Thai)
- Outlier trimming
- A stat never reveals a single student's numbers

---

## Checkpoint 6: Revenue (test mode only)

- **Products** (prices confirmed in Checkpoint 0; amounts stored in satang, currency THB):

| Product | What it gives | Type |
|---|---|---|
| Decor packs | A themed set of 10–15 decor items (e.g. "Kyoto Spring", "Café Corner", "Starry Night") | One-time purchase |
| Kodama style packs | Cosmetic sets for the wardrobe | One-time purchase |
| Village Plus | Up to 100 members, 2 extra rooms, custom village banner and colours, 7-day chat log | Monthly or per-semester subscription, bought by the owner (members can chip in later) |

- **Rules:**
  - **Leaves can't be bought, and nothing paid gives Leaves.** Paid packs are separate from the Leaves shop.
  - Earn-only cosmetics stay earn-only.
  - Free villages keep every Phase 0–2 feature. If a Village Plus subscription ends, extra rooms are hidden (not deleted), and members above 50 keep access but no new members can join until it's under the limit.
- **Checkout** with the approved provider in **test mode**:
  - Server creates the payment.
  - The provider's webhook confirms it.
  - Write `village_purchase` + `village_entitlement` in one transaction.
  - Entitlements are checked **on the server** (API and room) before unlocking anything.
  - Webhook signatures verified. Payments are idempotent (a retry never charges or grants twice).
- **Receipts** by email (via Desker's existing email provider, if any) and a Purchases page. Refund handling via webhook: remove the entitlement; placed items go back to inventory, greyed out.
- Never store card details or payment credentials. Keys come from env vars only, test keys in development.

**Tests:**
- Webhook idempotency
- Entitlement checks
- Subscription expiry behaviour
- Refund
- Leaves can't be credited by any payment path

---

## Checkpoint 7: Scale, reliability and cost

- Latency for Thai users: confirm the realtime host serves Southeast Asia from a nearby region. Measure p95 from Bangkok.
- Load tests:
  - 3 public halls × 5 shards × 80 users
  - 500 private villages × 5 users idle-focusing

  Report cost per 1,000 weekly active students.
- Observability dashboards:
  - Rooms open
  - Connections
  - Message rates
  - p95 latency
  - Errors by client version
  - Webhook failures
  - Aggregation job runs
- Global rate limits and abuse detection (many accounts from one IP joining halls).
- DB maintenance: archive old chat/audit/event rows, check index usage, and plan backups and restore tests.

---

## Checkpoint 8: Admin and business dashboard

`/admin/village` (Desker admins only):

- **North-star:** minutes studied together per active student per week, trend
- **Retention cohorts:** village vs hall-only vs planner-only
- Hall → village conversion
- **Course intelligence:** courses covered (n ≥ 5), first-week plan accuracy for new students with vs without it
- **Revenue:** purchases, active Village Plus, refunds, revenue per active village
- **Safety:** reports per 1,000 active users, time to resolve, auto-mutes

Update the Status section of `docs/village/SPEC.md`.

---

## Demo script
1. Open the Medicine Study Hall at a busy time and get placed in the shard with a friend.
2. A brand-new account tries to post in the hall and is limited. A verified account can post.
3. File a report. Watch it appear in the moderator queue, then mute from there.
4. Add a DTIP 122 deadline in a village and see the classmates' estimate line (with seeded test data from 5+ test users).
5. Turn off "Help classmates with anonymous time data" and confirm that user drops out of the next aggregation.
6. Buy a decor pack and Village Plus in test mode. Confirm webhook retries don't double-grant, and that a refund removes the entitlement.
7. Run a crunch night and watch the gentle midnight stop.

## When you finish, report back with
1. What was built, and anything simplified or flagged off.
2. The PDPA notice and consent text drafts for my review.
3. Payment setup steps for me (provider account, webhooks, live keys), without going live.
4. Load-test results and cost per 1,000 weekly active students.
5. Known issues, risks, and what you'd do next.
