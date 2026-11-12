/**
 * The prize ceremony. Stars thump down, pour into the jar, and — when the jar
 * is full — a present drops out of the sky for the child to bash open.
 */

import * as THREE from './three.js';
import { Toy, Buddy } from './toy.js';
import { build, toyMaterial, Shapes } from './kit.js';
import { gift } from '../models/things.js';
import { Ease } from './anim.js';
import { music } from './music.js';
import { HATS, JAR_SIZE, progress } from './progress.js';
import { PRAISE, toyName } from '../data/words.js';
import { pick } from './util.js';

const WRAPPING = [['#ff6b8b', '#ffd23c'], ['#4cb4f0', '#ffffff'], ['#9b6cff', '#ffd23c'], ['#3ddc97', '#ffffff']];

export async function showResults(game, { stars, hasNext, unlocked, jarBefore, jarAfter, filled, toy }) {
  const { hud, fx, audio, engine } = game;
  const title = pick(PRAISE);
  game.results = { stars, title, ready: false };
  game.modal = () => {};

  music.play(null);
  audio.fanfare();
  fx.rain(engine.halfW, engine.halfH);
  await game.wait(1.1);

  const veil = game.overlay(new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: '#1e1245', transparent: true, opacity: 0, depthWrite: false }),
  ));
  veil.userData = { owned: true, ownsMaterial: true };
  veil.position.z = -6;
  veil.renderOrder = -1;
  game.to(veil.material, { opacity: 0.68 }, 0.4);
  // The buddy steps out in front of the curtain to celebrate too.
  if (game.pal) game.pal.visible = false;
  game.pal = game.overlay(new Buddy(progress.buddy, 2.5).wear(progress.hat));
  game.pal.position.set(-4.4, -3.9, 0);
  game.pal.dancing = true;
  game.appear(game.pal, 0.2);
  hud.results({ title, jar: jarBefore, size: JAR_SIZE });
  audio.speak(progress.name ? `${title.slice(0, -1)}, ${progress.name}!` : title);

  /* ---- stars ---- */
  const won = [];
  for (let i = 0; i < 3; i++) {
    const socket = game.overlay(new Toy('star', 1.75, { idle: 0, material: toyMaterial('#4a3d80') }));
    socket.parts.eyes.visible = false;
    socket.position.set((i - 1) * 2.15, i === 1 ? 0.75 : 0.45, -1);
    game.appear(socket);
    won.push({ socket });
  }
  await game.wait(0.5);
  for (let i = 0; i < stars; i++) {
    const star = won[i].star = game.overlay(new Toy('star', 1.75));
    const { x, y } = won[i].socket.position;
    star.position.set(x, y, 0);
    star.scale.setScalar(2.6);
    star.spin();
    await game.scaleTo(star, 1, 0.34, { ease: Ease.inQuad });
    star.boing(1.2);
    audio.star(i);
    fx.starBurst(game.at(star), 8);
    fx.ring(game.at(star), { color: '#ffe27a', r: 1.8 });
    await game.wait(0.16);
  }
  await game.wait(0.5);

  /* ---- into the jar ---- */
  let level = jarBefore;
  for (let i = 0; i < stars && level < JAR_SIZE; i++) {
    const mini = game.overlay(new Toy('star', 0.5));
    const from = game.at(won[i].star), to = engine.point(hud.jarCentre(level));
    mini.position.set(from.x, from.y, 2);
    await game.jump(mini, [to.x, to.y - 0.25, 0], { height: 0.5, dur: 0.36 });
    mini.removeFromParent();
    hud.jar(++level);
    audio.step(5 + level);
  }

  /* ---- a present! ---- */
  if (filled) {
    await game.wait(0.3);
    won.forEach((w) => { game.vanish(w.socket); if (w.star) game.vanish(w.star); });
    await unwrap(game, toy);
    hud.jar(jarAfter);
  }
  if (unlocked) audio.speak('You unlocked a new level!', { delay: 0.2 });

  game.results.ready = true;
  game.modal = (p) => fx.sparkle(p, 6);
  music.play('home');
  hud.resultButtons({
    hasNext,
    onHome: () => game.exit(),
    onAgain: () => game.goTo(game.level),
    onNext: () => game.goTo(game.level + 1),
  });
}

