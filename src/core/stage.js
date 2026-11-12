/**
 * Renderer, lighting and sky.
 */

import * as THREE from './three.js';
import { inkMaterial } from './kit.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = false;
  // The outline pass has nothing to add to a shadow; skip it there.
  const drawShadows = renderer.shadowMap.render;
  renderer.shadowMap.render = function (...args) {
    inkMaterial.visible = false;
    drawShadows.apply(this, args);
    inkMaterial.visible = true;
  };
  return renderer;
}

/**
 * Cel lighting is two numbers: what a surface looks like in the sun (exactly
 * its paint, times `sun`) and what it looks like out of it (its paint, times
 * `shade`). `span` is the half-width of the area that needs cast shadows.
 */
export function light(scene, {
  sun = '#ffffff', shade = '#c0b2e6', from = [-5, 8, 6.5], centre = [0, 0, 0], span = 9, shadows = true,
} = {}) {
  const fill = new THREE.Color(shade);
  scene.add(new THREE.AmbientLight(fill, Math.PI));
  const key = new THREE.DirectionalLight(new THREE.Color(sun).sub(fill), Math.PI);
  key.target.position.set(...centre);
  key.position.copy(key.target.position).addScaledVector(new THREE.Vector3(...from).normalize(), 22);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 4, far: 44 });
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 1.5;
  }
  scene.add(key, key.target);
  return key;
}

/** A gradient sky dome. `stops` run from the horizon up: [height 0..1, colour]. */
export function skyDome(stops) {
  const geo = new THREE.SphereGeometry(180, 24, 32);
  const col = [];
  const c = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const y = geo.attributes.position.getY(i) / 180;
    let k = 0;
    while (k < stops.length - 2 && y > stops[k + 1][0]) k++;
    const [y0, c0] = stops[k], [y1, c1] = stops[k + 1];
    c.lerpColors(a.set(c0), b.set(c1), Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  mesh.renderOrder = -10;
  mesh.userData.owned = true;
  mesh.userData.ownsMaterial = true;
  return mesh;
}
