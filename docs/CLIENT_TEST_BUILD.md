# Client test build

How to make an Android APK the client can install and try on their own phone, before the
production accounts (Play Console, Cloudflare Stream, Firebase, payment gateway) exist.

It is a real build of the app against a **free Supabase test project**. It is not the Play
Store app and must never point at production.

## Task for a teammate: send the project lead a client test APK

1. If the test server doesn't exist yet, do **1. Test server** below. If it does, ask the
   project lead for the project ref and the accounts file (`mobile/.expo/client-test/accounts.json`);
   it never goes in git or a group chat.
2. Do **2. Build the APK**.
3. Install it on an Android phone and check: sign in as the viewer, open a channel, play a
   video (picture, subtitles, fullscreen, press Home for picture-in-picture), then sign in as the
   admin and open **You → Admin**.
4. Send the project lead `CloudLynk-test.apk` (Google Drive or WeTransfer link; WhatsApp and
   email often block APK files) together with the client note from **3. Send it to the client**.
   Send the logins separately, in a private message.

## What works and what doesn't

| Works                                                             | Doesn't, until the client's accounts exist                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Sign up, sign in, profile, settings, account deletion             | Video upload by creators (needs Cloudflare Stream)                                             |
| Browsing channels, joining, saving, search                        | Real videos: every video plays one hosted sample clip                                          |
| The player: subtitles, speed, fullscreen, picture-in-picture      | Push notifications (needs Firebase)                                                            |
| My cloud uploads and downloads                                    | Paying for Plus by UPI or Google Play (needs the business UPI ID or gateway, and Play Console) |
| Admin: creator requests, channel review, people, payment settings | Emails beyond a few an hour (needs the client's email sender)                                  |

Plus channels show "Subscribe to watch" to the test viewer. The test admin and test creator can
play everything, because admins and channel owners always can.

## 1. Test server (once)

1. In the Supabase dashboard, create a project in the team's organisation: free plan, region
   Mumbai (`ap-south-1`), name `cloudlynk-test`. Note its ref (the part before `.supabase.co`).
2. Make the sample clip folder: an HLS stream with `master.m3u8` (video plus optional WebVTT
   subtitle tracks). Any short video converted with ffmpeg works, for example:
   ```bash
   ffmpeg -i sample.mp4 -c:v libx264 -c:a aac -f hls -hls_time 10 -hls_playlist_type vod -master_pl_name master.m3u8 -hls_segment_filename sample-hls/video%d.ts sample-hls/video.m3u8
   ```
3. Sign the Supabase CLI in once, then run the setup script from the repository root:
   ```bash
   npx supabase login
   node supabase/scripts/setup-test-project.mjs <project-ref> sample-hls mobile/.expo/client-test/accounts.json
   ```
   It applies the migrations, adds the plans, three test accounts (admin, creator, viewer),
   three sample channels with five videos, uploads the sample clip to a public bucket and
   deploys the server functions. It prints nothing secret and can be run again.
   `mobile/.expo/` is ignored by git; keep the accounts file there.

The free project pauses after a week without use. Restore it from the dashboard before a demo.

## 2. Build the APK

Metro cannot read files inside OneDrive, so build from a copy elsewhere (for example
`C:\cloudlynk-build\mobile`, without `node_modules`, `android` and `.expo`), then:

```bash
cd mobile
npm ci
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anonKey from the accounts file> \
EXPO_PUBLIC_SAMPLE_VIDEO_URL=https://<project-ref>.supabase.co/storage/v1/object/public/sample-video/master.m3u8 \
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

In PowerShell set each variable first with `$env:NAME = 'value'`.

The APK is `android/app/build/outputs/apk/release/app-release.apk`. Rename it, for example
`CloudLynk-test.apk`. It covers every Android phone from Android 7 that has a 64- or 32-bit ARM
chip. The first build takes 15–20 minutes because expo-video is compiled from source.

`EXPO_PUBLIC_SAMPLE_VIDEO_URL` is for these builds only. A production EAS build stops at the
start if it is set.

## 3. Send it to the client

Send the APK and a short note with the three test logins (the accounts file has them). Use a
private channel the client already uses, never a public link, and change the passwords if the
note is forwarded. The note to send:

1. Download `CloudLynk-test.apk` on the Android phone and open it.
2. If Android asks, allow installing from this source (Chrome or Files). Play Protect may warn
   about an unknown developer: tap **More details → Install anyway**. That is because it isn't
   from the Play Store yet.
3. If an older CloudLynk is installed, uninstall it first.
4. Sign in with one of the test accounts. The admin sees the **Admin** screen under the **You**
   tab.

## Before launch

Delete the test project, or at least the test accounts, once production is live. It holds
sample content and known passwords.
