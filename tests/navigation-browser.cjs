const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let browser, server, base;
before(async () => {
  server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
      if (!file.startsWith(`${root}${path.sep}`)) throw new Error('Invalid path');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      response.end(await fs.readFile(file));
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
const setup = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
};
const settled = (page, namespace) => page.waitForFunction(namespace =>
  document.querySelector(`[data-barba-namespace="${namespace}"]`) &&
  !document.documentElement.classList.contains('is-transitioning') &&
  document.querySelectorAll('[data-barba="container"]').length === 1,
namespace);
// A real pointer click avoids Playwright's automatic scrollIntoView on sticky
// navigation, which itself changes the scroll position being tested.
const clickNav = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `Visible navigation link: ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};
const contact = async page => {
  await clickNav(page, '.nav-links a[href="contact.html"]');
  await settled(page, 'contact');
};

test('smooth wheel, page transitions, scroll history, and theme persist without reloads', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(base);
    await page.evaluate(() => { window.navigationTestToken = 'same-document'; });
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 600);
    await page.waitForFunction(() => scrollY > 0 && scrollY < 600);
    await page.waitForFunction(() => Math.abs(scrollY - 600) < 2);
    const saved = await page.evaluate(() => scrollY);
    await clickNav(page, '[data-theme-toggle]');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await contact(page);
    assert.equal(await page.title(), 'Contact | Om Ramanathan');
    assert.equal(await page.locator('[rel="canonical"]').getAttribute('href'), 'https://www.omramanathan.com/contact.html');
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.goBack();
    await settled(page, 'profile');
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - saved) < 2);
    await page.goForward();
    await settled(page, 'contact');
    await page.goBack();
    await settled(page, 'profile');
    assert.equal(await page.evaluate(() => window.navigationTestToken), 'same-document');
    assert.equal(await page.locator('.carousel-controls').count(), 1);
    assert.equal(await page.locator('.photo-controls').count(), 3);
    assert.equal(await page.locator('.page-particles').count(), 1);
    assert.equal(await page.locator('script[type="application/ld+json"]').count(), 1);
    await clickNav(page, '[data-theme-toggle]');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('cross-page and same-page anchors preserve fragments, focus, and history', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(`${base}/contact.html`);
    await clickNav(page, '.nav-links a[href="index.html#projects"]');
    await settled(page, 'profile');
    assert.equal(new URL(page.url()).hash, '#projects');
    assert.ok(Math.abs(await page.locator('#projects').evaluate(element => element.getBoundingClientRect().top) - 100) < 2);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'projects');
    const projectsScroll = await page.evaluate(() => scrollY);
    await clickNav(page, '.nav-links a[href="#experience"]');
    await page.waitForFunction(() => Math.abs(document.getElementById('experience').getBoundingClientRect().top - 100) < 2);
    assert.equal(new URL(page.url()).hash, '#experience');
    await page.goBack();
    await page.waitForFunction(y => Math.abs(scrollY - y) < 2, projectsScroll);
    assert.equal(new URL(page.url()).hash, '#projects');
    await page.goBack();
    await settled(page, 'contact');
    assert.equal(new URL(page.url()).hash, '');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('workshop deep links and photo carousels survive repeated page visits', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.goto(`${base}/index.html#workshop-scratch`);
    await page.waitForFunction(() => document.getElementById('workshop-scratch').open && Math.abs(document.getElementById('workshop-scratch').getBoundingClientRect().top - 100) < 2);
    const gallery = page.locator('#workshop-scratch [data-photo-carousel]');
    await gallery.getByRole('button', { name: 'Next photo' }).click();
    await page.waitForFunction(() => document.querySelector('#workshop-scratch .photo-counter').textContent.startsWith('2 /'));
    const scroll = await page.evaluate(() => scrollY);
    await contact(page);
    await page.goBack();
    await settled(page, 'profile');
    assert.equal(await page.locator('#workshop-scratch').evaluate(element => element.open), true);
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scroll) < 2);
    assert.equal(await gallery.locator('.photo-controls').count(), 1);
    await gallery.getByRole('button', { name: 'Next photo' }).click();
    await page.waitForFunction(() => document.querySelector('#workshop-scratch .photo-counter').textContent.startsWith('2 /'));
    // Opening a second workshop also restores its expanded layout on Back.
    await page.locator('#workshop-lego-bridge > summary').click();
    await contact(page);
    await page.goBack();
    await settled(page, 'profile');
    assert.equal(await page.locator('#workshop-lego-bridge').evaluate(element => element.open), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('reduced motion works on initial load and when changed during a transition', async () => {
  const { context, page, errors } = await setup({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    assert.equal(await page.locator('html').evaluate(element => element.classList.contains('lenis')), false);
    await contact(page);
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.classList.contains('lenis'));
    await clickNav(page, '.nav-links a[href="index.html#projects"]');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await settled(page, 'profile');
    assert.equal(await page.locator('html').evaluate(element => element.classList.contains('lenis')), false);
    assert.ok(Math.abs(await page.locator('#projects').evaluate(element => element.getBoundingClientRect().top) - 100) < 2);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('mobile navigation releases scroll after anchor and page navigation', async () => {
  const { context, page, errors } = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await page.goto(base);
    assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
    await page.locator('[data-menu-toggle]').click();
    await page.waitForFunction(() => document.documentElement.classList.contains('lenis-stopped'));
    await clickNav(page, '.nav-links a[href="#projects"]');
    await page.waitForFunction(() => Math.abs(document.getElementById('projects').getBoundingClientRect().top - 100) < 2);
    assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('html').evaluate(element => element.classList.contains('lenis-stopped')), false);
    await page.locator('[data-menu-toggle]').click();
    await contact(page);
    assert.equal(await page.locator('body').evaluate(element => element.classList.contains('menu-open')), false);
    assert.equal(await page.locator('html').evaluate(element => element.classList.contains('lenis-stopped')), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('the site remains usable with missing motion libraries or disabled JavaScript', async () => {
  const { context, page, errors } = await setup();
  try {
    await page.route('**/assets/vendor/*.js', route => route.abort());
    await page.goto(base);
    await page.locator('.nav-links a[href="#experience"]').click();
    await page.waitForFunction(() => Math.abs(document.getElementById('experience').getBoundingClientRect().top - 100) < 2);
    await contact(page);
    assert.equal(await page.title(), 'Contact | Om Ramanathan');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
  const staticContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await staticContext.newPage();
    await staticPage.goto(base);
    await contact(staticPage);
    assert.equal(await staticPage.getByRole('heading', { level: 1 }).isVisible(), true);
  } finally { await staticContext.close(); }
});
