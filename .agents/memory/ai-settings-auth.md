---
name: AI Settings Auth Pattern
description: How to securely call the AI settings endpoints — always include identity proof
---

## Pattern
- `GET /api/users/<uid>/ai-settings?requester_id=<uid>` — returns `{ai_model, ai_key}`
- `PUT /api/users/<uid>/ai-settings` with body `{ai_model, ai_key, requester_id: <uid>}`
- Backend rejects (403) if `requester_id != user_id` and caller is not owner

## Why
Discovered during code review: endpoints were initially unprotected — any user could read or overwrite another user's API keys, constituting a credential exposure bug.

## How to apply
Whenever calling these endpoints from the frontend, always pass `requester_id: userId` (where `userId` is the currently logged-in Telegram user ID).
