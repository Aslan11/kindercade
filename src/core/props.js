/** Props more than one game needs. */

import * as THREE from './three.js';
import { build, Shapes } from './kit.js';
import { Toy } from './toy.js';
import { wheel, balloon } from '../models/things.js';

export const CANDY = ['#ff6b8b', '#ffb52e', '#2fb0ee', '#2fc77f', '#9b6cff', '#ff8a4c'];

/** Wheels that really turn as `vehicle` rolls along x. `at` is [x, radius, z] triples. */
export function addWheels(game, vehicle, at, hub = '#ffd23c', mover = vehicle) {
  const made = at.map(([x, r, z]) => {
    const w = build((b) => {
      wheel(b, [0, 0, 0], r, hub, r * 0.6);
      for (let i = 0; i < 4; i++) b.ball('#ffffff', [Math.cos(i * 1.571) * r * 0.32, Math.sin(i * 1.571) * r * 0.32, r * 0.32], r * 0.08, { ao: false });
    });
    w.position.set(x, r, z);
    vehicle.add(w);
    return { w, r };
  });
  game.every(() => { for (const { w, r } of made) w.rotation.z = -mover.position.x / r; });
}

/** A big round arcade button with an arrow on top: "I'm done, go!" */
export function goButton(size = 1.3, color = '#2fc77f') {
  const mesh = build((b) => {
    b.cyl('#ffffff', [0, 0.5, 0], 0.5, 0.2, { rot: [Math.PI / 2, 0, 0], seg: 30 });
    b.cyl(color, [0, 0.5, 0.1], 0.42, 0.24, { rot: [Math.PI / 2, 0, 0], surf: 'shiny', seg: 30, bevel: 0.1 });
    b.puff('#ffffff', [0.03, 0.5, 0.24], Shapes.soft([[-0.15, -0.2], [0.22, 0], [-0.15, 0.2]], 0.05), 0.06);
  });
  mesh.scale.setScalar(size);
  return new Toy(mesh, size, { idle: 1.5 });
}

/** A speech bubble, origin at its centre, tail pointing down toward `tail` (-1 left, +1 right). */
export function bubble(w, h, tail = -1) {
  const group = new THREE.Group();
  group.add(build((b) => {
    b.box('#ffffff', [0, 0, 0], [w, h, 0.16], { r: 0.08, surf: 'bright' });
    b.cone('#ffffff', [tail * w * 0.28, -h / 2 + 0.06, 0], 0.2, 0.5, { rot: [0, 0, Math.PI + tail * 0.5], scale: [1, 1, 0.3], surf: 'bright' });
    b.box('#ffffff', [tail * w * 0.27, -h / 2 + 0.14, 0.03], [0.5, 0.24, 0.14], { r: 0.02, surf: 'bright', ao: false });
  }, { shadow: false, receive: false }));
  return group;
}

/** A party balloon on a string. Origin at the knot; the body is centred `0.6 × size` above it. */
export function partyBalloon(color, size = 1.7, string = 0.8) {
  const mesh = build((b) => {
    balloon(b, color);
    if (string) b.tube('#ffffff', [[0, -0.07, 0], [0.04, -string * 0.4, 0], [-0.04, -string * 0.7, 0], [0, -string, 0]], 0.012, { radial: 5 });
  }, { receive: false });
  mesh.scale.setScalar(size);
  const toy = new Toy(mesh, size);
  toy.color = color;
  toy.float = 0.1;
  toy.hotAt = new THREE.Vector3(0, size * 0.6, 0);
  return toy;
}
