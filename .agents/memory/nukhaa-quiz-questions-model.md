---
name: Nukhaa quiz/question bank data model
description: How quizzes and standalone questions relate, tag-sync rule, and the generic Telegram image endpoints used for quiz/question media.
---

## Model and creation rule
Questions remain top-level records in the questions store, linked to quizzes by `quiz_id`; the quiz's own `questions` array is legacy. New question creation and import must happen inside an existing quiz. Historical unassigned questions are preserved rather than migrated or deleted.

**Why:** the user asked to remove standalone question creation without risking old records. Quiz types are defaults for new questions, not an instruction to silently convert existing questions.

**How to apply:** require a valid quiz for every new question/import. The quiz type is the default for new questions, not a restriction; preserve each question's type from the editor or imported file. Changing the quiz default must leave existing questions intact.

## Tag sync rule
Editing a quiz's tags diffs old vs new and propagates add/remove to every question currently linked to it (`quiz_id` match). Editing a question's own tags never touches the quiz. Linking a question to a quiz unions in the quiz's tags one-way at link time; unlinking clears `quiz_id` only, tags stay.

**How to apply:** any future change to quiz or question tag-editing UI/API must preserve this one-directional propagation — quiz → linked questions only, never the reverse.

## Images and question types
Quiz/question/option/explanation images are NOT stored as file records. They go through generic endpoints decoupled from the file-based system: `POST /api/telegram/upload-image` (reuses `_send_bytes_to_telegram()`, returns just `{file_id}`) and `GET /api/telegram/image/<file_id>` (calls Telegram `getFile` + redirects). Questions may store multiple image IDs for the prompt, each answer, and each explanation; keep legacy singular image fields readable during compatibility changes.

**Why:** matches existing project convention of storing only Telegram `file_id`s, and quiz media shouldn't clutter file browsing.

OSCE stations and teaching slides are dedicated question types, not aliases for ordinary text/image questions. OSCE stations have scenario, candidate instructions, duration, and a weighted checklist. A slide question may show multiple images and ask for a written response; accepted answers enable automatic scoring, while slides without a prompt remain informational.

## Ordered content blocks and option numbering
Informational items such as text, documents, media, sections, dividers, and links share the quiz's ordered question records as `content_block` entries so they can be inserted and reordered beside questions. They are not scored questions and must be excluded from self-test sessions and question counts. Per-question option numbering overrides the legacy quiz-level template; leave new option templates blank unless the editor explicitly supplies one.

**Why:** content must stay in the chosen quiz position without appearing as a question in grading, and older quizzes still need their saved option-numbering behavior.

**How to apply:** keep ordering operations inclusive of content blocks, filter them out of scoring/session builders and question totals, and preserve the legacy template only when a question has no per-question value.

## Self-test sessions
`build_session(tags, quiz_id, limit, shuffle, match_all_tags)` returns full question objects including correct answers — this is a self-study tool, not an anti-cheat exam, so scoring happens client-side against the returned answers.
