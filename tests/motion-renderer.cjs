const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../motion.js`, 'utf8');
const start = source.indexOf('  const geometry =');
const end = source.indexOf('  const paint =');
const { geometry, rasterize } = vm.runInNewContext(`
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  ${source.slice(start, end)}
  ({ geometry, rasterize });
`);
const colors = { red: [255, 0, 0], blue: [0, 0, 255], shell: [255, 255, 255],
  edge: [7, 94, 91], liquid: [236, 115, 87], hub: [139, 171, 182],
  tire: [36, 55, 70], accent: [8, 127, 122] };
const render = (parts, size = 32) => {
  const pixels = new Uint8ClampedArray(size * size * 4);
  rasterize(parts, size, size, pixels, new Float64Array(size * size), colors, 1);
  return pixels;
};
const pixel = (pixels, x, y, size = 32) => [...pixels.slice((y * size + x) * 4, (y * size + x + 1) * 4)];
test('intersecting faces resolve per pixel, independent of submission order', () => {
  const parts = [
    { material: 'red', points: [[2, 2, .1], [30, 2, .3], [30, 30, .3], [2, 30, .1]] },
    { material: 'blue', points: [[2, 2, .21], [30, 2, .21], [30, 30, .21], [2, 30, .21]] },
  ];
  const pixels = render(parts);
  assert.deepEqual(pixels, render([...parts].reverse()));
  assert.deepEqual(pixel(pixels, 5, 16), [0, 0, 255, 255]);
  assert.deepEqual(pixel(pixels, 26, 16), [255, 0, 0, 255]);
});
test('details behind a surface are hidden, front details remain visible', () => {
  const parts = [
    { material: 'blue', points: [[2, 2, .2], [30, 2, .2], [30, 30, .2], [2, 30, .2]] },
    { material: 'red', width: 2, points: [[4, 10, .1], [28, 10, .1]] },
    { material: 'red', width: 2, points: [[4, 20, .3], [28, 20, .3]] },
  ];
  const pixels = render(parts);
  assert.deepEqual(pixel(pixels, 16, 10), [0, 0, 255, 255]);
  assert.deepEqual(pixel(pixels, 16, 20), [255, 0, 0, 255]);
  assert.deepEqual(pixels, render([...parts].reverse()));
});
test('concave faces preserve empty space and shared edges have no gaps', () => {
  const pixels = render([{ material: 'red', points: [[2, 2, .2], [10, 2, .2], [10, 20, .2], [30, 20, .2], [30, 30, .2], [2, 30, .2]] }]);
  assert.equal(pixel(pixels, 20, 10)[3], 0);
  assert.equal(pixel(pixels, 5, 10)[3], 255);
  assert.equal(pixel(pixels, 20, 25)[3], 255);
  const tiled = render([
    { material: 'red', points: [[2, 2, .2], [30, 2, .2], [30, 30, .2]] },
    { material: 'red', points: [[2, 2, .2], [30, 30, .2], [2, 30, .2]] },
  ]);
  for (let y = 2; y < 30; y++) for (let x = 2; x < 30; x++) assert.equal(pixel(tiled, x, y)[3], 255);
});
test('both complete models remain stable through a full rotation and tilt', () => {
  for (const kind of ['thermometer', 'roadseal']) {
    const model = geometry(kind);
    for (const tilt of [-.5, 0, .5]) for (let step = 0; step < 24; step++) {
      const yaw = step * Math.PI / 12;
      const project = ([x, y, z]) => {
        const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
        const rz = z * Math.cos(yaw) - x * Math.sin(yaw);
        const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
        const depth = 1 / (4.8 - y * Math.sin(tilt) - rz * Math.cos(tilt));
        return [64 + rx * 40 * 4.8 * depth, 60 + ry * 40 * 4.8 * depth, depth];
      };
      const parts = [...model.surfaces, ...model.paths].map(p => ({ ...p, points: p.points.map(project) }));
      const image = render(parts, 128), reversed = render([...parts].reverse(), 128);
      let filled = 0, different = 0;
      for (let i = 0; i < image.length; i += 4) {
        if (image[i + 3]) filled++;
        if (image.slice(i, i + 4).some((v, j) => v !== reversed[i + j])) different++;
      }
      assert.ok(filled > 300, `${kind} disappeared at ${yaw}, ${tilt}`);
      // Exactly coincident edges can tie; wholesale face ordering must not matter.
      assert.ok(different < 10, `${kind} order changed ${different} pixels at ${yaw}, ${tilt}`);
    }
  }
});
