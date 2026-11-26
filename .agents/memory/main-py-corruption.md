---
name: main.py corruption pattern
description: The /start handler in main.py was pre-split across 3 locations; Edit tool fails with multiple matches; Python script fix is correct approach
---

## The corruption
- Line 128: broken decorator with unterminated string (r'...no closing quote)
- Lines 423-427: orphaned `if __name__` + start of cmd_start without decorator, unterminated re.match string
- Lines 722-742: orphaned rest of cmd_start body after second spurious `if __name__`

## Why it happened
Previous agent edits using the Edit tool caused quadruplication when trying to fix overlapping corrupt content. The Edit tool's string matching found multiple matches and replaced all, ballooning the file to 4055 lines.

## How to apply
- Use `git checkout HEAD -- main.py` to restore, then use a Python script (`content.replace(old, new)`) for precise single-match substitutions
- Always run `python -m py_compile main.py` after any edit to catch unterminated strings early
- The cmd_start function belongs at line ~128 (just after # === أوامر البوت === comment), with a complete decorator + body in one place

## Related parser-error clue
A Telegram handler can also be split when an unfinished `InlineKeyboardMarkup` is followed by a later decorator, while the missing button and reply code sits after another handler. Python reports the decorator, but the real cause is the earlier handler boundary.

**Why:** repairing only the reported line leaves the function incomplete and makes each compile attempt point at the next boundary.

**How to apply:** inspect the entire affected handler and nearby orphaned fragments, move only its missing statements back into place, then compile that file and its package. Avoid restoring unrelated files to fix a local handler.
