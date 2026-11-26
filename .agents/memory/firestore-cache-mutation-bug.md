---
name: Firestore cache mutation bug
description: _cache_get returns direct object references; in-place mutations corrupt the cache and break _upsert_dict_to_collection change detection
---

## The rule
Never mutate the dict/list returned by `load_files()` or `load_folders()` (or any `load_all()` call) in-place.
Always build a fresh dict copy before modifying: `file_doc = dict(files_data[file_id])`.
For list fields like `children`, always copy: `children = list(parent.get("children", []))`.

**Why:**
`_cache_get` returns `entry['data']` — a direct reference, not a copy. `FoldersStore.load_all()` / `FilesStore.load_all()` return `{d['id']: d for d in docs}` where each `d` is the same object stored in cache. If the caller does `folder["children"].append(x)`, they modify the cached object. Then `_upsert_dict_to_collection` compares `_serialize_for_firestore(v)` vs `cached_map[k]` — both point to the same mutated object → identical → NOT written to Firestore. Silent data loss.

**How to apply:**
- Individual field updates: use `FoldersStore.save(id, doc)` / `FilesStore.save(id, doc)` directly — fast, correct, bypasses the comparison issue entirely.
- When updating parent `children`: copy the parent dict and children list explicitly, then call `FoldersStore.save(parent_id, updated_parent)`.
- Avoid calling `save_folders(large_dict)` / `save_files(large_dict)` for single-item mutations — the bulk `_upsert_dict_to_collection` comparison is fragile against in-place mutations.
