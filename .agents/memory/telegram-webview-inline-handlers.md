---
name: Telegram WKWebView inline handlers
description: Prevent inline navigation handlers from failing to resolve global functions inside the Telegram WebView.
---

**Rule:** expose functions called by HTML `onclick` handlers on `window` and call them as `window.functionName()` rather than relying on an unqualified global name.

**Why:** Telegram's WKWebView reported `Can't find variable: switchTab` for bottom-navigation handlers despite a top-level function declaration in the page script.

**How to apply:** when changing navigation handlers or other inline actions in the Mini App, keep an explicit `window` export, update the inline calls, and test each tab dispatch.