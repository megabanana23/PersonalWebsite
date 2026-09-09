/* Small, event-driven motion layer. No animation library or WebGL dependency. */
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sections = [...document.querySelectorAll('.profile-section')];
  const cards = [...document.querySelectorAll('.hero-panel, .education-list .card, .cert, .contact-card')];
  const scenes = [];
  let frame = 0;
  let measure = true;
  let lastTime = 0;
  let palette;

  const schedule = () => {
    if (!frame && !document.hidden) frame = requestAnimationFrame(update);
  };
  const invalidate = () => { measure = true; schedule(); };
  const readTheme = () => {
    const style = getComputedStyle(root);
    palette = {
      accent: style.getPropertyValue('--accent').trim(),
      shell: style.getPropertyValue('--surface').trim(),
      edge: style.getPropertyValue('--accent-strong').trim(),
      liquid: '#ec7357', tire: '#243746', hub: '#8babb6',
    };
    scenes.forEach(scene => { scene.dirty = true; });
    schedule();
  };

  // Project-specific solid models, projected in 3D without a WebGL dependency.
  const geometry = (kind, level = .65) => {
    const surfaces = [];
    const paths = [];
    const face = (points, material, shade = 1) => surfaces.push({ points, material, shade });
    const line = (points, material, width = 1.2) => {
      for (let i = 1; i < points.length; i++) paths.push({ points: [points[i - 1], points[i]], material, width });
    };
    const box = (cx, cy, cz, w, h, d, material) => {
      const v = Array.from({ length: 8 }, (_, i) => [
        cx + (i & 1 ? 1 : -1) * w / 2,
        cy + (i & 2 ? 1 : -1) * h / 2,
        cz + (i & 4 ? 1 : -1) * d / 2,
      ]);
      [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
        .forEach((indices, i) => face(indices.map(j => v[j]), material, [.7, 1, 1, .65, .8, .9][i]));
    };
    const cylinder = (cx, cy, cz, radius, length, axis, material) => {
      const rings = [-1, 1].map(side => Array.from({ length: 20 }, (_, i) => {
        const angle = i / 20 * Math.PI * 2;
        return axis === 'x'
          ? [cx + side * length / 2, cy + radius * Math.cos(angle), cz + radius * Math.sin(angle)]
          : [cx + radius * Math.cos(angle), cy + side * length / 2, cz + radius * Math.sin(angle)];
      }));
      face(rings[0], material, .8);
      face(rings[1], material, 1);
      for (let i = 0; i < 20; i++) {
        const next = (i + 1) % 20;
        face([rings[0][i], rings[0][next], rings[1][next], rings[1][i]], material, .78 + .2 * Math.sin(i / 20 * Math.PI * 2));
      }
    };
    if (kind === 'thermometer') {
      const radius = .24;
      const bulbRadius = .43;
      const join = Math.acos(radius / bulbRadius);
      const outline = [];
      for (let i = 0; i <= 20; i++) {
        const angle = Math.PI + i / 20 * Math.PI;
        outline.push([radius * Math.cos(angle), -1.03 + radius * Math.sin(angle)]);
      }
      for (let i = 0; i <= 36; i++) {
        const angle = -join + i / 36 * (Math.PI + 2 * join);
        outline.push([bulbRadius * Math.cos(angle), .9 + bulbRadius * Math.sin(angle)]);
      }
      const front = outline.map(([x, y]) => [x, y, .08]);
      const back = outline.map(([x, y]) => [x, y, -.14]);
      face(back, 'shell', .7);
      outline.forEach((_, i) => {
        const next = (i + 1) % outline.length;
        face([back[i], back[next], front[next], front[i]], 'hub', .8);
      });
      face(front, 'shell');
      line([...front, front[0]].map(([x, y, z]) => [x, y, z + .002]), 'edge', 1.7);
      // Raised liquid column and bulb stay recognisable as the model turns.
      const top = .48 - level * 1.42;
      box(-.045, (top + .9) / 2, .13, .115, .9 - top, .075, 'liquid');
      for (let row = 0; row < 10; row++) {
        const a = -Math.PI / 2 + row / 10 * Math.PI;
        const b = -Math.PI / 2 + (row + 1) / 10 * Math.PI;
        for (let col = 0; col < 20; col++) {
          const c = col / 20 * Math.PI * 2;
          const d = (col + 1) / 20 * Math.PI * 2;
          face([[a, c], [b, c], [b, d], [a, d]].map(([lat, lon]) => [
            .28 * Math.cos(lat) * Math.cos(lon), .9 + .28 * Math.sin(lat), .1 + .14 * Math.cos(lat) * Math.sin(lon),
          ]), 'liquid', .83 + .15 * Math.cos(c));
        }
      }
      for (let i = 0; i < 9; i++) {
        const y = -.94 + i * .17;
        line([[i % 2 ? .12 : .09, y, .09], [.19, y, .09]], 'edge', 1.25);
      }
    } else if (kind === 'roadseal') {
      // Metal aerosol can, printed label, raised actuator, and a short spray plume.
      cylinder(0, .12, 0, .54, 1.62, 'y', 'accent');
      cylinder(0, .95, 0, .55, .075, 'y', 'hub');
      cylinder(0, -.7, 0, .55, .065, 'y', 'hub');
      for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        const b = (i + 1) / 20 * Math.PI * 2;
        face([[.54, -.73, a], [.54, -.73, b], [.32, -.89, b], [.32, -.89, a]]
          .map(([r, y, angle]) => [r * Math.cos(angle), y, r * Math.sin(angle)]), 'hub', .85 + .12 * Math.sin(a));
      }
      cylinder(0, -.9, 0, .32, .045, 'y', 'hub');
      cylinder(0, -.95, 0, .075, .1, 'y', 'tire');
      box(0, -1.09, .045, .3, .24, .3, 'shell');
      box(0, -1.08, .201, .095, .07, .018, 'tire');
      // A full printed sleeve follows the same facets as the metal can.
      cylinder(0, .085, 0, .548, .97, 'y', 'shell');
      const labelPoint = ([x, y]) => [x, y, Math.sqrt(.575 ** 2 - x ** 2)];
      // Compact RS lettering and a sealed-crack motif identify the project.
      line([[-.25, .16], [-.25, -.18], [-.1, -.18], [-.055, -.13], [-.055, -.055],
        [-.1, -.01], [-.25, -.01]].map(labelPoint), 'edge', 1.8);
      line([[-.16, -.01], [-.04, .16]].map(labelPoint), 'edge', 1.8);
      line([[.25, -.16], [.1, -.18], [.06, -.12], [.1, -.025], [.21, .005],
        [.25, .08], [.21, .16], [.065, .14]].map(labelPoint), 'edge', 1.8);
      line([[-.27, .36], [-.13, .31], [-.02, .38], [.1, .32], [.27, .36]].map(labelPoint), 'accent', 2.2);
      for (let i = 0; i < 5; i++) {
        const offset = (i - 2) * .11;
        line([[offset * .2, -1.08, .34], [offset, -1.08 + offset * .35, .76],
          [offset * 1.7, -1.08 + offset * .6, 1.05]], 'hub', .9);
      }
    }
    return { surfaces, paths };
  };

  // Rasterize at the canvas resolution with a shared depth buffer. Reciprocal
  // camera distance interpolates linearly in screen space, including perspective.
  // Scanline spans also handle the thermometer's concave outline without a fan
  // triangulation that would incorrectly fill the neck outside its silhouette.
  const rasterize = (parts, width, height, pixels, depths, colors, ratio) => {
    pixels.fill(0);
    depths.fill(-Infinity);
    const put = (x, y, depth, color) => {
      const index = y * width + x;
      if (depth < depths[index]) return;
      depths[index] = depth;
      const offset = index * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    };
    parts.forEach(part => {
      const points = part.points;
      const base = colors[part.material];
      const shade = part.shade ?? 1;
      const color = base.map((value, i) => Math.round(value * shade + [7, 28, 41][i] * (1 - shade)));
      if (part.width) {
        const [a, b] = points;
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const lengthSquared = dx * dx + dy * dy;
        const radius = part.width * ratio / 2;
        const left = Math.max(0, Math.floor(Math.min(a[0], b[0]) - radius));
        const right = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0]) + radius));
        const top = Math.max(0, Math.floor(Math.min(a[1], b[1]) - radius));
        const bottom = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1]) + radius));
        for (let y = top; y <= bottom; y++) {
          for (let x = left; x <= right; x++) {
            const t = lengthSquared ? clamp(((x + .5 - a[0]) * dx + (y + .5 - a[1]) * dy) / lengthSquared, 0, 1) : 0;
            if ((x + .5 - a[0] - t * dx) ** 2 + (y + .5 - a[1] - t * dy) ** 2 <= radius * radius) {
              put(x, y, a[2] + t * (b[2] - a[2]), color);
            }
          }
        }
        return;
      }
      const top = Math.max(0, Math.ceil(Math.min(...points.map(p => p[1])) - .5));
      const bottom = Math.min(height - 1, Math.ceil(Math.max(...points.map(p => p[1])) - .5) - 1);
      for (let y = top; y <= bottom; y++) {
        const scanY = y + .5;
        const crossings = [];
        points.forEach((a, i) => {
          const b = points[(i + 1) % points.length];
          // Half-open edges keep shared vertices and adjacent faces watertight.
          if ((a[1] <= scanY && b[1] > scanY) || (b[1] <= scanY && a[1] > scanY)) {
            const t = (scanY - a[1]) / (b[1] - a[1]);
            crossings.push([a[0] + t * (b[0] - a[0]), a[2] + t * (b[2] - a[2])]);
          }
        });
        crossings.sort((a, b) => a[0] - b[0]);
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const [a, b] = [crossings[i], crossings[i + 1]];
          const start = Math.max(0, Math.ceil(a[0] - .5));
          const end = Math.min(width - 1, Math.ceil(b[0] - .5) - 1);
          for (let x = start; x <= end; x++) {
            const t = (x + .5 - a[0]) / (b[0] - a[0]);
            put(x, y, a[1] + t * (b[1] - a[1]), color);
          }
        }
      }
    });
  };

  const paint = (scene) => {
    const { context, width, height, x, y, ratio, canvas } = scene;
    if (!width || !height || !canvas.width || !canvas.height) return;
    const scale = Math.min(width, height) * (scene.kind === 'thermometer' ? .32 : .31);
    const cosX = Math.cos(x), sinX = Math.sin(x), cosY = Math.cos(y), sinY = Math.sin(y);
    const project = ([px, py, pz]) => {
      const rx = px * cosY + pz * sinY;
      const rz = pz * cosY - px * sinY;
      const ry = py * cosX - rz * sinX;
      const z = py * sinX + rz * cosX;
      const depth = 1 / (4.8 - z);
      return [(width / 2 + rx * scale * 4.8 * depth) * ratio,
        (height * .46 + ry * scale * 4.8 * depth) * ratio, depth];
    };
    if (scene.kind === 'thermometer' && scene.modelLevel !== scene.level) {
      scene.model = geometry(scene.kind, scene.level);
      scene.modelLevel = scene.level;
    }
    const parts = [...scene.model.surfaces, ...scene.model.paths]
      .map(part => ({ ...part, points: part.points.map(project) }));
    if (!scene.image || scene.image.width !== canvas.width || scene.image.height !== canvas.height) {
      scene.image = context.createImageData(canvas.width, canvas.height);
      scene.depths = new Float64Array(canvas.width * canvas.height);
    }
    const colors = Object.fromEntries(Object.entries(palette).map(([key, color]) => {
      const hex = color.slice(1);
      const expanded = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
      return [key, [0, 2, 4].map(offset => parseInt(expanded.slice(offset, offset + 2), 16))];
    }));
    rasterize(parts, canvas.width, canvas.height, scene.image.data, scene.depths, colors, ratio);
    context.putImageData(scene.image, 0, 0);
    scene.dirty = false;
  };

  document.querySelectorAll('[data-scene]').forEach(element => {
    const canvas = element.querySelector('canvas');
    const context = canvas?.getContext('2d');
    if (!context) return;
    const scene = {
      element, canvas, context, kind: element.dataset.scene,
      model: geometry(element.dataset.scene), x: -.3, y: .45, level: .65,
      pointerX: 0, pointerY: 0, turn: 0, scroll: 0,
      visible: false, dirty: true, width: 0, height: 0,
    };
    scenes.push(scene);
    const visual = element.closest('.project-visual');
    visual.addEventListener('pointermove', event => {
      if (reduced.matches || !finePointer.matches || event.pointerType === 'touch') return;
      const rect = visual.getBoundingClientRect();
      scene.pointerX = clamp((event.clientX - rect.left) / rect.width - .5, -.5, .5);
      scene.pointerY = clamp((event.clientY - rect.top) / rect.height - .5, -.5, .5);
      schedule();
    }, { passive: true });
    const resetPointer = () => { scene.pointerX = scene.pointerY = 0; schedule(); };
    visual.addEventListener('pointerleave', resetPointer);
    visual.addEventListener('pointercancel', resetPointer);
    const button = element.querySelector('.scene-turn');
    button.hidden = false;
    button.addEventListener('click', () => {
      scene.turn += Math.PI / 3;
      scene.dirty = true;
      schedule();
    });
  });

  const tilts = cards.map(element => {
    element.classList.add('motion-card');
    const state = { element, x: 0, y: 0, tx: 0, ty: 0 };
    element.addEventListener('pointermove', event => {
      if (reduced.matches || !finePointer.matches || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      state.tx = (.5 - y) * 7;
      state.ty = (x - .5) * 9;
      element.style.setProperty('--glow-x', `${x * 100}%`);
      element.style.setProperty('--glow-y', `${y * 100}%`);
      element.classList.add('is-pointed');
      schedule();
    }, { passive: true });
    const reset = () => {
      state.tx = state.ty = 0;
      element.classList.remove('is-pointed');
      schedule();
    };
    element.addEventListener('pointerleave', reset);
    element.addEventListener('pointercancel', reset);
    return state;
  });

  function update(time) {
    frame = 0;
    if (document.hidden) return;
    // Time-based easing has the same weight on 60 Hz and 120 Hz displays.
    const blend = reduced.matches ? 1 : 1 - Math.exp(-Math.min(time - lastTime || 16, 64) / 70);
    lastTime = time;
    let unsettled = false;
    if (measure) {
      const viewport = window.innerHeight;
      const distance = root.scrollHeight - viewport;
      root.style.setProperty('--reading-progress', distance > 0 ? clamp(window.scrollY / distance, 0, 1) : 0);
      sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        section.style.setProperty('--section-progress', clamp((viewport * .75 - rect.top) / rect.height, 0, 1));
      });
      scenes.forEach(scene => {
        const rect = scene.element.getBoundingClientRect();
        scene.visible = rect.bottom > 0 && rect.top < viewport;
        scene.scroll = clamp((viewport / 2 - (rect.top + rect.height / 2)) / viewport, -1, 1);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        if (scene.width !== rect.width || scene.height !== rect.height || scene.ratio !== ratio) {
          scene.width = rect.width;
          scene.height = rect.height;
          scene.ratio = ratio;
          scene.canvas.width = Math.round(rect.width * ratio);
          scene.canvas.height = Math.round(rect.height * ratio);
          scene.context.setTransform(ratio, 0, 0, ratio, 0, 0);
          scene.dirty = true;
        }
      });
      measure = false;
    }
    scenes.forEach(scene => {
      if (!scene.visible) return;
      const thermometer = scene.kind === 'thermometer';
      const tx = (thermometer ? -.08 : -.18) + (reduced.matches ? 0 : scene.scroll * .15 - scene.pointerY * .35);
      const ty = (thermometer ? -.18 : -.4) + scene.turn + (reduced.matches ? 0 : scene.scroll * .9 + scene.pointerX * .8);
      const targetLevel = reduced.matches ? .65 : clamp(.65 + scene.scroll * .45, .2, .95);
      const moving = Math.abs(tx - scene.x) + Math.abs(ty - scene.y) + Math.abs(targetLevel - scene.level) > .001;
      scene.level = moving ? scene.level + (targetLevel - scene.level) * blend : targetLevel;
      scene.x = moving ? scene.x + (tx - scene.x) * blend : tx;
      scene.y = moving ? scene.y + (ty - scene.y) * blend : ty;
      if (moving || scene.dirty) paint(scene);
      if (moving && !reduced.matches) unsettled = true;
    });
    tilts.forEach(state => {
      const tx = reduced.matches || !finePointer.matches ? 0 : state.tx;
      const ty = reduced.matches || !finePointer.matches ? 0 : state.ty;
      const moving = Math.abs(tx - state.x) + Math.abs(ty - state.y) > .01;
      state.x = moving ? state.x + (tx - state.x) * blend : tx;
      state.y = moving ? state.y + (ty - state.y) * blend : ty;
      state.element.style.setProperty('--tilt-x', `${state.x.toFixed(3)}deg`);
      state.element.style.setProperty('--tilt-y', `${state.y.toFixed(3)}deg`);
      if (moving && !reduced.matches) unsettled = true;
    });
    if (unsettled) schedule();
  }

  window.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('resize', invalidate, { passive: true });
  document.addEventListener('toggle', invalidate, true);
  const resetInteraction = () => {
    tilts.forEach(state => {
      state.tx = state.ty = 0;
      state.element.classList.remove('is-pointed');
    });
    scenes.forEach(scene => { scene.pointerX = scene.pointerY = 0; scene.dirty = true; });
    invalidate();
  };
  reduced.addEventListener('change', resetInteraction);
  finePointer.addEventListener('change', resetInteraction);
  window.addEventListener('blur', resetInteraction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else resetInteraction();
  });
  if ('ResizeObserver' in window) new ResizeObserver(invalidate).observe(document.body);
  new MutationObserver(readTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
  root.classList.add('motion-ready');
  readTheme();
  invalidate();
})();
