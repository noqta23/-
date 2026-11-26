---
name: Nukhaa now on Supabase, not Firestore
description: The Nukhaa platform's data layer was migrated from Firestore to Supabase Postgres; read this before touching files_mini_app/db.py or assuming Firestore is still in play.
---

## What changed
`files_mini_app/db.py` no longer talks to Firestore. It now stores every
"collection" as rows in one generic Postgres table:

```
documents(collection TEXT, doc_id TEXT, data JSONB, updated_at TIMESTAMPTZ)
```

The public API (`get_doc`, `set_doc`, `delete_doc`, `list_docs`, `query_docs`,
every `*Store` class, and a Firestore-style `DB.collection(x).document(y)`
shim) was kept byte-for-byte compatible on purpose, so `main.py` and all the
`*_manager.py` files needed zero changes.

**Why:** the user chose Supabase over Firestore (which is being deprecated)
and over Replit's built-in Postgres (portability outside Replit without a
migration was a hard requirement). Reusing the exact same call surface meant
the migration only touched one file plus a one-time data copy, instead of a
rewrite across ~10 manager modules.

## How to apply
- Connection lives in the `SUPABASE_DB_URL` secret — a **pooler** connection
  string (`*.pooler.supabase.com:6543` or `:5432`), not the direct
  `db.<ref>.supabase.co` host. The direct host only resolves to IPv6, which
  Replit's environment cannot reach — always ask the user for the pooler URI
  if a Supabase connection string is needed again.
- The in-memory TTL cache (5 min, keyed `collection:id` / `collection:__all__`)
  is unchanged from the Firestore version — cross-process staleness rules from
  [Cross-process cache staleness](cross-process-cache-staleness.md) still apply.
- `DB.collection(...).document(...).set(data, merge=True)` does a shallow
  JSONB `||` merge at the top level (matches Firestore's merge semantics for
  the flat docs this app uses, e.g. `settings/bot_receive`).
- A one-time copy script (`files_mini_app/migrate_to_supabase.py`) reads
  Firestore directly and upserts into the `documents` table; it's safe to
  re-run (idempotent upsert) but Firestore access requires
  `FIREBASE_SERVICE_ACCOUNT` to still be valid.
