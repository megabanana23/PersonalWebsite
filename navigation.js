(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const positions = new Map();
  const base = new URL('./', location.href);
  const pagePaths = new Set([base.pathname, new URL('index.html', base).pathname, new URL('contact.html', base).pathname]);
  let page = document.querySelector('[data-barba="container"]');
  if (!page) return;
  let pageURL = new URL(location.href);
  let navigationURL;
  let currentIndex = 0;
  let transitioning = false;
  let lenis;
  let disposePage;
  let disposeMotion;
  let barbaReady = false;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const savePosition = () => positions.set(currentIndex, {
    x: window.scrollX,
    y: window.scrollY,
    openDetails: [...page.querySelectorAll('details')].flatMap((details, index) => details.open ? [index] : []),
  });
  const restoreDetails = (position) => {
    if (!position) return;
    page.querySelectorAll('details').forEach((details, index) => { details.open = position.openDetails.includes(index); });
  };

  const mount = (container) => {
    page = container;
    disposePage = window.initSitePage(container);
    disposeMotion = window.initSiteMotion(container);
  };
  const unmount = () => {
    disposeMotion?.();
    disposePage?.();
  };
  const syncScrollState = () => {
    if (transitioning || document.body.classList.contains('menu-open') || document.hidden) lenis?.stop();
    else lenis?.start();
  };
  const syncLenis = () => {
    lenis?.destroy();
    lenis = undefined;
    if (window.Lenis && !reducedMotion.matches) {
      lenis = new window.Lenis({
        autoRaf: true,
        lerp: 0.12,
        smoothWheel: true,
        syncTouch: false,
        // Carousels and the mobile menu retain their own native scrolling.
        prevent: node => node.matches?.('.photo-track') || (node.matches?.('[data-nav-menu]') && document.body.classList.contains('menu-open')),
      });
      syncScrollState();
    }
  };
  const targetForHash = (hash) => {
    try { return hash ? page.querySelector(`[id="${CSS.escape(decodeURIComponent(hash.slice(1)))}"]`) : null; }
    catch { return null; }
  };
  const openTarget = (target) => {
    for (let element = target; element && element !== page; element = element.parentElement) {
      if (element.matches('details')) element.open = true;
      if (element.classList.contains('reveal-ready')) {
        element.classList.add('is-visible');
        // A reveal's translate would otherwise shift the anchor after scrolling.
        element.getAnimations?.().forEach(animation => {
          if (['translate', 'opacity'].includes(animation.transitionProperty)) animation.finish();
        });
      }
    }
  };
  const focusTarget = (target) => {
    const element = target.matches('details') ? target.querySelector('summary') : target;
    if (!element) return;
    if (!element.matches('a[href], button, input, select, textarea, summary, [tabindex]')) element.tabIndex = -1;
    element.focus({ preventScroll: true });
  };
  const scrollTo = (position, immediate = true) => {
    const y = typeof position === 'number' ? position : position.y;
    if (lenis) {
      lenis.resize();
      lenis.scrollTo(y, { immediate, force: true, duration: 0.85, lerp: undefined });
    } else {
      window.scrollTo({ top: y, left: position.x || 0, behavior: immediate || reducedMotion.matches ? 'instant' : 'smooth' });
    }
  };
  const goToHash = async (hash, { immediate = false, focus = true } = {}) => {
    const target = targetForHash(hash);
    if (!target) return false;
    openTarget(target);
    await nextFrame();
    // Use one consistent header clearance rather than adding CSS scroll margin
    // and scroll padding together (both are present on workshop sections).
    const clearance = parseFloat(getComputedStyle(root).scrollPaddingTop) || 100;
    scrollTo(Math.max(0, target.getBoundingClientRect().top + window.scrollY - clearance), immediate);
    if (focus) focusTarget(target);
    return true;
  };
  const samePage = (url) => url.origin === pageURL.origin && url.pathname === pageURL.pathname && url.search === pageURL.search;

  // Handle anchors before Barba's document listener, preserving URL/history,
  // keyboard focus, and deep links into closed workshop accordions.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.closest('[data-barba-prevent]')) return;
    const url = new URL(link.href);
    if (!samePage(url)) navigationURL = url;
    if (!samePage(url) || !url.hash || !targetForHash(url.hash)) return;
    event.preventDefault();
    if (transitioning) return;
    savePosition();
    if (url.href !== location.href) {
      if (barbaReady) {
        window.barba.history.add(url.href, link);
        currentIndex = history.state.index;
      } else history.pushState(null, '', url.href);
    }
    pageURL = url;
    document.body.classList.remove('menu-open');
    syncScrollState();
    goToHash(url.hash);
  });

  // Barba ignores same-page popstate events; explicitly restore anchor entries.
  window.addEventListener('popstate', (event) => {
    const url = new URL(location.href);
    navigationURL = url;
    if (!samePage(url) || transitioning) return;
    savePosition();
    if (barbaReady && event.state?.from === 'barba') {
      window.barba.history.change(url.href, 'popstate', event);
      currentIndex = event.state.index;
    }
    pageURL = url;
    const position = barbaReady ? positions.get(currentIndex) : null;
    restoreDetails(position);
    const target = targetForHash(url.hash);
    if (target) openTarget(target);
    nextFrame().then(() => {
      if (position) scrollTo(position);
      else if (target) goToHash(url.hash, { immediate: true });
      else scrollTo(0);
      if (target) focusTarget(target);
    });
  });

  const headSelector = 'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"]';
  const updateHead = (html) => {
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    document.title = nextDocument.title;
    document.head.querySelectorAll(headSelector).forEach(element => element.remove());
    nextDocument.head.querySelectorAll(headSelector).forEach(element => document.head.append(document.importNode(element, true)));
  };
  const animate = async (element, frames, duration) => {
    if (!element || reducedMotion.matches || !element.animate) return;
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
    const stop = () => animation.finish();
    reducedMotion.addEventListener('change', stop, { once: true });
    try { await animation.finished; } catch { /* A cancelled animation must not block navigation. */ }
    finally {
      reducedMotion.removeEventListener('change', stop);
      animation.cancel();
    }
  };

  mount(page);
  syncLenis();
  reducedMotion.addEventListener('change', syncLenis);
  new MutationObserver(syncScrollState).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', syncScrollState);
  window.addEventListener('pagehide', () => {
    savePosition();
    lenis?.destroy();
    lenis = undefined;
    if (barbaReady) history.scrollRestoration = 'auto';
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      if (barbaReady) history.scrollRestoration = 'manual';
      syncLenis();
    }
  });

  if (window.barba && /^https?:$/.test(location.protocol)) {
    history.scrollRestoration = 'manual';
    window.barba.init({
      preventRunning: true,
      timeout: 7000,
      // Redirect-only legacy pages, downloads, mail, and external destinations
      // continue to use the browser's normal navigation.
      prevent: ({ el, href }) => {
        const url = new URL(href, location.href);
        return !pagePaths.has(url.pathname) || url.origin !== location.origin || (el.target && el.target !== '_self');
      },
      requestError: (_trigger, action, url) => {
        if (action === 'click') location.assign(url);
        return false;
      },
      transitions: [{
        name: 'quiet-page-change',
        beforeLeave({ next, trigger }) {
          navigationURL = trigger?.href ? new URL(trigger.href) : navigationURL || new URL(next.url.href);
          savePosition();
          transitioning = true;
          root.classList.add('is-transitioning');
          document.body.setAttribute('aria-busy', 'true');
          syncScrollState();
        },
        async leave({ current }) {
          current.container.inert = true;
          await animate(current.container, [{ opacity: 1 }, { opacity: 0 }], 170);
          unmount();
          current.container.hidden = true;
        },
        async beforeEnter({ next, trigger }) {
          updateHead(next.html);
          mount(next.container);
          // XHR responseURL drops fragments. Keep the actual clicked/history
          // destination so cross-page section links survive a cached response.
          pageURL = navigationURL || new URL(next.url.href);
          if (pageURL.hash && location.href !== pageURL.href) window.barba.history.add(pageURL.href, 'barba', 'replace');
          currentIndex = history.state.index;
          const position = ['back', 'forward', 'popstate'].includes(trigger) ? positions.get(currentIndex) : null;
          restoreDetails(position);
          const target = targetForHash(pageURL.hash);
          if (target) openTarget(target);
          await nextFrame();
          lenis?.resize();
          if (position) scrollTo(position);
          else if (target) await goToHash(pageURL.hash, { immediate: true, focus: false });
          else scrollTo(0);
        },
        async enter({ next }) {
          await Promise.all([
            animate(next.container, [{ opacity: 0 }, { opacity: 1 }], 320),
            animate(next.container.querySelector('main'), [{ transform: 'translateY(12px)' }, { transform: 'translateY(0)' }], 400),
          ]);
        },
        afterEnter({ next }) {
          focusTarget(targetForHash(pageURL.hash) || next.container.querySelector('h1') || next.container.querySelector('main'));
        },
        after() {
          transitioning = false;
          root.classList.remove('is-transitioning');
          document.body.removeAttribute('aria-busy');
          syncScrollState();
          lenis?.resize();
          navigationURL = undefined;
        },
      }],
    });
    barbaReady = true;
    currentIndex = history.state.index;
  }
  if (location.hash) {
    goToHash(location.hash, { immediate: true, focus: false });
    // Initial native fragment scrolling runs during load and applies both CSS
    // offsets. Resolve once more after it and the initial font layout complete.
    window.addEventListener('load', () => goToHash(location.hash, { immediate: true, focus: false }), { once: true });
  }
})();
