---
name: RTL breadcrumb with mixed Arabic/Latin segments
description: Why a dir="rtl" inline breadcrumb with per-segment <bdi> still visually mis-orders segments when some are Arabic and some are Latin/numeric, and how to fix it.
---

## Problem
An inline breadcrumb container (`dir="rtl"`, `unicode-bidi: embed`) whose child
`<a>`/`<span>` segments are plain inline elements gets reordered by the Unicode
Bidi Algorithm *per run*, not per DOM element. When segments alternate between
strong-LTR text (e.g. "T3", "4Y Final") and strong-RTL text (Arabic folder
names), the UBA can visually reverse the relative order of same-direction
segment groups, so the path no longer reads consistently outward from the
root/home icon — deep Latin-named folders can end up on the wrong side of
Arabic-named ones.

Wrapping each segment's text in `<bdi>` only isolates *internal* shaping of
that segment's own characters; it does not fix cross-segment ordering, because
the container is still laying out inline boxes via bidi reordering rules.

## Fix
Make the breadcrumb container `display: flex` (keeping `direction: rtl` for
which edge is the start). Flex layout positions each child as a flex item in
strict DOM/source order along the main axis — it does not apply UBA reordering
across flex items, only within each item's own text. Add `unicode-bidi:
isolate` on the `a`/`span` children to keep each segment's internal text
shaping correct without affecting inter-segment order.

**Why:** flexbox order is source-order + `flex-direction`, immune to the
per-run bidi reordering that plain inline layout applies; this is the standard
fix for "breadcrumb reads backwards when scripts are mixed" bugs.

**How to apply:** any RTL breadcrumb/pill-trail UI where segment content can
be either script, switch the container to flex instead of relying on natural
bidi text flow to get correct visual ordering.
