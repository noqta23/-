---
name: Font glyph coverage for Persian/Urdu-extended Arabic-script letters
description: Tajawal renders گ/پ/چ/ژ (Persian/Urdu additions to the Arabic script) incorrectly; Vazirmatn covers them. Relevant to any RTL app expecting Persian/Urdu/Pashto text, not just Arabic.
---

Tajawal (a popular Arabic Google Font) has inconsistent/incorrect glyph shaping for the four
extra letters Persian, Urdu, and some other Arabic-script languages add on top of standard Arabic:
گ (gaf), پ (pe), چ (che), ژ (zhe). Text containing these renders visibly garbled even though it's
valid Unicode and copy-pastes correctly.

**Why:** Tajawal's glyph set targets Arabic proper; it wasn't designed with full Persian/Urdu
coverage. Vazirmatn (also on Google Fonts) is designed for Persian and fully supports these letters
while still covering standard Arabic.

**How to apply:** if an app's font stack lists Tajawal (or another Arabic-only font) first, reorder
so a Persian-aware font like Vazirmatn comes first with the Arabic font as fallback, in every
relevant `font-family` declaration — not just the container discovered first. Do this any time
"Arabic text looks garbled/wrong" is reported and the actual characters copy out correctly (ruling
out an encoding/mojibake bug) — check whether the affected words contain گ/پ/چ/ژ specifically before
assuming an encoding root cause.
