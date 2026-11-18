# Google Play store materials

| File | Status |
| --- | --- |
| `play-listing.md` | Listing text, Data safety, content rating and declaration answers. Fill the `[brackets]` |
| `privacy-policy.md`, `terms.md`, `account-deletion.md` | Drafts to fill, have checked, and publish at public URLs |
| `graphics/feature-graphic.png` | 1024 × 500, ready to upload. Source: `feature-graphic.html` |
| `screenshots/*.png` | 1080 × 2160 **layout drafts** from the local test data |
| App icon 512 × 512 | Export `mobile/assets/icon.png` at 512 × 512 |

## Before uploading screenshots

The drafts show the real app, but with sample channels whose pictures don't match their
names. Retake them once the client's real channels are published, and add one of the
player playing a video, which can only be taken on a phone.

- Show a viewer's view, not a creator's or admin's (no "Manage" buttons), and no email
  address on screen (so not the You tab).
- Play rejects a screenshot whose long side is more than twice its short side. Most phones
  today are 20:9 (for example 1080 × 2400), so crop phone screenshots to 1080 × 2160.
- Upload 4 to 8 phone screenshots. Order: Watch, a channel, the player, Plus plans,
  Channels.

To regenerate the feature graphic with a new phone screen, replace
`screenshots/1-watch.png`, open `graphics/feature-graphic.html` in Chrome at 1024 × 500
and capture the `.art` element (DevTools → Capture node screenshot).
