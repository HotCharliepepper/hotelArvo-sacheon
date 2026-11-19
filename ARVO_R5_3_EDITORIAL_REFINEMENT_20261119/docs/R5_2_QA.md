# ARVO R5.2 — TESTED / NOT TESTED

Date: 2026-11-19. Internal visual study. This is not a production site QA signoff.

## Verified

- `dist/index.html` serves from the dependency-free Node server (`curl` returned HTTP 200 for local 5305).
- `dist/app.js` and `dist/data.js` pass Node `--check`.
- Standalone build succeeded: `ARVO_R5_2_IVORY_PREVIEW_20261119.html` (~4.14 MB; 20 embedded assets).
- Static browser screenshot QA ran with the **same CSS and actual signature hero photo** (but other photos stubbed, online fonts/maps blocked) at 1440×900, 1366×768, 850×900, 390×844 and 320×700. No horizontal overflow or headline/photo box overlap at any size. Hero background verified as RGB(247,243,235); font-weight 600. See `screenshots/`.
- Interaction smoke QA ran with **unchanged actual application JavaScript and data** but lightweight image fixture assets to bypass browser restrictions. At 1440/390/320: hero LIVING→BEDROOM changes, 2PC selection changes selected room, booking dialog opens and closes with Escape. Mobile navigation opens and closes with Escape. No page-level JavaScript errors detected.
- Existing 28-second CSS Marquee still present; `prefers-reduced-motion` and manual motion toggle source preserved.
- `noindex` remained active; no publishing performed.

## Not verified

- Full original 4MB standalone end-to-end Chromium test: this container's Chromium blocks local/file navigation and a direct `set_content` attempt did not reliably load at every size. Therefore screenshots represent the same Hero CSS/photo, not a full-site rendered approval.
- Actual Android/iPhone browsers, keyboard/screen reader usability of every section, map external iframe loading, correct Google business pin/entrance, current OTA product/deep links, actual conversion or SEO/GEO impact.
- Public image rights and operating facts require hotel approval.

## Status

**READY FOR LOCAL VS CODE VISUAL ITERATION** · **NOT READY FOR PUBLICATION**.
