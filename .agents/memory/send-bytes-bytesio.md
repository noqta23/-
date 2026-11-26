---
name: _send_bytes_to_telegram BytesIO size fallback
description: The len() fallback for file_size in _send_bytes_to_telegram fails for BytesIO objects.
---

## Rule
In `_send_bytes_to_telegram` (app.py), the fallback for missing `file_size` must not use `len(file_data)` because `file_data` is often a `BytesIO` object which has no `__len__`.

**Why:** Callers pass `BytesIO` objects (e.g. from `_io.BytesIO(file_bytes)`). Telegram's `sendDocument` response normally includes `file_size`, so the fallback is rarely hit. When it is, `len(BytesIO(...))` raises `TypeError`.

**How to apply:** Use `seek(0,2)/tell()` for BytesIO, or just fall back to 0. Fixed pattern:
```python
_fsz = document.get('file_size')
if not _fsz:
    try:
        _fsz = len(file_data) if isinstance(file_data, (bytes, bytearray)) else (file_data.seek(0, 2) or file_data.tell())
    except Exception:
        _fsz = 0
return document['file_id'], _fsz
```