async function unwrap(game, prize) {
  const { hud, fx, audio, engine } = game;
  const mesh = build((b) => gift(b, ...pick(WRAPPING)), { ao: true });
  mesh.scale.setScalar(2.5);
  mesh.rotation.set(0.28, -0.5, 0);
  const box = game.overlay(new Toy(mesh, 2.5));
  const rest = [0, -0.75, 0];
  box.position.set(0, engine.halfH + 1, 0);
  audio.swoop();
  await game.moveTo(box, rest, 0.75, { ease: Ease.outBounce });
  audio.place();
  hud.title('A present!');
  audio.speak('A present! Tap it to open it!');

  game.results.gift = box;
  engine.glove.show([() => game.at(box)]);
  for (let taps = 1; taps <= 3; taps++) {
    // Any touch counts: at this point the whole screen is the present.
    await new Promise((done) => { game.modal = done; });
    box.boing(1.4).wiggle(taps % 2 ? 1.2 : -1.2);
    game.scaleTo(box, 1 + taps * 0.09, 0.2, { ease: Ease.outBack });
    audio.boing(0.8 + taps * 0.25);
    fx.sparkle(game.at(box), 8 * taps, { spread: 3 });
  }
  game.modal = () => {};
  game.results.gift = null;
  audio.stopSpeech();
  audio.drumroll(0.7);
  for (let i = 0; i < 5; i++) { box.wiggle(i % 2 ? 1 : -1); await game.wait(0.14); }

  const at = game.at(box);
  audio.pop();
  audio.magic();
  fx.confetti(at, 70);
  fx.starBurst(at, 14);
  fx.ring(at, { r: 4, life: 0.6 });
  game.to(mesh.parts.lid.position, { y: 3.4, x: 0.8 }, 0.6);
  game.to(mesh.parts.lid.rotation, { z: -2.4 }, 0.6);
  game.vanish(box, 0.25);

  const rays = game.overlay(new THREE.Mesh(
    new THREE.ShapeGeometry(Shapes.star(3.4, 1.3, 12, 0.01), 1),
    new THREE.MeshBasicMaterial({ color: '#ffd23c', transparent: true, opacity: 0.4, depthWrite: false }),
  ));
  rays.userData = { owned: true, ownsMaterial: true };
  rays.position.set(0, 0.5, -3);
  game.appear(rays);
  game.every((dt) => { rays.rotation.z -= dt * 0.4; });

  // With every toy collected the present is still a party.
  const name = prize || 'trophy';
  const toy = game.overlay(new Toy(name, 2.9));
  toy.position.set(0, -0.95 + (2.9 - toy.height) / 2, 1);
  toy.float = 0.08;
  toy.spin();
  await game.appear(toy, 0.15);
  game.every((dt, t) => { if (toy.spinT === 1) toy.act.rotation.y = Math.sin(t * 1.4) * 0.45; });
  if (!prize) {
    hud.title('Superstar!');
    await game.talk('You found every toy. You are a superstar!', { min: 1.5 });
    return;
  }
  const said = toyName(prize);
  hud.title(`A new ${HATS.includes(prize) ? 'hat' : 'toy'}!`);
  if (HATS.includes(prize)) {
    progress.hat = prize;
    game.pal.wear(prize).spin();
    await game.talk(`A ${said} for ${progress.buddy} to wear!`, { min: 1.5 });
  } else {
    await game.talk(`You got ${/^(?!uni)[aeiou]/.test(said) ? 'an' : 'a'} ${said}!`, { min: 1.5 });
  }
}
