# Motion dependencies

Pinned, locally served production builds; no runtime CDN requests or build step.

- Barba core 2.10.3: https://barba.js.org/docs/getstarted/intro/
  Source: https://cdn.jsdelivr.net/npm/@barba/core@2.10.3/dist/barba.umd.js
  License: `barba-LICENSE.txt` (MIT).
- Lenis 1.3.26: https://github.com/darkroomengineering/lenis
  Source: https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js
  Styles: https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.css
  License: `lenis-LICENSE.txt` (MIT).

`lifecycle.js` owns page resources; `script.js` and `motion.js` expose initializers.
`navigation.js` mounts them initially and at each Barba transition, disposes them
before replacement, and keeps a single Lenis instance and particle backdrop.

Only the profile and contact page opt into Barba. Legacy redirect pages use
normal browser navigation. Same-page anchors open workshop details, update
history, and move keyboard focus. Browser back/forward restores scroll positions.
Reduced motion disables Lenis and transition animations, including live changes.
Touch scrolling and nested photo carousels remain native.
