# Store screenshot and reviewer-video plan

Use synthetic staging data only. Screens must depict the archived release candidate,
not a mockup. Hide passwords, precise coordinates, notification tokens, and internal
debug/QA controls.

## Final icon and splash source

- Verified 1024px RGB store icon: `apps/mobile/assets/images/icon-store-1024.png`.
- Verified Google Play 512px icon: `apps/mobile/assets/images/google-play-icon-512.png`.
- Verified Google Play 1024 × 500 JPEG feature graphic:
  `apps/mobile/assets/images/google-play-feature-1024x500.jpg`.
- The app icon, Android adaptive foreground, and splash screen all reference that same
  checked-in asset; no artwork is downloaded at runtime.
- The source was created with the built-in image generator using a prompt for a crisp,
  professional square RailCommand mark: deep navy background, high-contrast white
  rail/forward motif, minimal geometry, no words, no mockup, and no transparency.
- The feature graphic reuses the approved mark on a navy rail-grid field with a
  restrained safety-orange accent. It contains no text, claims, screenshots, people,
  customer data, or transparency.
- Re-run `npm run verify:mobile:assets` after any artwork change. New artwork reopens
  screenshot and store-listing review.

## Required capture sets

Apple accepts 1–10 screenshots per device class. Because the app supports iPad, capture
both the highest-resolution iPhone and iPad sets:

- iPhone 6.9-inch portrait: `1320 × 2868`, `1290 × 2796`, or `1260 × 2736` pixels.
- iPad 13-inch portrait: `2064 × 2752` or `2048 × 2732` pixels.

Google requires at least two phone screenshots; use four portrait screenshots at
`1080 × 1920` or greater. If publishing tablet availability, provide at least four
tablet screenshots with a 9:16 portrait or 16:9 landscape ratio and dimensions between
1080 and 7680 pixels. Google screenshots must be JPEG or 24-bit PNG without alpha.

Official specifications:
<https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications>
and <https://support.google.com/googleplay/android-developer/answer/9866151>.

## Storyboard

1. **Field dashboard** — synthetic project list, online state, no customer names.
2. **Daily log draft** — weather, concise synthetic work summary, photo/location controls.
3. **Offline protection** — offline badge and saved-on-device/pending state.
4. **Sync Center** — one pending daily log plus one pending photo.
5. **Synchronized history** — zero queue and exactly two successful items.
6. **Privacy controls** — Account screen with privacy/support/deletion controls.

Use the same honest UI sequence for Apple, Google, and the private reviewer video.
App Store preview video is optional; the short private walkthrough is review support,
not marketing material.

The checked-in capture and verification commands are documented in
`docs/mobile/store-assets/README.md`. The strict release check requires all six states
for Apple iPhone/iPad and Google phone/tablet, for 24 validated screenshots total.
