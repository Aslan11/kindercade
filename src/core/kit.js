/**
 * The modelling kit.
 *
 * Every creature, object and bit of scenery in Kindercade is assembled at
 * runtime from soft primitives — balls, rounded boxes, tubes and puffy
 * extrusions. There are no model files and no textures to download.
 *
 * The look is cel-shaded: flat colour, one hard-edged shadow tone, a crisp
 * highlight and an ink outline. A `Builder` collects primitives, paints them
 * with vertex colours, works out where neighbours shade each other (so a head
 * casts a clean cartoon shadow on its body) and merges the lot into one
 * geometry per moving part. Every copy of a model shares the same buffers.
 */

import * as THREE from './three.js';

const { Vector3, Matrix4, Euler, Quaternion, Color, BufferGeometry, Float32BufferAttribute } = THREE;
const PI = Math.PI;

/* ---------------------------------------------------------------- material */

/** Surface finishes: [size of the hard highlight, self-glow]. */
export const SURF = {
  toy: [0, 0],
  shiny: [1, 0],
  gold: [1, 0.15],
  glow: [0, 0.75],
  bright: [0, 1],
};

export const INK = '#2a1a4a';

function celShade(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 surf;\nvarying vec3 vSurf;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;')
    // Two tones. Baked occlusion pushes the terminator rather than darkening
    // the paint, which is what turns it into a crisp-edged contact shadow.
    .replace('#include <gradientmap_pars_fragment>', `
      vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
        float d = dot(normal, lightDirection) - vSurf.y * 0.9;
        float w = fwidth(d) + 0.012;
        return vec3(smoothstep(0.2 - w, 0.2 + w, d));
      }`)
    .replace('#include <opaque_fragment>', `
      #if NUM_DIR_LIGHTS > 0
        vec3 sunDir = directionalLights[0].direction;
        float lit = saturate(dot(reflectedLight.directDiffuse, vec3(1.0)) / max(0.001, dot(diffuseColor.rgb, vec3(1.0))) * 4.0);
        float spec = dot(normal, normalize(sunDir + geometryViewDir));
        float edge = 1.0 - 0.016 * vSurf.x;
        float sw = fwidth(spec) + 0.0005;
        float curved = step(0.0015, length(fwidth(normal)));   // a flat face must not flash white
        outgoingLight = mix(outgoingLight, vec3(1.0), smoothstep(edge - sw, edge + sw, spec) * lit * curved * vSurf.x * 0.85);
        float rim = 1.0 - dot(normal, geometryViewDir);
        float rw = fwidth(rim);
        outgoingLight += diffuseColor.rgb * 0.16 * smoothstep(0.62 - rw, 0.62 + rw, rim) * (1.0 - lit) * (1.0 - vSurf.y);
      #endif
      outgoingLight = mix(outgoingLight, diffuseColor.rgb, vSurf.z);
      #include <opaque_fragment>`);
}

/**
 * The ink line: the same mesh drawn inside-out and pushed outward along
 * `hull`. The push is made in screen space so it reads as a pen stroke, and it
 * thins out on small or distant things so they do not drown in outline.
 */
export const inkMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
/** The thickest the pen may get, as a fraction of half the viewport height. */
export const penWidth = { value: 0.0095 };
inkMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.penWidth = penWidth;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 hull;\nuniform float penWidth;')
    .replace('#include <project_vertex>', `
      #include <project_vertex>
      vec3 outward = normalize(normalMatrix * hull);
      float size = length(modelMatrix[0].xyz) * projectionMatrix[1][1] / gl_Position.w;
      float pen = min(penWidth, length(hull) * size * 0.03);
      vec2 dir = outward.xy / max(0.35, length(outward.xy));
      gl_Position.xy += dir * vec2(projectionMatrix[0][0] / projectionMatrix[1][1], 1.0) * pen * gl_Position.w;`);
};

const tinted = new Map();
/** The shared paint-and-ink material pair, optionally multiplied by a colour. */
export function toyMaterial(color = '#ffffff') {
  let m = tinted.get(color);
  if (!m) {
    const paint = new THREE.MeshToonMaterial({ vertexColors: true, color });
    paint.onBeforeCompile = celShade;
    paint.customProgramCacheKey = () => 'cel';
    m = [paint, inkMaterial];
    tinted.set(color, m);
  }
  return m;
}

