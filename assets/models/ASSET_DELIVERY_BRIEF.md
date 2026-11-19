# Timzy Fashion — 3D asset delivery brief

## Goal
A **realistic adult male human**, fully clothed, in a neutral standing pose, wearing interchangeable Nigerian Senator, Kaftan and Agbada garments. Must look credible at front, side and back in a mobile 360° viewer. **Do not deliver a geometric mannequin, cylinder-based clothing or 2D render in place of GLB files.**

## Files to deliver (exact paths)
- `assets/models/timzy-male-avatar.glb`: realistic adult male body, head, hands and footwear/neutral base; skin and hair textures included or embedded
- `assets/models/timzy-senator.glb`: fitted Senator top and trousers
- `assets/models/timzy-kaftan.glb`: fitted Kaftan outfit
- `assets/models/timzy-agbada.glb`: fitted Agbada layers and trousers

## Technical requirements
- Binary glTF 2.0 (.glb), embedded textures, PBR materials; no external textures or remote dependency
- All four files use **exactly the same** pose, coordinates, orientation, scale and origin; clothing must fit the supplied avatar and have no obvious body intersections
- Upright, centered model; positive Y up; face the camera from the initial front view; correct front/back normals
- Mobile-friendly geometry and textures; target <= 10 MB avatar, <= 8 MB per garment where visual quality permits; compressed textures if supported by the runtime
- Garment colour-editable primary fabric materials, separate trim and skin/face/footwear materials; avoid tinting the entire scene
- No animation required initially. No measurement-accurate fit claims
- Include a README or text record with creator, source URL, license, commercial use and redistribution rights, and any attribution requirements
- Provide screenshots showing each garment on the avatar from front, side and back
- Confirm real garment geometry (not merely a clothing texture applied to casual wear)

## Acceptance
1. All four GLBs open in an independent glTF viewer.
2. Senator, Kaftan and Agbada each fit the *same* avatar at its native pose and origin.
3. Front/side/back views have natural proportions and no missing limbs, floating garments, severe clipping or broken textures.
4. The model is usable on iOS Safari and Android Chrome.
5. Files and license details can be committed to this repository for commercial website use.

## Implementation ownership
ChatGPT can integrate files into the existing Three.js loader, connect outfit selection, add asset validation, handle graceful failures and prepare testing. A 3D artist or legally usable existing assets must supply the realistic human and fitted Nigerian garment geometry. A photo, a Canva design or a generated 2D illustration is **not** a substitute for a rotatable GLB model.

## Current state
PR #47 contains loader infrastructure but **none** of the four requested binary GLB assets. Do not merge it as a completed fitting room.
