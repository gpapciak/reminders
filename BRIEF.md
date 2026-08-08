# Mom Cognitive Support Display — Build Brief

## Project goal

Build a very simple, remotely managed, always-visible cognitive support display for my 86-year-old mother, who has recently developed substantial short-term memory impairment.

She can still read, write notes, converse normally, answer phone calls, get food for herself, and perform many normal daily activities. However, she may forget recent conversations within roughly 10–15 minutes and repeat the same questions. A particularly important safety issue is that she may forget whether she has already taken medication and consider taking it again.

She has independently started writing herself notes to compensate for this, suggesting that written external cues may work well for her.

The display should therefore function as an **external short-term memory / orientation aid**, not as a conventional website.

The central design questions it should continuously help answer are:

- What day and time is it?
- What is happening today?
- What happens next?
- Did I already do something?
- Have I taken my medication?
- When will family call or visit?
- Is everything okay?

The overriding principles are **simplicity, consistency, readability, reassurance, and safety**.

---

# Hardware/environment

Primary dedicated display:

- Insignia 24-inch Fire TV
- 720p resolution
- Fire TV built in
- Cost approximately $70
- Located toward the back of a roughly 32-inch-deep table where she normally sits
- She will therefore usually view it from relatively close range
- This screen should primarily function as the dedicated cognitive-support display rather than as another entertainment television.

There are also two existing televisions:

- Bedroom TV
- Living-room TV

Fire TV Sticks are being added to both.

Eventually all three Fire TV devices should be capable of displaying the same web application.

The dedicated 24-inch table display is the priority for development and testing.

---

# Basic architecture

Initial architecture should be deliberately simple:

**Google Sheet → Google Apps Script/API → custom HTML/CSS/JavaScript webpage → Amazon Silk on Fire TV**

The webpage should be hosted somewhere simple and inexpensive/free, such as GitHub Pages, Cloudflare Pages, or Netlify.

The Fire TV's Silk browser opens the dashboard URL.

Example:

`https://example.com/mom`

The page should periodically retrieve current information from the backend without requiring interaction with the Fire TV.

---

# Google Sheet as the family editing interface

Family members should not have to edit code.

Use a Google Sheet as the control panel/data source.

For the simplest version, each row represents one date.

Possible columns:

| Date | Greeting | Medication Status | Meals | Next Event | Schedule | Family Message | Reassurance |
|------|----------|-------------------|-------|------------|----------|----------------|-------------|

Example:

| 2026-08-08 | Good morning, Mom | Medicine taken at 8:20 AM — do not take more | Lunch is in refrigerator | Susan calls at 2 PM | Quiet afternoon | Greg calls tonight | Everything is okay |

Family members should be able to populate future days in advance.

---

# Automatic date selection

Nobody should have to manually switch the display to the next day.

The system should determine the current date using:

`America/Los_Angeles`

and automatically select the corresponding Google Sheet row.

For example:

- At 11:59 PM August 8 → show August 8.
- After midnight → automatically show August 9.

The browser should periodically refresh its data, perhaps every 2–5 minutes.

A complete page reload every hour may also be useful as protection against long-running Fire TV/Silk browser problems.

Cache busting should be used so that stale data isn't displayed.

---

# Medication safety

This is particularly important.

The system must **never infer that medication has been taken merely because a scheduled medication time has passed.**

Medication status must be explicitly confirmed by a family member/caregiver or, eventually, by another reliable source.

Examples of valid states:

**Morning medicine still needs to be taken**

**Medicine taken at 8:20 AM — DO NOT TAKE MORE**

**Please call Greg before taking medicine**

A missed backend update must never cause the dashboard to falsely state that medication has been taken.

Fail safely.

Consider visually distinguishing medication status, but avoid alarming visual design.

---

# Screen design

The display is 16:9, so use the horizontal space rather than building a vertically stacked mobile-style page.

A two-column dashboard is preferred.

The layout should remain extremely stable from day to day so she learns where information appears.

Conceptual structure:

┌────────────────────────────────────────────────────┐
│ GOOD MORNING, MOM                   9:42 AM         │
│ Friday, August 8                                   │
├──────────────────────────┬─────────────────────────┤
│ NEXT                     │ TODAY                   │
│                          │                         │
│ Susan calls              │ ✓ Breakfast             │
│ 2:00 PM                  │ ✓ Medicine              │
│                          │ □ Lunch                 │
├──────────────────────────┼─────────────────────────┤
│ IMPORTANT                │ FAMILY / RECENT         │
│                          │                         │
│ Lunch is in refrigerator │ Susan called 11:20 AM  │
│                          │ Greg calls at 7 PM      │
├──────────────────────────┴─────────────────────────┤
│       Everything is okay. You are home.            │
└────────────────────────────────────────────────────┘

Exact layout can evolve after testing.

---

# Information hierarchy

The most important information should dominate the screen.

## Persistent orientation

Always visible:

- Day of week
- Full date
- Current time

Potentially also:

- "You are at home."

Do not overdo orientation statements if testing suggests they feel infantilizing or unnecessary.

## Medication

Highly prominent because it is safety-critical.

## Next

One clear upcoming thing:

**NEXT**

Susan visits  
2:00 PM

Avoid displaying a complicated calendar.

## Today

Very short list of major activities/statuses.

## Family / recent activity

Examples:

- Susan called at 11:20 AM
- Greg calls at 7 PM
- Kat visits tomorrow
- Greg called this morning

This can help answer the cognitively difficult question:

**"Did that already happen?"**

## Meals / practical reminders

Examples:

