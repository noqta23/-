---
name: Nukhaa Mini App UI/gesture quirks
description: Recurring bug patterns in the Nukhaa Files Mini App top-bar dropdowns, modal scroll-lock, and clipboard actions.
---

## Dropdown/popup clipped by parent overflow:hidden
A clickable box that truncates its own text with `overflow:hidden` will also clip any
absolutely-positioned child dropdown/popup anchored to it (e.g. the top-bar clock's
settings popup), making the popup exist in the DOM (display:block) but be invisible.
**Fix pattern:** wrap only the truncated text in an inner `overflow:hidden` div; keep the
outer clickable container (and the popup, as its sibling) unclipped.

## Clipboard writes break if awaited network call happens first
`navigator.clipboard.writeText()` only works within the "recent user activation" window of
the click. Any `await fetch(...)` before the write (even for something small like a config
or link-token lookup) can silently invalidate that window in Telegram's in-app WebView,
making the copy action fail with no visible error unless you check the catch branch.
**Fix pattern:** prefetch/cache anything needed (bot config, per-file short tokens) in the
background as items render, so the click handler can resolve everything from cache
synchronously before calling the Clipboard API.

## Modal scroll-lock loses page scroll position
Toggling `overflow:hidden` on `<body>`/`<html>` to lock background scroll while a modal is
open is a common pattern, but mobile WebKit / Telegram's WebView frequently fails to restore
the previous `scrollY` when overflow is set back to normal — the page silently jumps to the
top after closing any modal.
**Fix pattern:** capture `window.scrollY` right before locking and explicitly
`window.scrollTo(0, savedY)` right after unlocking; don't rely on the browser to remember it.
