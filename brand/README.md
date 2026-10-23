# Workit — brand / social assets

Social profile + marketing assets. Not part of the app build (not in `workit/public/`).
Each asset ships as a **`.png` (upload-ready)** and the source **`.svg`** (for edits).

| File | Use | Size / ratio |
|---|---|---|
| `workit-facebook-banner-dark.png` / `.svg` | Facebook Page cover — dark/clay | 1640×624 (2.63:1) |
| `workit-facebook-banner-light.png` / `.svg` | Facebook Page cover — light/cream | 1640×624 (2.63:1) |
| `workit-profile-logo.png` / `.svg` | Profile picture (FB/IG/LinkedIn) — square, shown circular | 512×512 |
| `workit-ad-gauteng-heatmap.png` / `.svg` | Feed ad — Gauteng "jobs heat map" (FB/IG square post) | 1080×1080 |
| `workit-ad-map-jobs.png` / `.svg` | Ad — city map full of price-pin jobs + job card (FB link ad) | 1200×628 |

## Using them
- **Upload the `.png` files directly** — Facebook/Instagram/LinkedIn take PNG. The
  `.svg` is the editable source; re-export to PNG with sharp if you change it
  (`sharp(svg,{density:144}).resize(w,h).png()`).
- **Banner safe zone:** key text is kept clear of the bottom-left, where the profile photo + page name overlap on desktop.
- **Profile mark:** designed to read inside a circular crop — the wordmark sits within the safe inner circle; corners may be cropped to a circle on most platforms.

## Palette (canonical = the live site, `workit/src/app/globals.css` light theme)
- Ochre `#d97742` (primary) · deep ochre `#b85a2a`
- Ink `#1f1612`
- Cream `#faf4ec`
- Sage `#5d7a47` · Brick `#a93226`
- Type: the site uses **Fraunces** (display) + **Manrope** (body) via next/font.
  Rasterised assets here use Georgia / Arial as stand-ins (the renderer has no
  access to the webfonts); keep hierarchy identical so they read as one brand.
- Note: the `#C2632E`-family palette in `workit/growth/workit-growth-20k.html`
  is an older variant — superseded by the site palette above.
