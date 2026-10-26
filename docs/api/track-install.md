# Install attribution (PR3)

POST `/functions/v1/track-install` with the signed-in user's Supabase bearer token.
Capture the referrer locally at install and submit after sign-in. Anonymous writes
are intentionally disabled. The Meta SDK's install event is separate from this API.

```json
{
  "platform":"android",
  "installationId":"8dc45462-e1d7-4970-9b11-f4fe745bb423",
  "installReferrer":"utm_source=meta&utm_campaign=launch&utm_content=encrypted",
  "metaAnonId":"sdk_anonymous_id",
  "trackingConsent":true,
  "extinfo":["a2","com.cloudlynk.app","1","0.1.0"]
}
```

The `extinfo` above is abbreviated: supply Meta's complete Android device-info
array in the documented order. Persist `installationId` once per installation
(UUID v4); retries upsert the same user/install row. For existing app compatibility,
omitting it uses one stable legacy row per user. Do not use a device advertising
identifier as the installation ID.

`trackingConsent` must be an explicit boolean. Omitted means false. Without consent,
the server clears the referrer, campaign payload, anonymous ID and device info and
will not enqueue conversions. Re-submit with false to withdraw consent; the most
recent user install update governs conversion dispatch. `utm_content` is stored as
an opaque encrypted value; the server does not decrypt it. Caller-supplied user IDs
are ignored; ownership always comes from authentication.

200: `{"recorded":true,"installationId":"..."}`.
400: `invalid_json`, `invalid_platform`, `invalid_consent`, `invalid_referrer`,
`invalid_meta_id`, `invalid_device_info`, `invalid_installation_id`.
401: `sign_in_required`; 405: `method_not_allowed`; 413: `request_too_large`;
503: `temporarily_unavailable` (retry). Maximum request is 32 KiB, referrer 8192
characters, anonymous ID 255, and device info at most 32 strings of 255 characters.
