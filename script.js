(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let storedTheme;
  try { storedTheme = localStorage.getItem('theme'); } catch {}
  if (storedTheme === 'light' || storedTheme === 'dark') {
    root.dataset.theme = storedTheme;
  }

  const activeTheme = () => root.dataset.theme || (systemTheme.matches ? 'dark' : 'light');

  const updateThemeLabel = () => {
    if (!themeToggle) return;
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    themeToggle.setAttribute('aria-label', `Switch to ${next} mode`);
    themeToggle.setAttribute('title', `Switch to ${next} mode`);
  };

  updateThemeLabel();

  themeToggle?.addEventListener('click', () => {
    const next = activeTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    updateThemeLabel();
  });

  systemTheme.addEventListener?.('change', () => {
    if (!root.dataset.theme) updateThemeLabel();
  });

  const closeMenu = () => {
    if (!menuToggle || !navMenu) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
    navMenu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
  };

  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    menuToggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
    navMenu?.classList.toggle('is-open', !open);
    document.body.classList.toggle('menu-open', !open);
  });

  navMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') { closeMenu(); menuToggle.focus(); }
  });

  window.matchMedia('(max-width: 720px)').addEventListener?.('change', closeMenu);

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const revealItems = document.querySelectorAll('[data-reveal], .cert, .skill-group, .contact-card');
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -36px 0px' });
    revealItems.forEach((item) => {
      const siblings = [...item.parentElement.children];
      item.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(item) % 3, 2) * 70}ms`);
      item.classList.add('reveal-ready');
      observer.observe(item);
    });
    // Focusing a link must never leave its containing card invisible.
    document.addEventListener('focusin', (event) => {
      const item = event.target.closest('.reveal-ready');
      if (item) { item.classList.add('is-visible'); observer.unobserve(item); }
    });
    reducedMotion.addEventListener?.('change', () => {
      if (reducedMotion.matches) {
        observer.disconnect();
        revealItems.forEach(item => item.classList.add('is-visible'));
      }
    });
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const slides = [...carousel.querySelectorAll('[data-role-slide]')];
    const viewport = carousel.querySelector('[data-role-slides]');
    const controls = document.createElement('div');
    controls.className = 'carousel-controls';
    const dots = slides.map((slide, index) => {
      slide.id = `role-slide-${index + 1}`;
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Show ${slide.querySelector('h2').textContent}`);
      dot.setAttribute('aria-controls', slide.id);
      dot.addEventListener('click', () => showSlide(index));
      controls.append(dot);
      return dot;
    });
    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'carousel-pause';
    controls.append(pause);
    carousel.append(controls);
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', 'Swipe or use left and right arrow keys to explore roles');
    let current = 0;
    let timer;
    let paused = false;
    let hovered = false;
    let drag = null;
    const schedule = () => {
      clearTimeout(timer);
      if (!document.hidden && !reducedMotion.matches && !paused && !hovered && !drag && !carousel.contains(document.activeElement)) {
        timer = setTimeout(() => showSlide(current + 1), 5500);
      }
    };
    const positionSlides = (offset = 0) => {
      slides.forEach((slide, i) => {
        slide.style.transform = `translateX(calc(${(i - current) * 100}% + ${offset}px))`;
      });
    };
    const showSlide = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === current;
        slide.setAttribute('aria-hidden', String(!active));
        slide.inert = !active;
        slide.classList.toggle('is-active', active);
        dots[i].setAttribute('aria-pressed', String(active));
      });
      positionSlides();
      schedule();
    };
    const syncPause = () => {
      pause.textContent = paused ? '▶' : 'Ⅱ';
      pause.setAttribute('aria-label', paused ? 'Resume automatic rotation' : 'Pause automatic rotation');
      pause.hidden = reducedMotion.matches;
      schedule();
    };
    pause.addEventListener('click', () => { paused = !paused; syncPause(); });
    controls.addEventListener('keydown', (event) => {
      const index = dots.indexOf(document.activeElement);
      if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length;
      showSlide(next);
      dots[next].focus();
    });
    viewport.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      showSlide(current + (event.key === 'ArrowRight' ? 1 : -1));
    });
    viewport.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
      schedule();
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > Math.abs(event.clientY - drag.y)) positionSlides(dx);
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag = null;
      viewport.classList.remove('is-dragging');
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      const advance = event.type === 'pointerup' && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy);
      showSlide(current + (advance ? (dx < 0 ? 1 : -1) : 0));
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', endDrag);
    carousel.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', schedule);
    carousel.addEventListener('focusout', () => setTimeout(schedule, 0));
    reducedMotion.addEventListener?.('change', syncPause);
    document.addEventListener('visibilitychange', schedule);
    carousel.classList.add('carousel-ready');
    syncPause();
    showSlide(current);
  }

  document.querySelectorAll('[data-photo-carousel]').forEach((gallery) => {
    const track = gallery.querySelector('.photo-track');
    const photos = [...track.children];
    const controls = document.createElement('div');
    controls.className = 'photo-controls';
    let current = 0;
    const previous = document.createElement('button');
    const next = document.createElement('button');
    const counter = document.createElement('span');
    counter.className = 'photo-counter';
    counter.setAttribute('aria-live', 'polite');
    counter.setAttribute('aria-atomic', 'true');
    const update = () => {
      if (track.clientWidth) current = Math.max(0, Math.min(photos.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
      counter.textContent = `${current + 1} / ${photos.length}`;
      previous.disabled = current === 0;
      next.disabled = current === photos.length - 1;
    };
    const go = (index) => {
      current = Math.max(0, Math.min(photos.length - 1, index));
      track.scrollTo({left: current * track.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    };
    [previous, next].forEach((button, i) => {
      button.type = 'button';
      button.className = 'icon-button';
      button.textContent = i ? '→' : '←';
      button.setAttribute('aria-label', i ? 'Next photo' : 'Previous photo');
      button.addEventListener('click', () => go(current + (i ? 1 : -1)));
    });
    controls.append(previous, counter, next);
    gallery.append(controls);
    track.tabIndex = 0;
    track.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      go(event.key === 'Home' ? 0 : event.key === 'End' ? photos.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
    });
    track.addEventListener('scroll', update, {passive: true});
    // Preserve the selected photo when an accordion reopens or the viewport changes.
    new ResizeObserver(() => {
      if (track.clientWidth) track.scrollTo({left: current * track.clientWidth, behavior: 'instant'});
      update();
    }).observe(track);
    update();
  });

  const revealHashTarget = () => {
    let hash;
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(hash);
    if (!target) return;
    if (target.matches('details')) {
      target.open = true;
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  window.addEventListener('hashchange', revealHashTarget);
  revealHashTarget();

  const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  if (sectionLinks.length) {
    let scrollQueued = false;
    const updateSection = () => {
      let active;
      for (const link of sectionLinks) {
        const section = document.getElementById(link.hash.slice(1));
        if (section && section.getBoundingClientRect().top <= 160) {
          if (!active || section.offsetTop > active.section.offsetTop) active = { link, section };
        }
      }
      sectionLinks.forEach(link => {
        if (link === active?.link) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      scrollQueued = false;
    };
    window.addEventListener('scroll', () => {
      if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateSection); }
    }, { passive: true });
    updateSection();
  }

  let canvas = document.querySelector('[data-particle-canvas]');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.dataset.particleCanvas = '';
    canvas.setAttribute('aria-hidden', 'true');
  }
  if (canvas) {
    // Keep one viewport-sized canvas behind every section and every full page.
    canvas.classList.add('page-particles');
    if (canvas.parentElement !== document.body || canvas !== document.body.firstElementChild) {
      document.body.prepend(canvas);
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    const pointer = { x: -1000, y: -1000, active: false };
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const compactScreen = window.matchMedia('(max-width: 700px)');
    const rippleDuration = 900;
    const rippleRadius = 155;
    const rippleStrength = 0.032;
    let particles = [];
    let touchStart = null;
    let ripples = [];
    let animationFrame;
    let canvasWidth = 0;

    const resizeParticles = () => {
      const width = window.innerWidth;
      if (compactScreen.matches && particles.length && Math.abs(width - canvasWidth) < 2) return;

      canvasWidth = width;
      const stableMobileHeight = Math.max(window.innerHeight, window.screen?.height || 0);
      const rect = {
        width,
        height: compactScreen.matches ? stableMobileHeight : window.innerHeight,
      };
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const touchPhone = compactScreen.matches && !finePointer.matches;
      const count = touchPhone
        ? Math.min(48, Math.max(36, Math.round(rect.width / 9.5)))
        : compactScreen.matches
        ? Math.min(34, Math.max(22, Math.round(rect.width / 15)))
        : Math.min(76, Math.max(34, Math.round(rect.width / 18)));
      const drift = compactScreen.matches ? 0.13 : 0.28;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * drift,
        vy: (Math.random() - 0.5) * drift,
        r: 1.2 + Math.random() * 1.8,
      }));
    };

    const drawParticles = () => {
      if (document.hidden || reducedMotion.matches) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const accent = getComputedStyle(root).getPropertyValue('--accent').trim();
      const now = performance.now();
      ripples = ripples.filter((ripple) => now - ripple.startedAt < rippleDuration);

      particles.forEach((particle) => {
        if (pointer.active && finePointer.matches) {
          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 150 && distance > 0) {
            const force = (150 - distance) / 150;
            particle.vx += (dx / distance) * force * 0.045;
            particle.vy += (dy / distance) * force * 0.045;
          }
        }
        ripples.forEach((ripple) => {
          const progress = (now - ripple.startedAt) / rippleDuration;
          const dx = particle.x - ripple.x;
          const dy = particle.y - ripple.y;
          const distance = Math.hypot(dx, dy);
          if (distance < rippleRadius && distance > 0) {
            const force = (1 - distance / rippleRadius) * (1 - progress) * rippleStrength;
            particle.vx += (dx / distance) * force;
            particle.vy += (dy / distance) * force;
          }
        });
        particle.vx *= 0.992;
        particle.vy *= 0.992;
        const speed = Math.hypot(particle.vx, particle.vy);
        const maxSpeed = 0.72;
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -10) particle.x = width + 10;
        if (particle.x > width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = height + 10;
        if (particle.y > height + 10) particle.y = -10;
      });

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < 125) {
            context.globalAlpha = (1 - distance / 125) * 0.23;
            context.strokeStyle = accent;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      particles.forEach((particle) => {
        context.globalAlpha = 0.5;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
      });

      ripples.forEach((ripple) => {
        const progress = (now - ripple.startedAt) / rippleDuration;
        context.globalAlpha = (1 - progress) * 0.3;
        context.strokeStyle = accent;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(ripple.x, ripple.y, 18 + progress * 120, 0, Math.PI * 2);
        context.stroke();
      });
      context.globalAlpha = 1;
      animationFrame = requestAnimationFrame(drawParticles);
    };

    document.addEventListener('pointermove', (event) => {
      if (!finePointer.matches || event.pointerType === 'touch') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    });
    window.addEventListener('pointerleave', () => { pointer.active = false; });
    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch') return;
      pointer.active = false;
      touchStart = {
        x: event.clientX,
        y: event.clientY,
        startedAt: performance.now(),
      };
    }, { passive: true });
    document.addEventListener('pointerup', (event) => {
      if (event.pointerType !== 'touch' || !touchStart) return;
      const movement = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y);
      const duration = performance.now() - touchStart.startedAt;
      if (movement < 12 && duration < 350) {
        ripples.push({ x: event.clientX, y: event.clientY, startedAt: performance.now() });
        if (ripples.length > 3) ripples.shift();
      }
      touchStart = null;
    }, { passive: true });
    document.addEventListener('pointercancel', () => { touchStart = null; }, { passive: true });
    window.addEventListener('resize', resizeParticles);
    const syncAnimation = () => {
      cancelAnimationFrame(animationFrame);
      if (!document.hidden && !reducedMotion.matches) { resizeParticles(); drawParticles(); }
    };
    document.addEventListener('visibilitychange', syncAnimation);
    reducedMotion.addEventListener?.('change', syncAnimation);
    syncAnimation();
  }
})();
