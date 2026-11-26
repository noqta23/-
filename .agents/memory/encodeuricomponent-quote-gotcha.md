---
name: encodeURIComponent quote gotcha
description: encodeURIComponent does not escape ' ( ) ! * ~ — embedding its output inside a single-quoted JS string in an inline HTML event-handler attribute can break out and cause "Unexpected identifier" runtime errors.
---

`encodeURIComponent()` intentionally leaves these characters unescaped: `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
Notably the apostrophe `'` is NOT escaped.

**Why this bites:** a common pattern is building a small HTML fallback string, then wiring
`onerror="someEl.outerHTML = decodeURIComponent('<encoded>')"` so the fallback survives attribute
quoting. If the fallback HTML itself contains an inline event handler with a single-quoted JS string
(e.g. `onerror="this.style.display='none'"`), that literal apostrophe passes through
`encodeURIComponent` untouched, lands inside the outer single-quoted string, and prematurely closes
it — the browser then tries to parse the leftover fragment as JS and throws
`Unexpected identifier '...'. Expected ')' to end an argument list.` The error is easy to miss because
it only fires when the fallback path is actually exercised (e.g. an image 404s), not on normal page load.

**How to apply:** never round-trip HTML/JS strings through `encodeURIComponent`/`decodeURIComponent`
into a single- or double-quoted inline attribute. Instead, stash the fallback content in a plain JS
variable (e.g. `window['_cacheKey_' + n] = html`) and have the handler look it up by key
(`onerror="_onErr(this, '_cacheKey_' + n)"`), since a generated numeric/alnum key can't contain quotes.
