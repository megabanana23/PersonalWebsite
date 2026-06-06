/* ============================================================
   Om Ramanathan – Personal Website Scripts
   Vanilla JS · No dependencies
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ----------------------------------------------------------
     1. SCROLL-REVEAL ANIMATIONS
     Uses IntersectionObserver to fade-in elements as they
     enter the viewport. Grid items receive staggered delays.
  ---------------------------------------------------------- */
  const revealElements = document.querySelectorAll('.fade-in');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target); // animate once
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  revealElements.forEach((el) => {
    // Stagger siblings inside grid containers
    const parent = el.parentElement;
    if (parent && parent.children.length > 1) {
      const index = Array.from(parent.children).indexOf(el);
      el.style.transitionDelay = `${index * 0.1}s`;
    }
    revealObserver.observe(el);
  });

  /* ----------------------------------------------------------
     2. NAVIGATION
     • Add 'scrolled' class to <nav> after 50 px
     • Smooth-scroll to sections on link click
     • Mobile hamburger toggle
     • Highlight the active section link on scroll
  ---------------------------------------------------------- */
  const nav = document.querySelector('nav');
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  // --- Scroll class on nav ---
  const handleNavScroll = () => {
    if (!nav) return;
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };

  // --- Active section highlighting ---
  const highlightActiveLink = () => {
    const scrollY = window.scrollY + 120; // offset for fixed nav

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navLinks.forEach((link) => link.classList.remove('active'));
        const activeLink = document.querySelector(
          `.nav-menu a[href="#${sectionId}"]`
        );
        if (activeLink) activeLink.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', () => {
    handleNavScroll();
    highlightActiveLink();
  });

  // Run once on load so the initial state is correct
  handleNavScroll();
  highlightActiveLink();

  // --- Hamburger toggle ---
  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });
  }

  // --- Close mobile menu on link click ---
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (hamburger) hamburger.classList.remove('active');
      if (navMenu) navMenu.classList.remove('active');
    });
  });

  /* ----------------------------------------------------------
     3. HERO TYPEWRITER EFFECT
     Cycles through a list of phrases, typing and deleting
     each character at configurable speeds.
  ---------------------------------------------------------- */
  const typewriterEl = document.querySelector('.typewriter-text');
  const phrases = [
    'Founder & Developer',
    'Water Safety Instructor',
    'Swim Team Coach',
    'Academic Tutor',
    'Aspiring Engineer',
  ];

  if (typewriterEl) {
    const TYPE_SPEED = 80;   // ms per character typed
    const DELETE_SPEED = 40; // ms per character deleted
    const PAUSE_AFTER = 2000; // ms to pause after full phrase
    const PAUSE_BEFORE = 500; // ms to pause before next phrase

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const typewrite = () => {
      const currentPhrase = phrases[phraseIndex];

      if (isDeleting) {
        // Remove one character
        charIndex--;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          setTimeout(typewrite, PAUSE_BEFORE);
          return;
        }
        setTimeout(typewrite, DELETE_SPEED);
      } else {
        // Add one character
        charIndex++;
        typewriterEl.textContent = currentPhrase.substring(0, charIndex);

        if (charIndex === currentPhrase.length) {
          isDeleting = true;
          setTimeout(typewrite, PAUSE_AFTER);
          return;
        }
        setTimeout(typewrite, TYPE_SPEED);
      }
    };

    // Kick off the typewriter loop
    typewrite();
  }

  /* ----------------------------------------------------------
     4. SMOOTH SCROLL FOR ANCHOR LINKS
     Scrolls to the target section with an 80 px offset so
     content isn't hidden behind the fixed navigation bar.
  ---------------------------------------------------------- */
  const NAV_OFFSET = 80;

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return; // skip bare "#" links

      const targetEl = document.querySelector(targetId);
      if (!targetEl) return;

      e.preventDefault();

      const targetPosition =
        targetEl.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;

      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    });
  });

  /* ----------------------------------------------------------
     5. CURRENT YEAR IN FOOTER
     Finds the element with id="current-year" (or the first
     <span> inside a <footer>) and sets it to the current year.
  ---------------------------------------------------------- */
  const yearEl =
    document.getElementById('current-year') ||
    document.querySelector('footer span');

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ----------------------------------------------------------
     6. PARALLAX-LITE FOR HERO ORBS
     Translates '.orb' elements based on cursor position.
     Only active on viewports wider than 768 px.
     Uses requestAnimationFrame for smooth, jank-free updates.
  ---------------------------------------------------------- */
  const orbs = document.querySelectorAll('.orb');

  if (orbs.length > 0) {
    let mouseX = 0;
    let mouseY = 0;
    let rafScheduled = false;

    const updateOrbs = () => {
      // Normalise cursor to centre of viewport (-1 … 1)
      const nx = (mouseX / window.innerWidth - 0.5) * 2;
      const ny = (mouseY / window.innerHeight - 0.5) * 2;

      orbs.forEach((orb, i) => {
        // Each orb moves at a slightly different rate for depth
        const speed = 20 + i * 10;
        const tx = nx * speed;
        const ty = ny * speed;
        orb.style.transform = `translate(${tx}px, ${ty}px)`;
      });

      rafScheduled = false;
    };

    window.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 768) return; // skip on mobile

      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(updateOrbs);
      }
    });
  }
});
