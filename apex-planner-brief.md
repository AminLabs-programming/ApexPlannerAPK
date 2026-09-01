[8/31/2026 10:57 PM] 𝕄𝕠𝕙𝕒𝕞𝕞𝕒𝕕𝕒𝕞𝕚𝕟: PROJECT: اپکس پلنر (Apex Planner) — Konkur Study Assistant
A shared, small-group (classmates) Persian-language (Farsi, RTL) study-planning
Progressive Web App for students preparing for Iran's national university
entrance exam (Konkur). Built as a mobile-first, single-column PWA
(max content width ~520px, portrait). Currently a vanilla-JS app with no
build step, styled via CSS custom properties — treat this as a small,
premium, focused utility product for a close-in-group of users, NOT an
enterprise or public consumer app.

TARGET USERS: A small group of high-school students (and one designated
group admin among them) actively studying for the Konkur exam together,
using this app daily to plan study sessions, run focus timers, log a
personal question bank, track exam performance, and review annotated PDF
exam booklets.

=== FULL SCREEN INVENTORY (design ALL of these — do not stop at Home/Login) ===
1. Splash / Brand Intro — new addition; a short cinematic Faravahar brand
   reveal shown once at launch before the login screen.
2. Login — segmented ورود/ثبت‌نام (Login/Register) toggle, username +
   password fields, register mode adds a display-name field, "forgot
   password" link, primary CTA.
3. Register — same shell as Login, toggled via the segmented control.
4. Forgot Password — step 1: username entry, sends a 6-digit recovery code
   via a linked Telegram bot. Step 2: 6-digit code + new password fields.
5. Home (Dashboard) — personalized greeting; 2x2 stat-card grid showing
   daily goal hours, minutes studied today, a circular progress ring for
   plan completion %, and tests taken today; a 7-day streak tracker row
   with per-day dots; "Add plan item" (primary) + "Log study" (secondary)
   quick actions; a preview list of today's plan items with a "view all"
   link and an empty state.
6. Plan — date-navigable daily checklist (prev/next day arrows, Jalali
   calendar date shown in Farsi), a progress bar, filter chips (All /
   Lesson / Personal Development / Non-Lesson), a scrollable list of plan
   items (checkbox + title + category dot + optional time + duration when
   done), "add new part" and "create catch-up items from yesterday" actions,
   and add/edit bottom-sheet forms.
7. Timer — a large centered circular countdown/progress ring as the visual
   focal point, a subject-name input above it, Pomodoro/Countdown/Stopwatch
   mode pills, quick duration presets (15/30/45/60 min) for countdown mode,
   three round transport buttons (reset / play-pause / stop), an
   alarms-and-reminders summary section with a management sheet, a recent
   study-sessions list, and a manual study-log entry sheet.
8. Questions (personal question bank) — search input, subject filter chips
   (Math, Physics, Chemistry, Biology, Literature, Arabic, Religious
   Studies, Language, Other), difficulty filter chips (Easy/Medium/Hard),
   a list of question cards showing question text, tagged options with the
   correct answer highlighted, and an add/edit form sheet.
9. Stats / Performance Analysis — segmented 3-tab control: (a) Study Hours
   — weekly bar chart, per-subject breakdown, a list of missed/partial
   plan items; (b) Exams — exam list with add/edit sheets; (c) Compare —
   most-recent-vs-previous exam comparison plus a full exam history list.
10. Analysis Bank (list) — a library of uploaded PDF exam booklets with a
    collapsible filter panel (grade level, subject category, subject,
    answer status), exam cards, and an upload sheet.
11. Analysis Bank (detail) — the most complex screen: an embedded
    canvas-based PDF viewer with page-navigation and zoom toolbar, plus a
    color-coded grid of question numbers (correct / incorrect / unanswered)
    that jump to the relevant PDF page and open a note-taking sheet per
    question.
12. Profile — avatar/name summary card with lifetime study-time and
[8/31/2026 10:57 PM] 𝕄𝕠𝕙𝕒𝕞𝕞𝕒𝕕𝕒𝕞𝕚𝕟: test-count stats; a settings list (edit profile info & daily goal,
    change password, manage alarms, generate a copy-pasteable study report
    for a mentor, install-as-PWA prompt, notification permission request);
    a NEW "Appearance" settings section (Theme: Ancient Persia default /
    Custom; Mode: Light / Dark / System; Surface: Solid / Glass; and for
    Custom theme, primary color + background choice); a conditional
    "Admin Panel" entry visible only to the group admin; and a danger zone
    (clear all data, log out).
13. Admin Panel (group-admin only) — a Notion-integration sync status card
    with a manual "sync now" action, a member list with per-member ban/
    unban, password-reset, and delete actions, and an offline-blocked
    empty state (this feature requires connectivity).
