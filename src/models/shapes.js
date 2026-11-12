/** The six shapes, in six colours, with faces. Pattern Party's dancers. */

import { Builder, Shapes, instantiate } from '../core/kit.js';

const OUTLINE = {
  circle: () => Shapes.circle(0.48),
  square: () => Shapes.rect(0.86, 0.86, 0.14),
  triangle: () => Shapes.soft([[-0.56, -0.36], [0.56, -0.36], [0, 0.62]], 0.14),
  star: () => Shapes.star(0.62, 0.36, 5, 0.16),
  heart: () => Shapes.heart(0.5),
  diamond: () => Shapes.soft([[0, -0.58], [0.46, 0], [0, 0.58], [-0.46, 0]], 0.12),
};

export const SHAPES = Object.keys(OUTLINE);
export const COLORS = { pink: '#ff6b9b', yellow: '#ffc93c', blue: '#3fb0f5', green: '#3dcc77', purple: '#9b6cff', orange: '#ff8a2e' };

const cache = new Map();

/** A unit-sized mesh, ready to wrap in a `Toy`. */
export function shapeMesh(shape, color) {
  const key = shape + color;
  if (!cache.has(key)) {
    const b = new Builder();
    b.pillow(COLORS[color], [0, 0, 0], OUTLINE[shape](), 0.4, { surf: 'shiny', curve: shape === 'circle' ? 20 : 8, flat: 3.4 });
    b.flatFace(0, shape === 'triangle' ? -0.04 : 0, 0.195, 0.72);
    cache.set(key, b.bake({ fit: true }));
  }
  const made = instantiate(cache.get(key));
  made.root.parts = made.parts;
  return made.root;
}