/* -------------------------------------------------------------- geometries */

const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};

export function roundedBox(w, h, d, r, seg = 2) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const n = seg * 2 + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const bx = w / 2 - r, by = h / 2 - r, bz = d / 2 - r;
  const half = 0.5 / n;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    v.set(x - Math.sign(x) * half, y - Math.sign(y) * half, z - Math.sign(z) * half).normalize();
    pos.setXYZ(i, bx * Math.sign(x) + v.x * r, by * Math.sign(y) + v.y * r, bz * Math.sign(z) + v.z * r);
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** Spin a [radius, y] profile round the y axis. */
function latheGeo(profile, seg = 24, from = 0, sweep = PI * 2) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(Math.max(0, x), y)), seg, from, sweep);
}

/** A cylinder (or cone frustum) centred on the origin with softened rims. */
function softCylinder(rTop, rBot, h, bevel, seg) {
  const p = [[0, -h / 2]];
  const b0 = Math.min(bevel, rBot, h / 2);
  const b1 = Math.min(bevel, rTop, h / 2);
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * PI / 2;
    p.push([rBot - b0 + Math.sin(a) * b0, -h / 2 + b0 - Math.cos(a) * b0]);
  }
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * PI / 2;
    p.push([rTop - b1 + Math.cos(a) * b1, h / 2 - b1 + Math.sin(a) * b1]);
  }
  p.push([0, h / 2]);
  return latheGeo(p, seg);
}

/**
 * A tube swept along a polyline, with a radius that may vary along its length.
 * Frames are parallel-transported so the tube never twists.
 */
export function tubeGeo(points, radius, { radial = 10, smooth = true, closed = false, flat = 1 } = {}) {
  let pts = points.map((p) => (p.isVector3 ? p.clone() : new Vector3(p[0], p[1], p[2] || 0)));
  if (smooth && pts.length > 2) {
    pts = new THREE.CatmullRomCurve3(pts, closed, 'centripetal').getPoints(Math.max(8, pts.length * 4));
  }
  const n = pts.length;
  const rad = typeof radius === 'function' ? radius : () => radius;
  const pos = [], nor = [], idx = [];
  const tan = new Vector3(), prev = new Vector3(), nrm = new Vector3(), bin = new Vector3();
  const q = new Quaternion(), v = new Vector3();
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    if (closed && (i === 0 || i === n - 1)) tan.subVectors(pts[1], pts[n - 2]).normalize();
    else tan.subVectors(b, a).normalize();
    if (i === 0) {
      nrm.set(0, 0, 1);
      if (Math.abs(tan.z) > 0.9) nrm.set(0, 1, 0);
      nrm.addScaledVector(tan, -nrm.dot(tan)).normalize();
    } else {
      nrm.applyQuaternion(q.setFromUnitVectors(prev, tan)).normalize();
    }
    prev.copy(tan);
    bin.crossVectors(tan, nrm);
    const r = rad(i / (n - 1));
    for (let j = 0; j <= radial; j++) {
      const t = (j / radial) * PI * 2;
      const c = Math.cos(t), s = Math.sin(t);
      v.copy(nrm).multiplyScalar(c * flat).addScaledVector(bin, s);
      pos.push(pts[i].x + v.x * r, pts[i].y + v.y * r, pts[i].z + v.z * r);
      v.copy(nrm).multiplyScalar(c / flat).addScaledVector(bin, s).normalize();
      nor.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.userData.ends = [pts[0], pts[n - 1]];
  return g;
}

/** Smooth normals across any edge gentler than `crease` radians. */
export function creaseNormals(geo, crease = PI / 3) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const cos = Math.cos(crease);
  const key = (i) => `${Math.round(pos.getX(i) * 2e3)},${Math.round(pos.getY(i) * 2e3)},${Math.round(pos.getZ(i) * 2e3)}`;
  const faces = [];
  const shared = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const n = new Vector3().subVectors(c, b).cross(a.sub(b)).normalize();
    faces.push(n);
    for (let k = 0; k < 3; k++) {
      const h = key(i + k);
      if (!shared.has(h)) shared.set(h, []);
      shared.get(h).push(n);
    }
  }
  const out = new Float32Array(pos.count * 3);
  const sum = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const n = faces[(i / 3) | 0];
    sum.set(0, 0, 0);
    for (const o of shared.get(key(i))) if (n.dot(o) > cos) sum.add(o);
    sum.normalize();
    out[i * 3] = sum.x; out[i * 3 + 1] = sum.y; out[i * 3 + 2] = sum.z;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}

