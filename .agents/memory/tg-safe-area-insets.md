---
name: Telegram Mini App safe area insets
description: Telegram WebApp SDK contentSafeAreaInset values can be unreliable; centralize app insets with JS fallback and apply to all fixed/absolute top/bottom elements
---

## Problem
- Telegram's native header (close button, bot name, three-dot menu) can overlap the mini app top bar, search overlay, settings panel, and modals if the web app content is placed at the top of the webview.
- The SDK does not always report a non-zero `contentSafeAreaInset.top`, even on clients where the header is overlaid.

## Solution pattern
- Define a CSS variable for the app-level insets (e.g., `--app-inset-top`, `--app-inset-bottom`) with a default of `0px`.
- In JavaScript, read `tg.safeAreaInset` and `tg.contentSafeAreaInset`, normalize values with `Number(...)` and `|| 0`, then set the CSS variables on the root element.
- Fallback: only when `contentSafeAreaInset.top` is `0` on a mobile platform, add a ~48px header band on top of `safeAreaInset.top`.
- Listen to `safeAreaChanged`, `contentSafeAreaChanged`, `viewportChanged`, and `window resize` to update insets at runtime.

## Apply to
- Top fixed bar: `top: var(--app-inset-top)`.
- Settings drawer panel: `top: var(--app-inset-top)` so it starts below the native header.
- Search overlay: `padding-top: calc(<base> + var(--app-inset-top))`.
- Modals: `padding-top: calc(<base> + var(--app-inset-top))`.
- Main content container / AI chat wrap: add the inset to the existing top padding.
- Bottom nav: `bottom: var(--app-inset-bottom)`.
- Body bottom padding: `calc(<base> + var(--app-inset-bottom))` to keep scrollable content above the nav and home indicator.

**Why:** Avoid relying solely on SDK-provided CSS variables; the platform may omit the header overlay area. Centralizing the inset in a custom variable lets the whole app react to one value and gives a controllable fallback.