- Lunch is in the refrigerator.
- Soup is ready for dinner.
- Remember to drink some water.

## Reassurance

A quiet persistent message can be tested, for example:

**Everything is okay.**

or

**You're home and everything is okay.**

This should be comforting rather than patronizing.

---

# Visual design principles

This is NOT a normal web dashboard.

Avoid:

- navigation
- menus
- scrolling
- tiny icons
- advertisements
- dense calendars
- news feeds
- excessive animation
- constantly changing layouts
- information overload

Use:

- very large text
- high contrast
- substantial whitespace
- short sentences
- clear visual hierarchy
- large touch-free/read-only areas
- consistent placement

The 24-inch display is only 720p, but that is sufficient because the UI should use large text and simple graphics.

Design directly for approximately:

`1280 × 720`

Do not assume 1080p.

The entire interface must fit within the viewport without scrolling.

---

# Color

Use color sparingly and semantically.

Possible concept:

Green:
**Medicine complete**

Neutral/blue:
Normal information and family messages

Yellow/amber:
Something coming up soon

Avoid red unless there is genuinely something requiring immediate attention.

Do not make the dashboard visually busy.

---

# Photos

Family photographs may eventually occupy part of the right column.

However, they should not compete with safety-critical information.

Potential future format:

Left ~60–70%:
- Orientation
- Next activity
- Medication
- Practical information

Right ~30–40%:
- Clock
- Family message
- Photo
- Recent activity

For V1, photos are optional.

---

# Multiple TVs

Eventually the same application should support all three TVs.

Possible URLs:

`/mom?screen=table`

`/mom?screen=living-room`

`/mom?screen=bedroom`

The table screen could show the complete dashboard.

Other screens might eventually show simplified versions appropriate to their location.

Example bedroom version at night:

**Friday, August 8**

Medicine is finished for today.

Greg will call tomorrow morning.

Good night, Mom.

This is a later feature. Do not complicate V1 around it.

---

# Time-aware content — future enhancement

Eventually a date may contain several time blocks.

Example:

| Date | Start | End | Message |
|------|------|-----|---------|
| Aug 8 | 6 AM | 10 AM | Good morning |
| Aug 8 | 10 AM | 1 PM | Susan calls at noon |
| Aug 8 | 1 PM | 5 PM | Lunch is in refrigerator |
| Aug 8 | 5 PM | 10 PM | Greg calls at 7 PM |

The dashboard could automatically select the appropriate content based on Oregon local time.

However, medication status must remain separately controlled and never be inferred from time.

This does NOT need to be part of the first prototype.

---

# Resilience

The dashboard should be designed for unattended operation.

Important behaviors:

1. Automatically fetch new data every few minutes.
2. Automatically transition to a new date.
3. Handle temporary internet failure gracefully.
4. Preserve/display the last successfully retrieved information when appropriate.
5. Clearly distinguish stale information if necessary.
6. Never convert stale or missing information into an unsafe medication instruction.
7. Reload itself periodically.
8. Avoid requiring mouse, keyboard, touch, or remote interaction during normal operation.

If today's Google Sheet row is missing, show a safe generic fallback rather than yesterday's entire schedule as though it were current.

Example:

**Friday, August 8**

Good morning, Mom.

There are no special plans listed yet.

**Please check before taking medication.**

Everything is okay.

---

# Fire TV / Alexa

Initial display environment is Amazon Silk on Fire TV.

The dashboard URL should be bookmarked and as easy as possible to reopen.

Alexa may be useful for commands such as opening Silk or controlling TVs, but do not make Alexa a dependency for V1.

A known limitation is that Fire TV/Silk is a consumer streaming platform rather than a true kiosk system. The browser may eventually sleep, return home, restart, or fail to reopen automatically after power loss.

First test actual behavior on the Insignia Fire TV before engineering around this.

Potential later options include:

- more kiosk-like Fire TV configuration
- a minimal Fire TV app wrapping the webpage
- another dedicated kiosk device if Fire TV proves unreliable

Do not solve these problems until testing shows they are real.

---

# Possible later features

Do NOT build these into V1 unless they are trivial:

- Family photos
- Weather
- Remote family messages
- Automatic time-of-day content
- Audio reminders
- Google Calendar integration
- Alexa integration
- Tapo camera integration
- Telegram/Sherpa integration
- Medication dispenser integration
- "last updated by Greg/Susan" indicators
- caregiver check-in logging
- separate layouts for bedroom/living room/table TVs

The architecture should make future additions possible without requiring them now.

---

# V1 MVP

The first working version should do only this:

1. Run full-screen-ish in Amazon Silk on the 24-inch 1280×720 Fire TV.
2. Determine the current date/time in `America/Los_Angeles`.
3. Fetch today's row from a Google Sheet/backend.
4. Display:
   - current time
   - day/date
   - greeting
   - medication status
   - next event
   - today's short schedule
   - meal/practical reminder
   - family message
   - reassurance message
5. Use a stable two-column layout.
6. Automatically refresh data every few minutes.
7. Automatically change dates without intervention.
8. Fail safely if data or internet connectivity is unavailable.
9. Require no interaction from Mom during ordinary use.

Build the simplest robust implementation first.

---

# Core product philosophy

This should not feel like software Mom has to operate.

She should simply be able to look at it.

Think of it as an **external short-term memory and reassurance board**.

The display should reduce the cognitive burden of remembering recent information rather than asking her to learn another device.

Every feature should pass this test:

**Does this make it easier for her to answer "What is happening, what should I do, and is everything okay?"**

If it doesn't, it probably doesn't belong on the primary screen.