/* ------------------------------------------------------------------ shapes */

export const Shapes = {
  poly(pts) {
    const s = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  },
  /** A polygon whose corners are rounded off by `r`. */
  soft(pts, r) {
    const s = new THREE.Shape();
    const n = pts.length;
    pts.forEach((p, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ka = Math.min(0.5, r / la), kb = Math.min(0.5, r / lb);
      const x0 = p[0] + (a[0] - p[0]) * ka, y0 = p[1] + (a[1] - p[1]) * ka;
      if (i) s.lineTo(x0, y0); else s.moveTo(x0, y0);
      s.quadraticCurveTo(p[0], p[1], p[0] + (b[0] - p[0]) * kb, p[1] + (b[1] - p[1]) * kb);
    });
    s.closePath();
    return s;
  },
  star(outer = 1, inner = 0.5, points = 5, r = 0.08) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const a = PI / 2 + (i / (points * 2)) * PI * 2;
      const k = i % 2 ? inner : outer;
      pts.push([Math.cos(a) * k, Math.sin(a) * k]);
    }
    return Shapes.soft(pts, r * outer);
  },
  heart(k = 1) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.95 * k);
    s.bezierCurveTo(0.35 * k, -0.6 * k, 1.05 * k, -0.15 * k, 1 * k, 0.38 * k);
    s.bezierCurveTo(0.95 * k, 0.95 * k, 0.2 * k, 1.05 * k, 0, 0.52 * k);
    s.bezierCurveTo(-0.2 * k, 1.05 * k, -0.95 * k, 0.95 * k, -1 * k, 0.38 * k);
    s.bezierCurveTo(-1.05 * k, -0.15 * k, -0.35 * k, -0.6 * k, 0, -0.95 * k);
    return s;
  },
  rect(w, h, r = 0.1) {
    return Shapes.soft([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], r);
  },
  circle(r = 1) {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, PI * 2, false);
    return s;
  },
  /** A pointed leaf lying along +y from the origin. */
  leaf(len = 1, wid = 0.4) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(wid, len * 0.2, wid, len * 0.65, 0, len);
    s.bezierCurveTo(-wid, len * 0.65, -wid, len * 0.2, 0, 0);
    return s;
  },
};

/** Extrude a shape along z, centred, with a puffy bevel inside its outline. */
export function puffGeo(shape, depth, bevel, { curve = 10, steps = 3 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: steps, curveSegments: curve,
  });
  g.translate(0, 0, -Math.max(0.001, depth - bevel * 2) / 2);
  return creaseNormals(g, bevel > 0 ? PI / 2.6 : PI / 4);
}

/**
 * Inflate an outline by shrinking it toward the origin in rings. Unlike a
 * bevel this never folds over at a sharp tip, so stars keep clean points.
 */
export function pillowGeo(shape, depth, { curve = 6, rings = 7, flat = 2.6 } = {}) {
  let pts = shape.getPoints(curve);
  if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  if (THREE.ShapeUtils.isClockWise(pts)) pts = pts.reverse();
  const n = pts.length;
  const pos = [], idx = [];
  for (let r = 0; r <= rings * 2; r++) {
    const a = (r / (rings * 2)) * PI;               // back centre -> rim -> front centre
    const k = Math.sin(a) ** (2 / flat);
    const z = -Math.cos(a) * depth / 2;
    for (const p of pts) pos.push(p.x * k, p.y * k, z);
  }
  for (let r = 0; r < rings * 2; r++) {
    for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n);
      idx.push(a, b, a + n, b, b + n, a + n);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  for (let i = 0; i < n; i++) { nor.setXYZ(i, 0, 0, -1); nor.setXYZ(rings * 2 * n + i, 0, 0, 1); }
  return g;
}

/* ----------------------------------------------------------------- builder */

const _m = new Matrix4(), _q = new Quaternion(), _e = new Euler(), _p = new Vector3(), _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);
const vec = (v) => (typeof v === 'number' ? [v, v, v] : v);

