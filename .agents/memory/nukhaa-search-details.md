---
name: Nukhaa search & details patterns
description: Arabic variant regex for client-side highlighting, tag-filter vs text-search separation, dl-url endpoint, quiz modal, media player lazy-load
---

## Arabic variant matching in highlightQuery
Use `_arabicVariantsRe(token)` which maps each char to a character class `[كگکڪ]` etc. so searching `ك` highlights `گ` too. The backend already normalizes server-side; the frontend regex must expand variants to match what the backend found.
- Variant map covers: أإآ→ا, ة→ه, ىیئ→ي, گکڪ→ك, ؤ→و
- Do NOT use string normalization (which changes lengths) — use character class expansion to match in original text

## Tags are filter-only, NOT text search targets
- **Backend**: `searchable` in `get_contents()` must NOT include `' '.join(tags)`. Tags participate only in the tag-filter branch (separate logic). Fixed in both deep-search (file branch) and regular `_item_matches` helper.
- **Frontend**: In search results, tags display as plain badges. Matched tags = active `_globalSearchTags` filter (not the text query). Remove all `highlightTagText` on tag chips.

## folder_path for all result types
Deep search for folders must compute and attach `folder_path` just like files do (walk parent_id chain through `all_folders_data`). Frontend must not gate the path breadcrumb on `!isFolder && !isQuiz`.

## dl-url endpoint for media playback
`/api/files/<id>/dl-url` — calls Telegram `getFile` and returns the signed `api.telegram.org/file/bot…` URL. Frontend uses this for lazy-loading video/audio players inside the details modal.
- `loadMediaPlayer(fileId, ftype)` replaces a "▶ تشغيل" button placeholder with `<video>` or `<audio>` after fetching the URL.
- Only shown for types: video, audio, voice, animation, video_note. Thumbnail display is suppressed for these types.

## Quiz detail modal (showQuizDetailsModal)
Clicking a quiz in the files grid now opens `showQuizDetailsModal(id)` (not `switchTab('quiz')`). It re-uses the shared `#modal-file-details` modal. The modal has a "فتح الاختبار" button that navigates to the quiz tab. `showItemDetails(id, 'quiz')` also routes here.

## browseGoogleDrive bug
Was using undefined `currentFolderId`; correct variable is `currentFolder`. Fixed to `currentFolder || 'root'`.

## Google Drive URL auto-detect in URL tab
`autoDetectUrlMode()` now shows `#gdrive-url-hint` when URL matches `drive.google.com|docs.google.com|classroom.google.com`. `doUploadFromUrl()` checks `d.needs_google_connection` or error text and redirects to Google tab if auth is needed.

## Rating button immediate update
`toggleRatingInline(id, type, currentRating, btnEl)` — the 4th `btnEl=this` param lets the function update the clicked button text (★/☆) and its onclick attribute immediately before the API call resolves. Prevents stale star state in the open details panel.

## Why:
These were reported as user-facing bugs in a batch request. The Arabic normalization approach (character class expansion) was chosen over string normalization because the latter would change string positions and break highlight span insertion.
