---
name: Classroom browser preview & Drive thumbnails
description: Added preview modal for Classroom posts and thumbnail support in Drive browser.
---

## Rule
Drive browser items should expose `thumbnailLink`/`iconLink`/`webViewLink` from the API and render thumbnails when available. Classroom browser should allow reading a post before uploading via a dedicated preview endpoint.

**Why:** Users need to know what's inside a Classroom post (text + attachments) and preview Drive files before deciding to upload. Without previews, uploads are blind and often result in wrong items or errors.

**How to apply:**
- `google_client.list_drive_folder` requests fields: `id,name,mimeType,size,parents,thumbnailLink,iconLink,webViewLink,webContentLink`.
- Frontend `_loadDriveFolder` shows `<img>` for `thumbnailLink`, falls back to mime icon, and adds an "open in Drive" button for `webViewLink`.
- `app.py` exposes `/api/google/classroom/course/<id>/post/<item_id>` returning post text, creator, creation date, and typed attachments (drive/youtube/link).
- Frontend `_clsPreviewPost` renders a modal with post content, attachments, and a button to upload the post.
- Course materials list marks `has_drive`, `has_youtube`, `has_link` for quick visual badges.
