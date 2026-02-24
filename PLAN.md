
# AG16 Plan

## UI Polish
- [x] Saved Grids modal: add delete confirmation (e.g. "Are you sure?" prompt or hold-to-delete) to prevent accidental deletion
- [x] Saved Grids modal: load grid on row click instead of requiring the play button

## Analytics
- [ ] Add user tracking (e.g. Google Analytics, Plausible, or similar)

## Branding
- [x] Rename project to **AG16**

## Audio
- [x] Implement per-channel browser synth (Web Audio API, replaced Tone.js)
- [x] Synth presets: Basic (sine, triangle, square, sawtooth), Instrument (pad, lead, bass, pluck, bell, organ, strings), Percussion (kick, snare, hi-hat, tom, clap, rimshot)
- [x] Custom synth parameters per channel (waveform, ADSR, cutoff, resonance)
- [x] Percussion synthesis with pitch variation by grid position

## Sharing
- [ ] Fix link sharing functionality

## Legal / Compliance
- [ ] Privacy Policy page (data collected, localStorage usage, analytics, no personal data sold)
- [ ] Terms of Service / Terms of Use page
- [ ] Cookie notice / consent banner (if using analytics cookies)
- [ ] GDPR compliance (if serving EU users — consent for tracking, data deletion)
- [ ] Copyright / license notice in footer
- [ ] Contact info or email for legal inquiries

## Pre-Launch Checklist
- [ ] Favicon and app icons (PWA manifest icons, Apple touch icon)
- [ ] Open Graph / social meta tags (og:title, og:description, og:image for link previews)
- [ ] SEO basics (meta description, title tag, canonical URL)
- [ ] 404 / error page
- [ ] Performance audit (Lighthouse)
- [ ] Accessibility audit (keyboard nav, screen reader, color contrast)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness check
- [ ] SSL / HTTPS configured
- [ ] Custom domain setup
- [ ] Analytics verified working

## Nice to Maybe Have
- [ ] Enable/disable both sound and MIDI app-wide from inside the channel popup
- [ ] Pull channel enable/disable and volume controls into the channel popup

## Release
- [ ] Deploy to production
- [ ] Announce launch
