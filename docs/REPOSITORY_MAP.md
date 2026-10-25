# Which CloudLynk project is which?

| Project | What it contains | Role in this work |
|---|---|---|
| `captainpunit/CloudLynk_App` | Expo SDK 57 app scaffold, newer Supabase migrations and access-policy contract | Starting code for this new workspace |
| `MitMakwana13/cloudlynk` | Older Expo SDK 56 app and its separate backend/reference docs | Historical reference only |
| `antigravitykrishna-cloud/cloudlynk-site` | Private marketing website, legal pages and thecloudlynk.com landing page | Website reference, not the Android app |

## Your new working copy

`Desktop/cloud application` is the single local working copy for the new frontend.
Its Git origin is still `captainpunit/CloudLynk_App`. Work is on branch `frontend/android-experience`.
This is the target repository and branch for the new frontend. The other repositories remain references.

## Why the old code was not merged

The older backend uses different profile fields, channel states, billing requests and RPC signatures.
For example, the old reference documents a flat 15 GB storage allowance and legacy manual payment approvals.
The newer access contract uses server-verified entitlements and different channel/member rules.
Mixing these calls would produce subtle authorization and billing bugs.

README claims in the old repository are not evidence that those services are deployed or current.
No old database credentials, migrations, users or production data were copied into the new frontend.

If the older backend is intentionally retained later, write a dedicated adapter and test its contract.
Do not point the newer schema's client at the old database and assume compatibility.
