---
name: Google Drive/Classroom FilesStore import
description: FilesStore must be imported locally in every Google integration endpoint; it is NOT at module level.
---

## Rule
Every endpoint in `app.py` that calls `FilesStore.save()` or `FilesStore.delete()` must include `from db import FilesStore` as a local import inside that function.

**Why:** `FilesStore` is NOT imported at module level in `app.py`. When missing, `FilesStore.save()` raises `NameError` inside a `try/except Exception` block — the file IS sent to Telegram (upload succeeds) but is never recorded in the DB, so `uploaded` stays 0 and the error appears as "رفع 0 (خطأ N)".

**How to apply:** Before any `FilesStore.save(...)` call in a Google-integration function, ensure there's a local `from db import FilesStore`. Functions confirmed to need this:
- `google_drive_upload_folder`
- `google_drive_upload_file`
- `google_drive_upload_folder_by_id`
- `google_classroom_download`
- `google_classroom_post_upload` (uses local import, already present)
