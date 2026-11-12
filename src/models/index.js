/**
 * The toy chest: every named model, built on first use and then shared.
 *
 * Models are normalised to a unit box (larger of width/height = 1), centred on
 * x/z, standing on y = 0 and facing +z.
 */

import { Builder } from '../core/kit.js';
import { BUDDY_MODELS } from './buddies.js';
import { ANIMALS } from './animals.js';
import { FOOD } from './food.js';
import { NATURE } from './nature.js';
import { THINGS } from './things.js';

export const MODELS = { ...BUDDY_MODELS, ...ANIMALS, ...FOOD, ...NATURE, ...THINGS };

const templates = new Map();

export function template(name) {
  let t = templates.get(name);
  if (!t) {
    const make = MODELS[name];
    if (!make) throw new Error(`no model called "${name}"`);
    const b = new Builder();
    make(b);
    t = b.bake({ fit: true });
    templates.set(name, t);
  }
  return t;
}
