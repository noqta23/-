---
name: Nukhaa Platform Conventions
description: Key architectural patterns, class names, and endpoints for the Nukhaa Files Mini App
---

## UI / Layout
- Logo: `nukhaa-logo.png`; top-bar uses `direction:ltr` so logo is visually on the left
- Filter chips use `.tag-filter-chip` class (not checkboxes)
- View mode: list view **removed** — only grid view remains; `viewMode` is hardcoded to `'grid'`; `toggleViewMode()` is a no-op
- Top-bar safe-area: CSS `top: var(--tg-safe-area-inset-top, 0px)` — do NOT use JS paddingTop override inside the bar

## Endpoints
- Folder creation: `POST /api/folders/create`
- Bot receive toggle: `GET/POST /api/bot-receive` — persists to Firestore `settings/bot_receive` document (shared with main.py bot process)
- Pending bot files: `GET /api/pending-bot-files?user_id=X&show_all=1` — `show_all` is **server-side checked** against owner/admin role

## Bot Files / Inbox Pattern
- Bot-received files (`uploaded_by.source == 'bot'` + `folder_id == None`) are **excluded from the regular file listing** in `folders_manager.get_folder_contents()`
- They appear ONLY in the inbox table (Telegram tab)
- On accept (`/api/assign-file-folder`), `folder_id` is set → file moves from inbox to the target folder
- On reject, file is deleted via `DELETE /api/files/<id>`
- `_pendingFiles` JS global maintains client-side inbox state; `_renderPendingTable()` re-renders from this array

## Text Note Display
- Stored content is raw HTML (bold, italic, spoiler, code, blockquote, links)
- `makeCollapsibleDesc(content)` renders HTML safely (allowlisted tags) — use it for detail view
- Thumbnail uses content HTML directly in `.text-thumb-preview` — no escaping

## Format Bar
- Format buttons carry `data-fmt="bold|italic|..."` attribute
- Active state: `.fmt-active` class, updated via `_updateFmtButtons(barId)` on `selectionchange`
- Cleared via `_clearFmtButtons(barId)` when selection leaves the editor
- `_insertFmtInEditor(editorId, type)`: toggles format OFF if cursor is already inside the format; for links, shows existing href for edit/delete
- Bar IDs: `upload-fmt-bar` (upload modal) and `edit-fmt-bar` (edit modal)

## Product direction and presentation
The owner started Nukhaa as a Telegram bot due to limited resources, but the long-term goal is a website and apps across operating systems. They prefer expressive symbols over unnecessary text and consistent behavior and presentation.

**Why:** the owner stated these platform goals and preferences on 2026-10-03.

**How to apply:** favor portable, reusable patterns where practical; use recognizable icons with accessible labels; update `PLATFORM_GUIDE.md` when a durable product or owner preference is learned.

- Every tag option should be one icon-only button with no visible text; select-all/deselect-all controls should also be icon-only.

**Why:** the owner explicitly asked to keep taxonomy option and selection controls icon-only.

**How to apply:** use one button per option and provide its name through a tooltip and accessible label rather than visible text.

## Tag taxonomy filters
- Keep every category visible as an independent filter list, with separate selection state. Owners may explicitly link one category to multiple source lists; arrows on source options open those linked sublists directly. Within each list, tags may also have child tags. Iraqi institutions use official Ministry entries/logos, with editable profile overrides; their departments are child tags maintained within the institution list.
- Files and global search each have a persisted all/any mode across selected options.
- The user’s tag-list view preference changes only the root list layout; preserve all taxonomy features and selection behavior.

**Why:** the owner wants lists to remain independently visible and selectable while also allowing optional cross-list links and direct access to linked sublists.

**How to apply:** preserve each category's independent filter state and standalone-tag access; only show cross-list navigation when explicitly linked (with the existing country-to-institutions fallback). Keep same-list child paths and let owners unlink placements without deleting canonical tags.

## Shared taxonomy values
- A tag is one canonical value that can have multiple `{category_id, parent_tag_id}` placements; it may also remain independently available at the same time.
- Removing a list removes only its placements. Preserve the canonical tag and all other placements.
- General departments such as human medicine, pharmacy, dentistry, lab analysis, and nursing may be independent and reusable under multiple institutions; `كلية طب الزهراء` belongs only to جامعة البصرة.

**Why:** the owner wants general departments reused across institutions, while institution-specific departments stay exclusive (for example, `كلية طب الزهراء` at جامعة البصرة).

**How to apply:** manage list relationships separately from tag identity; keep legacy single-placement fields synchronized to the first remaining placement, and do not make institution-specific tags standalone.
