# Timzy Virtual Tailoring Studio — asset acceptance checklist

## Status
**Blocked on actual licensed 3D assets.** Do not merge this PR until the required avatar file is present and rendered on mobile. The current procedural geometry is only an illustrative concept and must not be advertised as realistic fitting.

## Avatar
Install `assets/models/timzy-male-avatar.glb` as a self-hosted GLB, not a hotlinked external URL. Required: realistic adult male body, fully clothed neutral base, correct skin and body proportions, PBR materials, front/back details, proper license for commercial use, optimized for mobile. Document artist, source, license, and redistribution rights. Confirm no sensitive facial likeness or identity issues.

## Garments
Provide separate fitted mesh assets for Senator, Kaftan and Agbada. Each should use the **same avatar rig / pose / coordinate system** and cover front and back correctly, with sleeve, collar, trouser and garment seams. Garment meshes must be selectable and material colour parameters mapped to actual catalogue variants. Avoid stretching a single cylinder mesh into multiple garments. Do not imply cloth physics or accurate bespoke fit until independently validated.

## Product data and customer safety
Only show product variants actually published in Firestore; no invented stock, price or fabric. If fabric photos cannot be mapped to a UV material, label colours illustrative. Save design as preview only; tailor must confirm measurements, availability, fit and final quote. Do not send avatar data or measurements to third parties without consent.

## QA before merge
- Confirm avatar HTTP 200 and GLB parsing on GitHub Pages, iOS Safari and Android Chrome.
- Confirm human preview rotates front, side, back; no blank canvas, broken textures or missing limbs.
- Test low-memory phones and slow networks, accessibility controls and fallback.
- Test three garment meshes on the avatar, with 360° visibility and no clipping.
- Confirm the website does not claim accurate fitting or real garment visualization before the assets exist.

## Why this PR exists
PR #44 used a third-party asset URL whose reliability and licensing have not been verified. This PR changes the loader to a controlled self-hosted path but **does not contain the avatar asset**. It is a preparatory draft, not a working replacement.
