# CloudLynk website

The public pages the launch needs, built from `docs/store/*.md`:

| Path | Why |
| --- | --- |
| `/privacy/` | Privacy policy: Play Console and `EXPO_PUBLIC_PRIVACY_URL` |
| `/terms/` | Terms of use: `EXPO_PUBLIC_TERMS_URL` |
| `/delete-account/` | Play Console → Data safety → Delete account URL |
| `/.well-known/assetlinks.json` | Lets `https://<domain>/open/...` links open the app instead of the browser |
| `/open/...` | Shown only when the app is not installed: a Google Play button. From an ad link, the install keeps the ad flag |
| `/` | A one-line home page with the Play link |

## Before launch

1. Copy `site.example.json` to `site.json` and fill it in:
   - `supportEmail`: the client's support address.
   - `appSigningSha256`: Play Console → Test and release → App integrity → App signing
     key certificate → SHA-256. Use the **app signing** key, not the upload key, or
     links open in the browser.
2. Fill every `[bracket]` in `docs/store/privacy-policy.md`, `terms.md` and
   `account-deletion.md`, and have them checked by a lawyer.
3. `node website/build.mjs --strict` must finish without listing anything still to do.

## Deploy (Cloudflare Pages)

- Build command: `node website/build.mjs --strict`. Output directory: `website/dist`.
- Custom domain: the same host as `EXPO_PUBLIC_APP_LINK_HOST` in the app build.
- `_redirects` and `_headers` in the output make `/open/*` and `assetlinks.json` work.
  Netlify reads the same files.

Check after deploying:

```bash
curl -i https://<domain>/.well-known/assetlinks.json
```

It must return 200 with `content-type: application/json` and no redirect. Google's
checker: https://developers.google.com/digital-asset-links/tools/generator
