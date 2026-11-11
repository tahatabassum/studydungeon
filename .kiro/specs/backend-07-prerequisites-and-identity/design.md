# Backend Spec 07: Design

## Database Changes
- `users`: add `public_id`, `display_name`, `display_name_norm`, `tag`, `is_test`, `notice_accepted_at`, `notice_version`, `last_active_at`, `upgraded_at`. Unique index on `(display_name_norm, tag)`.
- `review_items`: ensure unique constraint / upsert on `(user_id, question_id)`.

## Endpoints
- `POST /guests/name-check`: checks display name against length, profanity and reserved words.
- `POST /guests`: creates guest, sets tag, sets 30-day cookie, returns `Raven#4821`.
- `POST /auth/upgrade`: converts guest to registered user in-place, keeping points and id.
- `DELETE /auth/me`: requires `{"confirm": "DELETE"}` and clears all user data.
