(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  const storedTheme = localStorage.getItem('theme');
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
    localStorage.setItem('theme', next);
    updateThemeLabel();
  });

  systemTheme.addEventListener?.('change', () => {
    if (!root.dataset.theme) updateThemeLabel();
  });

  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  const revealItems = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  }

  let canvas = document.querySelector('[data-particle-canvas]');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'page-particles';
    canvas.dataset.particleCanvas = '';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
  }
  if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const context = canvas.getContext('2d');
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
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animationFrame);
      else drawParticles();
    });
    resizeParticles();
    drawParticles();
  }
})();