14. Empty states — consistent icon + title + subtext pattern, needed for:
    no plan items today, no questions saved, no exams in analysis bank, no
    alarms set.
15. Loading states — needed for admin member-list load and sync-status
    indicator; currently minimal, needs a real skeleton/spinner treatment.
16. Error / offline states — no-connectivity banners (seen today on the
    Admin panel), a sync-status icon with a pending-changes badge in the
    top bar.
17. Confirmation dialogs — centered modal: icon, title, body text,
    confirm + cancel buttons (used for logout, delete-all-data, delete
    exam/question, etc.).
18. Bottom sheets — slide-up forms with a drag handle, used for every
    create/edit action across Plan, Timer alarms, Questions, Stats exams,
    Analysis Bank upload/notes, and Profile edits.
19. Toast notifications — bottom-centered transient success/error pill.
20. Bottom tab navigation (6 items: Home, Plan, Timer, Questions, Stats,
    Analysis Bank) and top bar (logo/brand mark, sync-status icon, alarm
    bell, profile avatar button) — must be redesigned consistently and
    appear correctly in every screen mockup.

=== UI/UX REQUIREMENTS ===
- Full RTL layout, Farsi (Persian) UI text throughout, using the Vazirmatn
  typeface family (already the app's font — keep it).
- Persian (Jalali) calendar dates, Persian numerals where the app currently
  uses them.
- Mobile-first, single-column, portrait, content capped around 520px wide
  even if shown on a larger canvas — this is a phone PWA, not a desktop app.
- Strong visual hierarchy: the Timer's circular ring and the Home dashboard
  are the screens that should get the most confident, premium visual
  treatment; list-heavy screens (Questions, Plan, Analysis Bank) should
  prioritize scan-ability and restraint over decoration.
- Accessibility: maintain AA-level contrast between text and background in
  both light and dark modes; do not rely on color alone to distinguish
  status (pair color with icon/label, as the app already does for
  correct/incorrect answers and category dots).
- Keep all currently-existing functionality and information — do not invent
  new features, screens, or data the app doesn't already have.

=== ANCIENT PERSIAN BRAND IDENTITY ===
- The app's primary/default theme is called "Ancient Persia" and must read
  as a MODERN PREMIUM DIGITAL PRODUCT with SUBTLE Ancient Persian visual
  inspiration — not a museum site, not a fantasy game, not a heavy
  traditional/ornamental template, and not political/nationalist imagery.
- Replace the current abstract purple "A" logo with a clean, modern,
  minimal Faravahar mark as the primary brand symbol. It must work at very
  small sizes (header icon, ~40px), as a strong centerpiece on the login/
  splash screen, and as a barely-visible (2-4% opacity) watermark in empty
  states. Do not use it as a repeating pattern fill.
- Primary accent color: a sophisticated, restrained "Persian Gold" —
  refined ochre/historical gold, NOT neon yellow, NOT bright orange-gold,
[8/31/2026 10:57 PM] 𝕄𝕠𝕙𝕒𝕞𝕞𝕒𝕕𝕒𝕞𝕚𝕟: NOT a cheap metallic gradient. Use it only for primary buttons, active
  states/tabs, progress indicators, selected chips, the logo, and small
  decorative accents (e.g. a thin rule under section headers). Ivory and
  charcoal must remain the dominant surface colors — do not turn the
  interface yellow.
- Background: an extremely subtle, low-contrast abstracted geometric
  pattern inspired by Persepolis stepped-frieze and Achaemenid ornamental
  geometry, applied only to the page background (never on interactive
  cards/surfaces), present in both light and dark modes at a barely-there
  opacity.
- Explore (do not literally paste) other reference points: Faravahar wing
  geometry, Achaemenid column/capital forms, Persepolis relief geometry,
  Derafsh Kaviani-inspired abstract linework — simplified, modernized,
  restrained. Avoid decorative Persian border patterns wrapped around every
  card; use ornament sparingly and only where it reinforces hierarchy.

=== THEME SYSTEM (must be shown in mockups) ===
- Ancient Persia Light: warm ivory background, dark charcoal text, Persian
  Gold accent, extremely subtle warm-gold background pattern.
- Ancient Persia Dark: deep charcoal/near-black background, warm off-white
  text, the SAME Persian Gold accent (brightened for contrast), subtle
  dark-gold pattern — light and dark must clearly read as the same brand,
  not unrelated themes.
- Surface style toggle: Solid (clean flat/gradient cards) vs. Glass
  (translucent, backdrop-blurred cards with refined gold-tinted borders) —
  show both for at least the Home, Login, and Profile screens.
- A "Custom Theme" concept in the Profile > Appearance settings screen:
  user picks a primary/accent color, background, light/dark mode, and
  surface style; secondary colors are implied as derived from the chosen
  accent. Custom themes do not need to preserve the Persian identity.
- Design one new "Appearance" settings screen/section within Profile
  showing: Theme selector (Ancient Persia default / Custom), Mode
  (Light/Dark/System), Surface (Solid/Glass), and for Custom theme a
  primary-color picker and background option.

=== MOTION / LOGIN BRAND MOMENT ===
- Design the Splash/Brand-Intro screen as a storyboard-style sequence (a
  few key frames is sufficient): dark canvas → subtle gold geometric
  line fragments → abstracted Persian architectural geometry briefly
  forming → the Faravahar silhouette assembling from those lines → a gold
  accent highlight on the disc center → the mark resolving cleanly → the
  app name appearing beneath it → transition into the Login screen. Keep
  it elegant, short, and premium — not a generic fade/spin/scale animation.
- Everywhere else, motion should stay minimal and functional (screen
  transitions, timer ring progress, checkbox completion, toast/sheet
  slide-ins) — this is a small utility app, not a marketing site.

=== IMPORTANT — VISUAL ENERGY (do not skip this) ===
This must NOT look like a flat, muted, textbook Material Design palette.
The final result needs the warmth and "alive" premium feel of a modern
high-end SaaS dashboard (think Linear, Stripe-style glow UIs), just
translated into ivory-and-gold instead of dark-and-blue:
- Every primary button, active nav/tab item, active stat-card icon, and
  the progress ring must carry a soft OUTWARD GLOW shadow using the gold
  accent at low opacity (e.g. a colored box-shadow bleeding out from the
  element), plus a subtle inner highlight — not just a flat border.
- The logo mark, primary buttons, active icons, and the progress-ring
  stroke should use a DIAGONAL (135deg) GRADIENT between a brighter
  highlight-gold and a deeper base-gold — not a flat single-color fill.
- The Persian Gold accent itself must be BRIGHT AND LUMINOUS — a warm
  amber-gold in the #D4A24C–#E8B85C range. Avoid muddy, brown, or khaki-
[8/31/2026 10:57 PM] 𝕄𝕠𝕙𝕒𝕞𝕞𝕒𝕕𝕒𝕞𝕚𝕟: leaning golds; the color should genuinely glow against the ivory
  background, not blend into it.
- Cards need real layered depth: soft ambient shadows, a faint radial
  gold glow bleeding from one corner (like a soft light source), and a
  crisp, slightly more saturated gold-tinted 1px border — not a flat
  near-invisible outline on a flat background.
- Small moments of liveliness are welcome and expected: a subtle shimmer
  sweep on the logo mark, a soft pulse on notification/status dots, cards
  lifting slightly with a stronger glow on hover/press. This is a premium
  product and should feel crafted and energetic, not sterile.
- This glow/gradient/depth treatment must stay restrained and tasteful —
  it should read as premium and modern, not gaudy — but flat, shadowless,
  gradient-free surfaces are a failure state for this brief.

=== GENERATE 4 DISTINCT DESIGN CONCEPTS ===
All four must share the Ancient Persia brand identity above but differ
meaningfully in density, ornament, and surface treatment — not just swap
one accent color for another:
1. "Royal Minimal" — extremely clean ivory/charcoal, minimal ornament
   beyond the Faravahar mark and thin gold rules, solid surfaces only,
   confident typographic hierarchy, maximum restraint.
2. "Persian Glass" — same palette as Royal Minimal but with elegant
   glassmorphism (blur, transparency, gold-tinted borders, layered depth)
   as the default surface treatment.
3. "Contemporary Persia" — a more visible expression of the Persian
   geometric identity (Persepolis-frieze-inspired border treatments on key
   surfaces, a more pronounced but still low-contrast background pattern, a
   slightly larger header Faravahar) while staying modern and minimal in
   layout.
4. "Luxury Editorial" — large-type, high-whitespace, magazine-like
   composition; gold used more like an editorial rule/accent than UI
   chrome; the most cinematic take on the login/brand-reveal moment.

Generate all four concepts first against Login, Home, Timer, and Plan (the
screens that best expose their differences), then extend the strongest
concept across the full screen inventory above in both Light and Dark
modes, and in both Solid and Glass surface variants for the Ancient
Persia theme.

Keep the UI visually consistent across every screen generated — shared
component language (buttons, cards, chips, list rows, bottom sheets,
dialogs, the bottom tab bar, the top bar) must look and behave the same
everywhere. Do not invent app functionality, screens, or data fields
beyond what is listed in this brief — this design must represent the
ACTUAL existing Apex Planner application.