export class Builder {
  constructor({ ao = true, detail = 1 } = {}) {
    this.ao = ao;
    this.detail = detail;
    this.parts = [{ name: 'body', parent: null, pivot: new Vector3(), prims: [] }];
    this.cur = this.parts[0];
    this.stack = [new Matrix4()];
    this.anchors = {};
  }

  get xf() { return this.stack[this.stack.length - 1]; }

  /**
   * Add any geometry. `color` is a hex string, or `(x, y, z) => hex` evaluated
   * per vertex in the primitive's own unscaled space (stripes, gradients).
   * `ao: false` marks a surface detail: it shades nothing and is not inked,
   * unless `ink` says otherwise.
   */
  add(geo, color, pos = [0, 0, 0], { rot = null, scale = 1, surf = 'toy', ao = true, ink = ao, quat = null } = {}) {
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    if (typeof color === 'function') {
      const p = geo.attributes.position;
      for (let i = 0; i < n; i++) {
        _c.set(color(p.getX(i), p.getY(i), p.getZ(i), i));
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      }
    } else {
      _c.set(color);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    }
    if (quat) _q.copy(quat);
    else _q.setFromEuler(rot ? _e.set(rot[0], rot[1], rot[2], 'YXZ') : _e.set(0, 0, 0));
    _m.compose(_p.fromArray(pos), _q, _s.fromArray(vec(scale))).premultiply(this.xf);
    const g = new BufferGeometry();
    g.setAttribute('position', geo.attributes.position.clone());
    g.setAttribute('normal', geo.attributes.normal.clone());
    g.applyMatrix4(_m);
    this.cur.prims.push({ g, index: geo.index, col, shade: new Float32Array(n), surf: SURF[surf] || surf, ao, ink });
    return this;
  }

  /* ---- primitives ---- */

  /** Sphere or ellipsoid; `r` is a radius or [rx, ry, rz]. */
  ball(color, pos, r, o = {}) {
    const rr = vec(r);
    const big = Math.max(...rr);
    const seg = o.seg || Math.round((big > 0.3 ? 22 : big > 0.1 ? 14 : 9) * this.detail);
    const geo = cached(`s${seg}`, () => new THREE.SphereGeometry(1, seg, Math.max(5, Math.round(seg * 0.7))));
    return this.add(geo, color, pos, { ...o, scale: rr });
  }

