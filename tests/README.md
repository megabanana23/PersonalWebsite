# Verification

Run the existing renderer and event-data checks:

```sh
node --test tests/motion-renderer.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The navigation regression suite requires Playwright available to Node and a
Chromium browser. It starts and closes its own local server:

```sh
node --test tests/navigation-browser.cjs
```

To use an existing Google Chrome installation, set `BROWSER_CHANNEL=chrome`.
If Playwright is installed outside this repository, set `NODE_PATH` to that
installation's `node_modules` directory. The website itself needs no package
installation or build step.

Coverage includes smooth wheel input, page transitions without reloads,
back/forward scroll and accordion restoration, section fragments, keyboard
focus, theme persistence, carousel reinitialization, mobile navigation,
live reduced-motion changes, and missing-library/no-JavaScript fallbacks.
