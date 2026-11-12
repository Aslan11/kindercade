/**
 * The in-game HUD: plain DOM over the canvas, sized in rem (1rem = one screen
 * unit), so text stays razor sharp whatever resolution the 3D is running at.
 */

import { audio } from './audio.js';

const svg = (body, fill = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  home: svg('<path d="M3 11.5 12 4l9 7.5"/><path d="M6 10.5V20h12v-9.5" fill="currentColor"/>'),
  speaker: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  again: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.6-5.7"/><path d="M19.5 3.5v4h-4"/>'),
  next: svg('<path d="M8 5l10 7-10 7z"/>', true),
  star: svg('<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.2L12 17.2l-5.6 3 1.2-6.2L3 9.6l6.3-.8z"/>', true),
  gift: svg('<rect x="4" y="11" width="16" height="9" rx="1.5" fill="currentColor"/><path d="M3 9h18M12 8c-1-4-6-4-5.5-1.5C7 8 10 8 12 8zm0 0c1-4 6-4 5.5-1.5C17 8 14 8 12 8z"/>'),
  gear: svg('<circle cx="12" cy="12" r="5.4" stroke-width="3.6"/><path stroke-width="3.6" stroke-linecap="butt" d="M12 2.5v4m0 11v4M2.5 12h4m11 0h4M5.3 5.3l2.8 2.8m7.8 7.8 2.8 2.8m0-13.4-2.8 2.8m-7.8 7.8-2.8 2.8"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9.5" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  bulb: svg('<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1h6c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3z" fill="currentColor"/>'),
  undo: svg('<path d="M9 5 4 10l5 5"/><path d="M4 10h9.5a5.5 5.5 0 0 1 0 11H10"/>'),
};

export const roundButton = (icon, color, label, id = '') =>
  `<button class="orb" ${id ? `id="${id}"` : ''} type="button" aria-label="${label}" style="--c:${color}">${ICONS[icon]}</button>`;

const centre = (el) => {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
};

export class Hud {
  constructor(root) { this.root = root; }

  $(sel) { return this.root.querySelector(sel); }

  on(sel, fn) { this.$(sel).addEventListener('click', () => { audio.unlock(); audio.tap(); fn(); }); }

  reset() { this.root.innerHTML = ''; }

  show({ total, level, tint, onHome, onSpeak }) {
    this.root.style.setProperty('--tint', tint);
    this.root.innerHTML = `
      <div class="hud-top">
        ${roundButton('home', '#ff6b8b', 'Home', 'hud-home')}
        <div class="hud-mid">
          <div class="hud-ask" hidden>${roundButton('speaker', '#2fb0ee', 'Say it again', 'hud-speak')}<p></p></div>
          <div class="pips">${`<i>${ICONS.star}</i>`.repeat(total)}</div>
        </div>
        <div class="hud-level" aria-label="Level ${level}"><small>Level</small>${level}</div>
      </div>
      <div class="hud-corner"></div>
      <div class="shouts"></div>`;
    this.on('#hud-home', onHome);
    this.on('#hud-speak', onSpeak);
  }

  prompt(text) {
    const ask = this.$('.hud-ask');
    if (!ask) return;
    ask.hidden = !text;
    ask.querySelector('p').textContent = text;
    ask.classList.remove('fresh');
    void ask.offsetWidth;          // restart the pop animation
    ask.classList.add('fresh');
  }

  /** A game's own helper button (hint, undo), tucked under the level badge. */
  button(icon, color, label, fn) {
    this.$('.hud-corner').insertAdjacentHTML('beforeend', roundButton(icon, color, label, `hud-${icon}`));
    this.on(`#hud-${icon}`, fn);
  }

  pipCentre(i) { const pips = this.$('.pips').children; return centre(pips[Math.min(i, pips.length - 1)]); }
  fill(i) { this.$('.pips')?.children[i]?.classList.add('on'); }

  /** Big bouncy words across the middle of the screen. */
  shout(text, rainbow = false) {
    const box = this.$('.shouts');
    if (!box) return;
    box.innerHTML = '';
    const el = box.appendChild(document.createElement('div'));
    el.className = rainbow ? 'shout rainbow' : 'shout';
    el.textContent = text;
    el.addEventListener('animationend', () => el.remove());
  }

  /** A white camera flash. */
  flash() {
    const el = this.root.appendChild(document.createElement('div'));
    el.className = 'flash';
    el.addEventListener('animationend', () => el.remove());
  }

  /** Pin a snapshot to the album strip down the right-hand edge. */
  photo(canvas) {
    let album = this.$('.album');
    if (!album) { album = this.root.appendChild(document.createElement('div')); album.className = 'album'; }
    album.appendChild(document.createElement('figure')).append(canvas);
  }

  /* -------------------------------------------------------------- results */

  results({ title, jar, size }) {
    this.root.innerHTML = `
      <div class="results">
        <h2></h2>
        <div class="jar" aria-hidden="true">${`<i>${ICONS.star}</i>`.repeat(size)}<b>${ICONS.gift}</b></div>
        <div class="result-buttons"></div>
      </div>`;
    this.title(title);
    this.jar(jar);
  }

  title(text) {
    const h = this.$('.results h2');
    h.textContent = text;
    h.classList.remove('fresh');
    void h.offsetWidth;
    h.classList.add('fresh');
  }

  jar(n) {
    const slots = [...this.root.querySelectorAll('.jar i')];
    slots.forEach((el, i) => el.classList.toggle('on', i < n));
    this.$('.jar').classList.toggle('full', n >= slots.length);
  }

  jarCentre(i) { return centre(this.root.querySelectorAll('.jar i')[i]); }

  resultButtons({ hasNext, onHome, onAgain, onNext }) {
    this.$('.result-buttons').innerHTML = roundButton('home', '#ff6b8b', 'Home', 'res-home')
      + roundButton('again', '#2fb0ee', 'Play again', 'res-again')
      + (hasNext ? roundButton('next', '#2fc77f', 'Next level', 'res-next') : '');
    this.on('#res-home', onHome);
    this.on('#res-again', onAgain);
    if (hasNext) this.on('#res-next', onNext);
  }
}