  /**
   * A ball with crisp stripes round its y axis. `bands` lists [upTo, colour]
   * from the bottom (-1) to the top (1); rotate it to lay the stripes sideways.
   */
  banded(bands, pos, r, o = {}) {
    const profile = [], colors = [];
    let from = -1;
    for (const [to, color] of bands) {
      const a0 = Math.asin(from), a1 = Math.asin(to);
      const n = Math.max(1, Math.ceil((a1 - a0) / 0.2));
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (0.002 + (i / n) * 0.996);
        profile.push([Math.cos(a), Math.sin(a)]);
        colors.push(color);
      }
      from = to;
    }
    profile[0][0] = profile[profile.length - 1][0] = 0;
    // LatheGeometry lays its vertices out one whole profile at a time.
    return this.add(latheGeo(profile, o.seg || 22), (x, y, z, i) => colors[i % colors.length], pos, { ...o, scale: vec(r) });
  }

  /** The top half of a ball, closed underneath. */
  dome(color, pos, r, o = {}) {
    const seg = o.seg || Math.round(24 * this.detail);
    const geo = cached(`d${seg}`, () => {
      const p = [[0, 0], [0.96, 0], [1, 0.04]];
      for (let i = 1; i <= 8; i++) p.push([Math.cos((i / 8) * PI / 2), Math.sin((i / 8) * PI / 2)]);
      return latheGeo(p, seg);
    });
    return this.add(geo, color, pos, { ...o, scale: vec(r) });
  }

  box(color, pos, size, o = {}) {
    const [w, h, d] = vec(size);
    const r = o.r ?? Math.min(w, h, d) * 0.22;
    const seg = o.seg || 2;
    return this.add(cached(`b${w},${h},${d},${r},${seg}`, () => roundedBox(w, h, d, r, seg)), color, pos, o);
  }

  /** Upright cylinder centred on `pos`; `r` is a radius or [top, bottom]. */
  cyl(color, pos, r, h, o = {}) {
    const [rt, rb] = typeof r === 'number' ? [r, r] : r;
    const bevel = o.bevel ?? Math.min(Math.max(rt, rb), h) * 0.16;
    const seg = o.seg || Math.round((Math.max(rt, rb) > 0.2 ? 24 : 12) * this.detail);
    return this.add(cached(`c${rt},${rb},${h},${bevel},${seg}`, () => softCylinder(rt, rb, h, bevel, seg)), color, pos, o);
  }

  /** Cone standing on `pos`, tip up, with a blunt child-safe point. */
  cone(color, pos, r, h, o = {}) {
    const tip = o.tip ?? r * 0.16;
    const seg = o.seg || Math.round(16 * this.detail);
    const geo = cached(`k${r},${h},${tip},${seg}`, () => {
      const g = latheGeo([
        [0, 0], [r * 0.9, 0], [r, h * 0.04], [r * 0.97, h * 0.1],
        [tip * 1.1, h - tip], [tip * 0.75, h - tip * 0.3], [0, h],
      ], seg, o.from ?? 0);
      return seg <= 8 ? creaseNormals(g, PI / 6) : g;
    });
    return this.add(geo, color, pos, o);
  }

  /** Ring facing the viewer (in the xy plane); `arc` and `from` cut a slice. */
  torus(color, pos, R, r, o = {}) {
    const arc = o.arc ?? PI * 2;
    const from = o.from ?? 0;
    const geo = cached(`t${R},${r},${arc},${from},${o.seg}`, () =>
      new THREE.TorusGeometry(R, r, o.radial || 10, o.seg || Math.max(8, Math.round(30 * arc / (PI * 2))), arc).rotateZ(from));
    return this.add(geo, color, pos, o);
  }

  /** Spin a [radius, y] outline. It is splined smooth unless `sharp` or `facet`. */
  lathe(color, pos, profile, o = {}) {
    if (!o.sharp && !o.facet) {
      profile = new THREE.SplineCurve(profile.map(([x, y]) => new THREE.Vector2(x, y)))
        .getPoints(profile.length * 3).map((v) => [v.x, v.y]);
    }
    let g = latheGeo(profile, o.seg || Math.round(26 * this.detail), o.from ?? 0, o.sweep ?? PI * 2);
    if (o.facet) g = creaseNormals(g, 0.05);
    return this.add(g, color, pos, o);
  }

  /** A bendy tube through `points`, with round ends. */
  tube(color, points, r, o = {}) {
    const g = tubeGeo(points, r, o);
    // `along(t)` paints by distance down the tube rather than by position.
    const ring = (o.radial || 10) + 1, rings = g.attributes.position.count / ring - 1;
    this.add(g, o.along ? (x, y, z, i) => o.along(Math.floor(i / ring) / rings) : color, [0, 0, 0], o);
    if (o.caps !== false && !o.closed) {
      const rad = typeof r === 'function' ? r : () => r;
      g.userData.ends.forEach((p, i) => {
        const k = rad(i);
        if (k < 0.004) return;
        const c = typeof color === 'function' ? color(p.x, p.y, p.z) : color;
        this.ball(c, p.toArray(), [k, k, k * (o.flat || 1)], { surf: o.surf, ao: false, ink: o.ink ?? o.ao ?? true, seg: o.radial || 10 });
      });
    }
    return this;
  }

  /** A straight sausage from `a` to `b`. */
  rod(color, a, b, r, o = {}) {
    const A = new Vector3(...a), B = new Vector3(...b);
    const len = A.distanceTo(B);
    const geo = cached(`r${r},${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, len, 4, r > 0.12 ? 14 : 9));
    const quat = new Quaternion().setFromUnitVectors(UP, B.clone().sub(A).normalize());
    return this.add(geo, color, A.add(B).multiplyScalar(0.5).toArray(), { ...o, quat });
  }

  /** A flat shape blown up into a puffy cushion facing the viewer. */
  puff(color, pos, shape, depth, o = {}) {
    return this.add(puffGeo(shape, depth, o.bevel ?? depth * 0.4, o), color, pos, o);
  }

  /** A star, heart or any outline visible from its centre, stuffed like a pillow. */
  pillow(color, pos, shape, depth, o = {}) {
    return this.add(pillowGeo(shape, depth, o), color, pos, o);
  }

  /* ---- helpers for faces and markings ---- */

  /** The point on an ellipsoid at `yaw` (right +) and `pitch` (up +). */
  static on(c, r, yaw, pitch, lift = 0) {
    const [rx, ry, rz] = vec(r);
    const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const n = new Vector3(d[0] / rx, d[1] / ry, d[2] / rz).normalize();
    const p = [c[0] + d[0] * rx + n.x * lift, c[1] + d[1] * ry + n.y * lift, c[2] + d[2] * rz + n.z * lift];
    return { p, rot: [-Math.asin(n.y), Math.atan2(n.x, n.z), 0] };
  }

  /** A flattened blob stuck to the surface of an ellipsoid: spots, cheeks, patches. */
  spot(color, c, r, yaw, pitch, size, o = {}) {
    const { p, rot } = Builder.on(c, r, yaw, pitch, o.lift ?? 0);
    const [w, h] = typeof size === 'number' ? [size, size] : size;
    rot[2] = o.roll || 0;
    return this.ball(color, p, [w, h, o.thick ?? Math.min(w, h) * 0.3], { ao: false, ...o, rot });
  }

  /** A line drawn over the surface of an ellipsoid, through [yaw, pitch] pairs. */
  line(color, c, r, angles, width, o = {}) {
    return this.tube(color, angles.map(([y, p]) => Builder.on(c, r, y, p, o.lift ?? 0).p), width,
      { radial: 6, ao: false, ...o });
  }

  /** Two glossy eyes, in their own part so the toy can blink. */
  eyes(c, r, { yaw = 0.42, pitch = 0.08, size = 0.1, white = 0, at = 0, color = '#2a1d2e', lift: raise = 0 } = {}) {
    const mid = Builder.on(c, r, at, pitch).p;
    return this.part('eyes', mid, () => {
      for (const s of [-1, 1]) {
        const y = at + s * yaw;
        if (white) this.spot('#ffffff', c, r, y, pitch, [white, white * 1.1], { thick: white * 0.45, surf: 'bright', lift: raise, ink: true });
        const lift = raise + (white ? white * 0.3 : 0);
        this.spot(color, c, r, y, pitch, [size * 0.82, size], { thick: size * 0.5, lift });
        const { p } = Builder.on(c, r, y, pitch, lift + size * 0.42);
        this.ball('#ffffff', [p[0] - size * 0.24, p[1] + size * 0.36, p[2]], size * 0.3, { surf: 'bright', ao: false });
        this.ball('#ffffff', [p[0] + size * 0.26, p[1] - size * 0.34, p[2]], size * 0.14, { surf: 'bright', ao: false });
      }
    });
  }

  cheeks(c, r, { yaw = 0.72, pitch = -0.2, size = 0.1, color = '#ff9db0', at = 0 } = {}) {
    for (const s of [-1, 1]) this.spot(color, c, r, at + s * yaw, pitch, [size, size * 0.7], { thick: 0.015 });
    return this;
  }

  smile(c, r, { pitch = -0.3, width = 0.2, drop = 0.12, size = 0.018, color = '#5a2a33', at = 0, lift = 0 } = {}) {
    const pts = [];
    for (let i = -2; i <= 2; i++) pts.push([at + (i / 2) * width, pitch - drop * (1 - (i / 2) ** 2)]);
    return this.line(color, c, r, pts, size, { lift });
  }

  /** Eyes, cheeks and a smile in one go — for objects that deserve a face. */
  face(c, r, { scale = 1, pitch = 0, size = 0.08, at = 0 } = {}) {
    this.eyes(c, r, { yaw: 0.36 * scale, pitch: pitch + 0.08 * scale, size, at });
    this.cheeks(c, r, { yaw: 0.6 * scale, pitch: pitch - 0.14 * scale, size: size * 0.95, at });
    return this.smile(c, r, { pitch: pitch - 0.1 * scale, width: 0.16 * scale, drop: 0.12 * scale, size: size * 0.2, at });
  }

  /** The same face on a flat surface looking down +z; `k` is its overall size. */
  flatFace(x, y, z, k = 1) {
    return this.face([x, y, z - 20 * k], 20 * k, { scale: 0.028, size: 0.075 * k });
  }

  /* ---- structure ---- */

  /** Run `fn` with a transform applied to everything it adds. */
  group(pos, rot, scale, fn) {
    const m = new Matrix4().compose(
      new Vector3(...pos),
      new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2], 'YXZ')),
      new Vector3(...vec(scale)),
    ).premultiply(this.xf);
    this.stack.push(m);
    fn(this);
    this.stack.pop();
    return this;
  }

  /** Call `fn(+1)` and `fn(-1)` — for left and right. */
  both(fn) { fn(1); fn(-1); return this; }

  /** Everything `fn` adds becomes a separately movable mesh hinged at `pivot`. */
  part(name, pivot, fn) {
    const parent = this.cur;
    const part = { name, parent, pivot: new Vector3(...pivot).applyMatrix4(this.xf), prims: [] };
    this.parts.push(part);
    this.cur = part;
    fn(this);
    this.cur = parent;
    return this;
  }

  /** Remember a named point (a hat peg, a chimney, a mouth). */
  anchor(name, p) {
    this.anchors[name] = { p: new Vector3(...p).applyMatrix4(this.xf), part: this.cur };
    return this;
  }

  /* ---- baking ---- */

  /** Stand-in spheres for a primitive, used to shade its neighbours. */
  static occluders(prim) {
    prim.g.computeBoundingBox();
    const box = prim.g.boundingBox;
    const c = box.getCenter(new Vector3());
    const h = box.getSize(new Vector3()).multiplyScalar(0.5).toArray();
    const order = [0, 1, 2].sort((a, b) => h[a] - h[b]);
    const r = Math.sqrt(h[order[0]] * h[order[1]]);
    if (r < 0.04) return [];
    const long = h[order[2]];
    const n = Math.min(4, Math.max(1, Math.round(long / Math.max(r, h[order[1]]))));
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = c.toArray();
      if (n > 1) p[order[2]] += ((i / (n - 1)) * 2 - 1) * (long - r);
      out.push([p[0], p[1], p[2], r]);
    }
    return out;
  }

  bakeAO() {
    if (!this.ao) return;
    const all = this.parts.flatMap((p) => p.prims);
    const occ = all.map((p) => (p.ao ? Builder.occluders(p) : []));
    all.forEach((prim, pi) => {
      const pos = prim.g.attributes.position.array, nor = prim.g.attributes.normal.array;
      for (let i = 0; i < pos.length; i += 3) {
        let o = 0;
        for (let k = 0; k < occ.length; k++) {
          if (k === pi) continue;
          for (const [x, y, z, r] of occ[k]) {
            const dx = x - pos[i], dy = y - pos[i + 1], dz = z - pos[i + 2];
            const l2 = dx * dx + dy * dy + dz * dz;
            if (l2 > r * r * 9) continue;
            const l = Math.sqrt(l2) || 1e-4;
            const nl = (dx * nor[i] + dy * nor[i + 1] + dz * nor[i + 2]) / l;
            if (nl > 0) o += nl * Math.min(1, (r * r) / l2);
          }
        }
        prim.shade[i / 3] = Math.min(1, o);
      }
    });
  }

  /** Outward directions for the ink line, welded across hard edges so it never splits. */
  static hull(prim, unit) {
    const pos = prim.g.attributes.position.array, out = prim.g.attributes.normal.array.slice();
    if (!prim.index) {
      const sums = new Map();
      const key = (i) => `${Math.round(pos[i] * 2e3)},${Math.round(pos[i + 1] * 2e3)},${Math.round(pos[i + 2] * 2e3)}`;
      for (let i = 0; i < pos.length; i += 3) {
        const k = key(i), s = sums.get(k) || [0, 0, 0];
        sums.set(k, [s[0] + out[i], s[1] + out[i + 1], s[2] + out[i + 2]]);
      }
      for (let i = 0; i < pos.length; i += 3) out.set(sums.get(key(i)), i);
    }
    // Chunky parts get a bolder line than whiskers and antennae.
    prim.g.computeBoundingBox();
    const h = prim.g.boundingBox.getSize(_p).toArray().sort((a, b) => a - b);
    const weight = Math.min(1.5, Math.max(0.5, (h[1] * unit) / 0.26));
    for (let i = 0; i < out.length; i += 3) {
      const k = weight / (Math.hypot(out[i], out[i + 1], out[i + 2]) || 1);
      out[i] *= k; out[i + 1] *= k; out[i + 2] *= k;
    }
    return out;
  }

  /** One geometry, two draw groups: everything in paint, then the inked parts in ink. */
  static merge(prims, unit) {
    prims = [...prims.filter((p) => p.ink), ...prims.filter((p) => !p.ink)];
    const count = (p) => (p.index ? p.index.count : p.shade.length);
    let nv = 0, ni = 0, inked = 0;
    for (const p of prims) { nv += p.shade.length; ni += count(p); if (p.ink) inked += count(p); }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const surf = new Float32Array(nv * 3), hull = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0, k = 0;
    for (const p of prims) {
      const n = p.shade.length;
      pos.set(p.g.attributes.position.array, v * 3);
      nor.set(p.g.attributes.normal.array, v * 3);
      col.set(p.col, v * 3);
      if (p.ink) hull.set(Builder.hull(p, unit), v * 3);
      for (let i = 0; i < n; i++) {
        const j = (v + i) * 3;
        surf[j] = p.surf[0]; surf[j + 1] = p.shade[i]; surf[j + 2] = p.surf[1];
      }
      if (p.index) for (let i = 0; i < p.index.count; i++) idx[k++] = p.index.array[i] + v;
      else for (let i = 0; i < n; i++) idx[k++] = v + i;
      v += n;
    }
    const g = new BufferGeometry();
    for (const [name, array] of Object.entries({ position: pos, normal: nor, color: col, surf, hull })) {
      g.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.addGroup(0, ni, 0);
    if (inked) g.addGroup(0, inked, 1);
    return g;
  }

  /**
   * Bake into a reusable template. With `fit`, the model is scaled so its
   * larger of width/height is 1, centred on x/z and stood on y = 0.
   */
  bake({ fit = false } = {}) {
    this.bakeAO();
    const box = new THREE.Box3();
    for (const part of this.parts) for (const p of part.prims) { p.g.computeBoundingBox(); box.union(p.g.boundingBox); }
    const size = box.getSize(new Vector3());
    const k = fit ? 1 / Math.max(size.x, size.y) : 1;
    const geos = this.parts.map((p) => Builder.merge(p.prims, k));
    const m = new Matrix4();
    if (fit) {
      const c = box.getCenter(new Vector3());
      m.makeScale(k, k, k).multiply(new Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
      size.multiplyScalar(k);
    }
    const parts = this.parts.map((p, i) => {
      const pivot = p.parent ? p.pivot.clone().applyMatrix4(m) : new Vector3();
      geos[i].applyMatrix4(m).translate(-pivot.x, -pivot.y, -pivot.z);
      geos[i].computeBoundingSphere();
      return { name: p.name, parent: this.parts.indexOf(p.parent), pivot, geo: geos[i] };
    });
    const anchors = {};
    for (const [name, a] of Object.entries(this.anchors)) {
      const part = this.parts.indexOf(a.part);
      anchors[name] = { part, p: a.p.clone().applyMatrix4(m).sub(parts[part].pivot) };
    }
    return { parts, anchors, size };
  }
}

/** Build meshes for a baked template. Geometry is shared, never copied. */
export function instantiate(template, { material = toyMaterial(), shadow = true, receive = false } = {}) {
  const parts = {};
  const nodes = template.parts.map((p) => {
    const mesh = new THREE.Mesh(p.geo, material);
    mesh.castShadow = shadow && p.name !== 'eyes';
    mesh.receiveShadow = receive;
    mesh.name = p.name;
    parts[p.name] = mesh;
    return mesh;
  });
  template.parts.forEach((p, i) => {
    if (p.parent < 0) return;
    nodes[i].position.copy(p.pivot).sub(template.parts[p.parent].pivot);
    nodes[p.parent].add(nodes[i]);
  });
  const anchors = {};
  for (const [name, a] of Object.entries(template.anchors)) {
    const o = new THREE.Object3D();
    o.position.copy(a.p);
    nodes[a.part].add(o);
    anchors[name] = o;
  }
  return { root: nodes[0], parts, anchors };
}

/**
 * One-off geometry in raw world units — scenery, props, game boards. The
 * geometry belongs to the returned mesh and is freed with the scene.
 */
export function build(fn, { ao = false, detail = 1, shadow = true, receive = true, material } = {}) {
  const b = new Builder({ ao, detail });
  fn(b);
  const made = instantiate(b.bake(), { shadow, receive, material });
  made.root.traverse((o) => { if (o.isMesh) o.userData.owned = true; });
  made.root.parts = made.parts;
  made.root.anchors = made.anchors;
  return made.root;
}
