import * as THREE from 'three';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const pointer = { x: 0, y: 0, nx: 0, ny: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.ny = -((e.clientY / window.innerHeight) * 2 - 1);
});

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
let lenis = null;
if (!prefersReducedMotion && Lenis) {
  lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
  else document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
};

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    e.preventDefault();
    closeMenu();
    scrollTo(href === '#' ? 0 : href);
  });
});

/* ------------------------------------------------------------------ */
/* Header + mobile menu                                                */
/* ------------------------------------------------------------------ */
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.nav-toggle');
const overlay = document.querySelector('.menu-overlay');

function closeMenu() {
  if (!overlay?.classList.contains('open')) return;
  overlay.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
  overlay.setAttribute('aria-hidden', 'true');
  lenis?.start();
}

toggle?.addEventListener('click', () => {
  const isOpen = overlay.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(isOpen));
  overlay.setAttribute('aria-hidden', String(!isOpen));
  if (isOpen) lenis?.stop();
  else lenis?.start();
});

let lastScroll = 0;
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => {
    const y = self.scroll();
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > lastScroll && y > 400 && !overlay.classList.contains('open'));
    lastScroll = y;
  },
});

/* ------------------------------------------------------------------ */
/* Text splitting                                                      */
/* ------------------------------------------------------------------ */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = words
    .map((w) => `<span class="split-line" aria-hidden="true"><span class="split-word">${w}</span></span>`)
    .join(' ');
  return el.querySelectorAll('.split-word');
}

document.querySelectorAll('[data-split]').forEach(splitWords);

document.querySelectorAll('[data-scrub-words]').forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="scrub-word">${w}</span>`).join(' ');
});

/* ------------------------------------------------------------------ */
/* 2D scissors: shared SVG + cut lines                                 */
/* ------------------------------------------------------------------ */
// Pivot sits at (30, 20); blades point right, rings on the left.
const scissorsSVG = `
<svg viewBox="0 0 64 40">
  <g class="blade-a">
    <path class="blade-metal" d="M27 17.2 L61.5 19.6 L61.5 20.3 L27 21 Z" />
    <path class="blade-metal" d="M17 13 L30 19 L29 21 L15.5 15 Z" />
    <circle class="blade-ring" cx="11" cy="10" r="6.5" />
  </g>
  <g class="blade-b">
    <path class="blade-metal" d="M27 22.8 L61.5 20.4 L61.5 19.7 L27 19 Z" />
    <path class="blade-metal" d="M17 27 L30 21 L29 19 L15.5 25 Z" />
    <circle class="blade-ring" cx="11" cy="30" r="6.5" />
  </g>
  <circle cx="30" cy="20" r="2" stroke-width="1.2" style="fill: var(--bg); stroke: var(--metal)" />
</svg>`;

document.querySelectorAll('[data-scissors]').forEach((el) => (el.innerHTML = scissorsSVG));

function setCut(line, progress) {
  const p = gsap.utils.clamp(0, 1, progress);
  line.style.setProperty('--p', `${(p * 100).toFixed(2)}%`);
  // snip open/closed several times while travelling
  const angle = Math.abs(Math.sin(p * Math.PI * 9)) * 26;
  line.querySelector('.blade-a').style.transform = `rotate(${-angle}deg)`;
  line.querySelector('.blade-b').style.transform = `rotate(${angle}deg)`;
}

/* ------------------------------------------------------------------ */
/* Themes: CSS handles the page, this table drives the WebGL particles */
/* ------------------------------------------------------------------ */
const THEMES = {
  rose: {
    bg: '#120b0d',
    primary: '#e58fa0',
    accent: '#f2c98a',
    stars: '#f6dcd2',
    light: false,
  },
  sage: {
    bg: '#0b1210',
    primary: '#8fcfa8',
    accent: '#f0a27a',
    stars: '#dcefe2',
    light: false,
  },
  blush: {
    bg: '#faf3ee',
    primary: '#d6587e',
    accent: '#b8864b',
    stars: '#d6587e',
    light: true,
  },
  candy: {
    bg: '#fff8fc',
    primary: '#ff2e88',
    accent: '#00a9b8',
    stars: '#ff2e88',
    light: true,
  },
  midnight: {
    bg: '#050b18',
    primary: '#8a72ff',
    accent: '#79f0d5',
    stars: '#bfccff',
    light: false,
  },
};

let themeName = THEMES[document.documentElement.dataset.theme] ? document.documentElement.dataset.theme : 'blush';
const theme = () => THEMES[themeName];

/* ------------------------------------------------------------------ */
/* WebGL: star field + falling hair clippings                          */
/* ------------------------------------------------------------------ */
const scene3d = { ready: false };

function initWebGL() {
  const canvas = document.querySelector('.webgl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(theme().bg, 1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  const isMobile = window.innerWidth < 900;

  // soft star field for depth
  const starCount = isMobile ? 400 : 900;
  const starPos = new Float32Array(starCount * 3);
  const starSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const r = 4 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi) - 5;
    starSeed[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
    uStar: { value: new THREE.Color(theme().stars) },
    uClipA: { value: new THREE.Color(theme().primary) },
    uClipB: { value: new THREE.Color(theme().accent) },
  };
  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPixel;
        attribute float aSeed; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (1.5 + aSeed * 2.5) * uPixel * (6.0 / -mv.z);
          vA = 0.2 + 0.5 * abs(sin(uTime * 0.6 + aSeed * 40.0));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uStar; varying float vA;
        void main(){
          float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA;
          gl_FragColor = vec4(uStar, a);
        }`,
    })
  );
  scene.add(stars);

  // falling hair clippings: each point is drawn as a thin rotating sliver
  const clipCount = isMobile ? 120 : 260;
  const clipPos = new Float32Array(clipCount * 3);
  const clipSeed = new Float32Array(clipCount);
  for (let i = 0; i < clipCount; i++) {
    clipPos[i * 3] = (Math.random() - 0.5) * 16;
    clipPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
    clipPos[i * 3 + 2] = -4 + Math.random() * 5;
    clipSeed[i] = Math.random();
  }
  const clipGeo = new THREE.BufferGeometry();
  clipGeo.setAttribute('position', new THREE.BufferAttribute(clipPos, 3));
  clipGeo.setAttribute('aSeed', new THREE.BufferAttribute(clipSeed, 1));
  const clippings = new THREE.Points(
    clipGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPixel;
        attribute float aSeed;
        varying float vAngle; varying float vSeed;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime * (0.12 + aSeed * 0.22) + 5.0, 10.0) - 5.0;
          p.x += sin(uTime * 0.7 + aSeed * 30.0) * 0.25;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (10.0 + aSeed * 14.0) * uPixel * (6.0 / -mv.z);
          vAngle = aSeed * 6.28 + uTime * (aSeed - 0.5) * 1.6;
          vSeed = aSeed;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uClipA; uniform vec3 uClipB;
        varying float vAngle; varying float vSeed;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float s = sin(vAngle), co = cos(vAngle);
          c = vec2(co * c.x - s * c.y, s * c.x + co * c.y);
          float line = smoothstep(0.05, 0.0, abs(c.y + sin(c.x * 6.0) * 0.04));
          float a = line * smoothstep(0.5, 0.3, abs(c.x)) * 0.7;
          vec3 col = mix(uClipA, uClipB, vSeed);
          gl_FragColor = vec4(col, a);
        }`,
    })
  );
  scene.add(clippings);

  scene3d.ready = true;

  // swap scene colours instantly (the page itself is revealed by the view transition)
  scene3d.applyTheme = () => {
    const t = theme();
    renderer.setClearColor(t.bg, 1);
    uniforms.uStar.value.set(t.stars);
    uniforms.uClipA.value.set(t.primary);
    uniforms.uClipB.value.set(t.accent);
    // additive glow vanishes on a light background, so use normal blending there
    [stars.material, clippings.material].forEach((mat) => {
      mat.blending = t.light ? THREE.NormalBlending : THREE.AdditiveBlending;
      mat.needsUpdate = true;
    });
    render();
  };

  const clock = new THREE.Clock();
  const rot = { x: 0, y: 0 };
  let last = 0;
  let k = 1; // per-frame lerp scale so motion speed doesn't depend on frame rate
  const lerp = (a, b, f) => a + (b - a) * (1 - Math.pow(1 - f, k));

  function render() {
    const t = clock.getElapsedTime();
    k = Math.min((t - last) * 60, 6);
    last = t;
    uniforms.uTime.value = t;

    rot.x = lerp(rot.x, pointer.ny * 0.35, 0.04);
    rot.y = lerp(rot.y, pointer.nx * 0.5, 0.04);

    stars.rotation.y = t * 0.015 + rot.y * 0.15;
    clippings.rotation.y = rot.y * 0.1;

    camera.position.x = lerp(camera.position.x, pointer.nx * 0.3, 0.03);
    camera.position.y = lerp(camera.position.y, pointer.ny * 0.2, 0.03);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  if (prefersReducedMotion) {
    render();
  } else {
    gsap.ticker.add(render);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (prefersReducedMotion) render();
  });
}

initWebGL();

function goToScene(name) {
  if (name === comby.scene) return;
  comby.goTo(name);
}

// Created after the pinned sections so their positions include pin spacing.
function setupSceneTriggers() {
  document.querySelectorAll('[data-scene]').forEach((section) => {
    const name = section.dataset.scene;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 45%',
      onEnter: () => goToScene(name),
      onEnterBack: () => goToScene(name),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Comby's voice and sounds. Lines are read aloud with the browser's   */
/* built-in speech (Web Speech API); effects are synthesised live with */
/* Web Audio, so there are no audio files. Off by default: browsers    */
/* only allow audio after a user gesture.                              */
/* ------------------------------------------------------------------ */
const sfx = (() => {
  const toggleBtn = document.querySelector('.sound-toggle');
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let on = false;
  try {
    on = localStorage.getItem('comb-sound') === '1';
  } catch (e) {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    return ctx;
  }

  const ready = () => on && ensure() && ctx.state === 'running';

  // one oscillator note with a quick attack and exponential decay
  function tone(freq, { at = 0, dur = 0.08, type = 'sine', vol = 0.2, to = null, vibrato = 0 } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 18;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // filtered noise burst (thuds, whooshes)
  function noise({ at = 0, dur = 0.15, vol = 0.2, freq = 800, to = null, q = 1, type = 'bandpass' } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const api = {
    get on() {
      return on;
    },

    // chirpy babble that follows the text: one blip per syllable-ish, rising at ! and ?
    voice(text, { base = 520, type = 'triangle' } = {}) {
      if (!ready()) return;
      const letters = text.replace(/[^a-zA-Z]/g, '');
      const count = Math.min(26, Math.max(3, Math.round(letters.length / 2.4)));
      const end = text.trim().slice(-1);
      for (let i = 0; i < count; i++) {
        const c = letters.charCodeAt(Math.floor((i / count) * letters.length)) || 97;
        let f = base * (1 + ((c % 7) - 3) * 0.055) * (0.97 + Math.random() * 0.06);
        if (i === count - 1 && (end === '!' || end === '?')) f *= 1.3;
        tone(f, { at: i * 0.062, dur: 0.055, type, vol: 0.13, to: f * (0.92 + Math.random() * 0.1) });
      }
    },
    step() {
      if (!ready()) return;
      tone(170 + Math.random() * 40, { dur: 0.05, type: 'sine', vol: 0.12, to: 90 });
    },
    land() {
      if (!ready()) return;
      tone(150, { dur: 0.18, type: 'sine', vol: 0.3, to: 55 });
      noise({ dur: 0.12, vol: 0.12, freq: 400, type: 'lowpass' });
    },
    hop() {
      if (!ready()) return;
      tone(320, { dur: 0.16, type: 'sine', vol: 0.16, to: 760 });
    },
    giggle() {
      if (!ready()) return;
      [700, 820, 760, 940].forEach((f, i) => tone(f, { at: 0.12 + i * 0.09, dur: 0.08, type: 'triangle', vol: 0.12, vibrato: 30 }));
    },
    sparkle() {
      if (!ready()) return;
      [1568, 2093, 2637].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.35, type: 'sine', vol: 0.07 }));
    },
    whoosh() {
      if (!ready()) return;
      noise({ dur: 0.3, vol: 0.18, freq: 300, to: 3000, q: 1.5 });
    },
    pop() {
      if (!ready()) return;
      tone(500, { dur: 0.1, type: 'sine', vol: 0.22, to: 1100 });
    },
  };

  // ---- spoken voice ----
  const synth = window.speechSynthesis;
  let ttsVoice = null;
  let utter = null; // kept referenced so Chrome doesn't garbage-collect it mid-sentence
  // male voices, most natural first: Edge's neural voices, macOS Enhanced/Premium downloads,
  // Google's network voice in Chrome, then the better built-in system voices
  const PREFERRED = [
    /\b(andrew|brian|guy|christopher|eric|roger|ryan|thomas|davis|tony)\b.*\b(natural|online)\b/i,
    /\b(evan|nathan|tom|aaron|alex|daniel|oliver|arthur|gordon|lee|rishi|jamie)\b.*\((enhanced|premium)\)/i,
    /google uk english male/i,
    /^daniel\b/i,
    /^(alex|aaron|arthur|oliver|gordon|evan|nathan|tom)\b/i,
    /microsoft (david|mark|george|ryan)\b/i,
    /\bmale\b/i,
  ];
  // novelty / heavily synthetic voices that sound robotic
  const AVOID = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|fred|good news|jester|junior|organ|superstar|trinoids|whisper|zarvox|ralph|grandma|grandpa)\b/i;
  const pickVoice = () => {
    const voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang) && !AVOID.test(v.name));
    for (const re of PREFERRED) {
      const v = voices.find((x) => re.test(x.name));
      if (v) return v;
    }
    return voices.find((v) => v.default) || voices[0] || null;
  };
  if (synth) {
    ttsVoice = pickVoice();
    synth.onvoiceschanged = () => (ttsVoice = pickVoice());
  }
  // skip emoji so it doesn't read out "waving hand"
  const speakable = (text) =>
    text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/…/g, '...').replace(/\s+/g, ' ').trim();

  // read a line aloud; returns true if speech started (onEnd fires when it finishes)
  api.speak = (text, opts = {}, onEnd) => {
    if (!on) return false;
    if (!synth) {
      api.voice(text, opts); // no speech support: fall back to babble
      return false;
    }
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
      toggleBtn.classList.add('is-hinting');
      return 'blocked';
    }
    api.stopSpeaking();
    const u = new SpeechSynthesisUtterance(speakable(text));
    if (ttsVoice) u.voice = ttsVoice;
    u.lang = ttsVoice?.lang || 'en-US';
    u.pitch = opts.pitch ?? 1;
    u.rate = opts.rate ?? 1;
    u.volume = opts.volume ?? 0.6;
    u.onend = u.onerror = () => {
      if (utter !== u) return; // a newer line took over
      utter = null;
      onEnd?.();
    };
    utter = u;
    synth.speak(u);
    return true;
  };

  api.stopSpeaking = () => {
    if (!synth || !utter) return;
    utter = null; // cleared first so the cancelled line's end event is ignored
    synth.cancel();
  };

  function render() {
    toggleBtn.setAttribute('aria-pressed', String(on));
    toggleBtn.setAttribute('aria-label', on ? "Mute Comby's voice" : "Turn on Comby's voice");
  }

  api.setOn = (value) => {
    on = value;
    try {
      localStorage.setItem('comb-sound', on ? '1' : '0');
    } catch (e) {}
    render();
    toggleBtn.classList.remove('is-hinting');
    if (on) ensure();
    else api.stopSpeaking();
  };

  // browsers block speech until the visitor clicks, taps or presses a key (scrolling
  // doesn't count); these run on that first interaction so Comby can catch up
  const unlockCallbacks = [];
  api.onUnlock = (fn) => unlockCallbacks.push(fn);

  api.hint = () => {
    if (on) return;
    toggleBtn.classList.add('is-hinting');
    setTimeout(() => toggleBtn.classList.remove('is-hinting'), 3800);
  };

  render();

  // these events grant the page "user activation" (pointerdown only does for a mouse)
  const UNLOCK_EVENTS = ['pointerup', 'touchend', 'keydown', 'click'];
  const unlock = () => {
    UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, unlock, true));
    toggleBtn.classList.remove('is-hinting');
    if (on) ensure();
    unlockCallbacks.forEach((fn) => fn());
  };
  UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock, true));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) api.stopSpeaking();
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume().catch(() => {});
  });

  return api;
})();

/* ------------------------------------------------------------------ */
/* Comby, the guide that hops to each section, in two looks (comb and  */
/* hairbrush). Both SVGs share part classes, so one controller drives  */
/* either; each rig only adds its joints, mouth shapes, lines and      */
/* little extras.                                                      */
/* ------------------------------------------------------------------ */
const comby = (() => {
  const el = document.querySelector('.comby');
  const hop = el.querySelector('.comby-hop');
  const hit = el.querySelector('.comby-hit');
  const bubble = el.querySelector('.comby-bubble');
  const guideButtons = document.querySelectorAll('[data-guide-option]');

  const RIGS = {
    comby: {
      label: 'Comby (comb)',
      voice: { pitch: 0.98, rate: 1.05, volume: 0.55, base: 560, type: 'triangle' },
      joints: { armL: '30 92', armR: '130 92', legL: '48 118', legR: '112 118', eyeL: '61 84', eyeR: '99 84' },
      thinkArm: -100,
      stride: 22,
      eyeY: 0.42,
      look: 3.5,
      mouth: {
        smile: 'M70 100 Q80 111 90 100',
        grin: 'M66 98 Q80 119 94 98',
        think: 'M72 104 Q80 101 88 104',
        ooh: 'M75 102 Q80 109 85 102',
      },
      lines: {
        hello: "Hi, I'm Comby! 👋",
        hero: "Hi, I'm Comby! 👋 Let me show you around.",
        why: 'Hmm… less admin, more calm. I like that.',
        product: "Here's your whole salon day at a glance!",
        features: 'Everything your salon needs. Follow me!',
        ai: 'Psst… meet my smart friends, Bay and COMB Studio!',
        workflow: 'Book, know, run, grow. Step by step.',
        cta: "Let's talk! Book your demo 🎉",
        click: 'Hehe, that tickles! 😄',
      },
      // swaying teeth and a bouncy curl
      idle: (svg) => {
        gsap.set(svg.querySelectorAll('.cb-tooth'), { transformOrigin: '50% 0%' });
        gsap.set(svg.querySelector('.cb-tuft'), { svgOrigin: '80 52' });
        gsap.to(svg.querySelectorAll('.cb-tooth'), { rotation: 6, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.12, from: 'center' } });
        gsap.to(svg.querySelector('.cb-tuft'), { rotation: 12, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      },
      flourish: () => gsap.timeline(),
    },
    brush: {
      label: 'Comby (hairbrush)',
      voice: { pitch: 0.9, rate: 1.0, volume: 0.5, base: 430, type: 'sine' },
      joints: { armL: '69 122', armR: '91 122', legL: '74.5 156', legR: '85.5 156', eyeL: '64 72', eyeR: '96 72' },
      thinkArm: 160, // the arm swings up over the shoulder to reach the chin
      stride: 18,
      eyeY: 0.36,
      look: 4,
      mouth: {
        smile: 'M71 91 Q80 100 89 91',
        grin: 'M68 90 Q80 106 92 90',
        think: 'M73 95 Q80 93 87 95',
        ooh: 'M76 93 Q80 99 84 93',
      },
      lines: {
        hello: "Hi, I'm Comby! ✨",
        hero: "Hi, I'm Comby! ✨ Let's smooth things out.",
        why: 'No more tangles in your day. Ahh, calm.',
        product: 'Smooth numbers, smooth day!',
        features: 'Brush up on every feature. This way!',
        ai: 'Bay and COMB Studio? Brilliant brains!',
        workflow: 'Book, know, run, grow. Nice and smooth.',
        cta: "Let's make your salon shine! Book a demo ✨",
        click: 'Ooh, that tickles my bristles! 😄',
      },
      // bristles sway like hair in a breeze
      idle: (svg) => {
        const bristles = svg.querySelectorAll('.br-bristle');
        gsap.set(bristles, { svgOrigin: '80 44' });
        gsap.to(bristles, { rotation: 7, duration: 1, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: 0.1, from: 'center' } });
      },
      // excited: bristles stand on end
      flourish: () =>
        gsap.to(svg.querySelectorAll('.br-bristle line, .br-bristle circle'), {
          scaleY: 1.35,
          svgOrigin: '80 44',
          duration: 0.14,
          yoyo: true,
          repeat: 3,
          ease: 'power2.out',
          stagger: 0.02,
        }),
    },
  };

  // parts of the active look, filled in by useRig()
  let rig = null;
  let svg = null;
  const parts = {};

  function useRig(name) {
    rig = RIGS[name];
    svg = el.querySelector(`.comby-svg[data-guide="${name}"]`);
    el.querySelectorAll('.comby-svg').forEach((s) => s.classList.toggle('is-active', s === svg));
    const q = (sel) => svg.querySelector(sel);
    Object.assign(parts, {
      armL: q('.cb-arm-l'),
      armR: q('.cb-arm-r'),
      legL: q('.cb-leg-l'),
      legR: q('.cb-leg-r'),
      body: q('.cb-body'),
      mouth: q('.cb-mouth'),
      sparkle: q('.cb-sparkle'),
      eyes: svg.querySelectorAll('.cb-eye'),
      pupils: svg.querySelectorAll('.cb-pupil'),
    });
    hit.setAttribute('aria-label', `${rig.label}, your guide. Click to say hi.`);
    guideButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.guideOption === name)));
    gsap.set(svg, { scaleX: facing });
  }

  // one-time setup for every rig: joints (GSAP ignores CSS transform-origin on SVG) and idle life
  Object.entries(RIGS).forEach(([name, r]) => {
    const s = el.querySelector(`.comby-svg[data-guide="${name}"]`);
    const j = r.joints;
    gsap.set(s.querySelector('.cb-arm-l'), { svgOrigin: j.armL });
    gsap.set(s.querySelector('.cb-arm-r'), { svgOrigin: j.armR });
    gsap.set(s.querySelector('.cb-leg-l'), { svgOrigin: j.legL });
    gsap.set(s.querySelector('.cb-leg-r'), { svgOrigin: j.legR });
    gsap.set(s.querySelector('.cb-body'), { svgOrigin: '80 190' });
    const [eyeL, eyeR] = s.querySelectorAll('.cb-eye');
    gsap.set(eyeL, { svgOrigin: j.eyeL });
    gsap.set(eyeR, { svgOrigin: j.eyeR });
    if (!prefersReducedMotion) {
      gsap.to(s.querySelector('.cb-body'), { y: -3, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      r.idle(s);
    }
  });

  const setMouth = (shape) => gsap.to(parts.mouth, { attr: { d: rig.mouth[shape] }, duration: 0.25, ease: 'power2.out' });
  const starEyes = (on) => {
    if (on) sfx.sparkle();
    gsap.to(parts.sparkle, { opacity: on ? 1 : 0, duration: 0.2 });
    gsap.to(parts.pupils, { opacity: on ? 0 : 1, duration: 0.2 });
  };

  // arm angles: right arm points up at about -110, left arm up at about +110
  const POSES = {
    hero: () =>
      gsap
        .timeline()
        .to(parts.armR, { rotation: -125, duration: 0.3, ease: 'back.out(2)' })
        .add(rig.flourish(), '<')
        .to(parts.armR, { rotation: -95, duration: 0.2, yoyo: true, repeat: 5, ease: 'sine.inOut' })
        .to(parts.armR, { rotation: 0, duration: 0.4, ease: 'power2.inOut' }),
    why: () => {
      look = { x: 1.5, y: -3.5 };
      setMouth('think');
      return gsap.timeline().to(parts.armL, { rotation: rig.thinkArm, duration: 0.45, ease: 'back.out(1.6)' });
    },
    product: () =>
      gsap
        .timeline()
        .to(parts.armR, { rotation: -60, duration: 0.35, ease: 'back.out(2)' })
        .to(parts.armR, { rotation: -48, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut' }),
    features: () => gsap.timeline(),
    ai: () => {
      setMouth('ooh');
      starEyes(true);
      return gsap
        .timeline()
        .to(parts.armL, { rotation: 140, duration: 0.35, ease: 'back.out(2)' })
        .to(parts.armR, { rotation: -140, duration: 0.35, ease: 'back.out(2)' }, '<')
        .add(() => setMouth('grin'), '+=0.6');
    },
    workflow: () => gsap.timeline().to(parts.armR, { rotation: -70, duration: 0.35, ease: 'back.out(2)' }),
    cta: () => {
      setMouth('grin');
      starEyes(true);
      return gsap
        .timeline()
        .to(parts.armL, { rotation: 135, duration: 0.3, ease: 'back.out(2)' })
        .to(parts.armR, { rotation: -135, duration: 0.3, ease: 'back.out(2)' }, '<')
        .to(hop, { y: -34, scaleY: 1.06, scaleX: 0.95, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 5 }, '<')
        .add(rig.flourish(), '<');
    },
  };

  const api = {
    arrived: false,
    get scene() {
      return scene; // the section Comby is at or travelling to
    },
  };
  let entered = false;
  let scene = null;
  let facing = 1;
  let look = null; // forced gaze (e.g. thinking); otherwise eyes follow the pointer
  let poseTl = null;
  let walkTl = null;
  let moveTween = null;
  let bubbleTimer = null;
  let walkStopTimer = null;
  let featureProgress = 0;
  let hinted = false;
  let lastLine = '';
  let lineBlocked = false;
  let current = 'comby';
  try {
    const saved = localStorage.getItem('comb-guide');
    if (RIGS[saved]) current = saved;
  } catch (e) {}
  useRig(current);

  const isMobile = () => window.innerWidth < 900;

  // where the guide's feet go in each section, in viewport px (sections that stay pinned
  // or fixed while scrolling are measured from the page so the guide lines up with them)
  function anchor(name) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (isMobile()) {
      const corner = { fx: vw - 50, fy: vh - 12, face: -1 };
      return name === 'ai' ? { ...corner, fy: vh + 34 } : corner;
    }
    switch (name) {
      case 'hero':
        return { fx: vw * 0.83, fy: vh * 0.62, face: -1, scale: 1.3 }; // the open space above the buttons
      case 'why':
        return { fx: vw * 0.13, fy: vh * 0.92, face: 1 };
      case 'product': {
        const w = document.querySelector('.window-shell')?.offsetWidth || 680;
        return { fx: Math.max(90, vw / 2 - w / 2 - 110), fy: vh * 0.8, face: 1 };
      }
      case 'features': {
        const bar = document.querySelector('.features-progress .progress-bar')?.getBoundingClientRect();
        if (!bar || !bar.width) return { fx: vw * 0.85, fy: vh * 0.92, face: -1 };
        return { fx: bar.left + 50 + featureProgress * (bar.width - 100), fy: bar.top - 4, face: 1 };
      }
      case 'ai':
        return { fx: vw - 120, fy: vh + 78, face: -1 }; // peeking up from the bottom edge
      case 'workflow': {
        const line = document.querySelector('.flow-line')?.getBoundingClientRect();
        const fx = line ? line.left - 120 : vw * 0.15;
        return { fx: Math.max(80, fx), fy: vh * 0.6 + 82, face: 1 };
      }
      case 'cta':
        return { fx: Math.min(vw - 90, vw / 2 + 240), fy: vh * 0.88, face: -1, bubble: 'right' };
      default:
        return { fx: vw * 0.85, fy: vh * 0.9, face: -1 };
    }
  }

  const target = (a) => ({ x: a.fx - el.offsetWidth / 2, y: a.fy - el.offsetHeight, scale: a.scale || 1 });

  function setFacing(dir) {
    if (!dir || dir === facing) return;
    facing = dir;
    gsap.to(svg, { scaleX: dir, duration: 0.25, ease: 'power2.out' });
  }

  function startWalk() {
    if (walkTl || prefersReducedMotion) return;
    const a = rig.stride;
    walkTl = gsap
      .timeline({ repeat: -1 })
      .to(hop, { y: -20, scaleY: 1.05, scaleX: 0.96, duration: 0.16, ease: 'power2.out' })
      .to(parts.legL, { rotation: a, duration: 0.16, ease: 'sine.inOut' }, '<')
      .to(parts.legR, { rotation: -a, duration: 0.16, ease: 'sine.inOut' }, '<')
      .to(hop, { y: 0, scaleY: 0.93, scaleX: 1.06, duration: 0.16, ease: 'power2.in' })
      .to(parts.legL, { rotation: -a, duration: 0.16, ease: 'sine.inOut' }, '<')
      .to(parts.legR, { rotation: a, duration: 0.16, ease: 'sine.inOut' }, '<')
      .call(() => sfx.step()); // footstep on every landing
  }

  function stopWalk() {
    if (!walkTl) return;
    walkTl.kill();
    walkTl = null;
    gsap.to(hop, { y: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: 'back.out(3)' });
    gsap.to([parts.legL, parts.legR], { rotation: 0, duration: 0.25 });
  }

  function resetPose() {
    poseTl?.kill();
    poseTl = null;
    look = null;
    gsap.killTweensOf([parts.armL, parts.armR]);
    gsap.to([parts.armL, parts.armR, parts.legL, parts.legR], { rotation: 0, duration: 0.3, ease: 'power2.out' });
    starEyes(false);
    setMouth('smile');
  }

  function say(text, ms = 4200) {
    clearTimeout(bubbleTimer);
    lastLine = text;
    bubble.textContent = text;
    const speaking = sfx.speak(text, rig.voice, () => {
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(hideBubble, 1200);
    });
    lineBlocked = speaking === 'blocked';
    if (lineBlocked) {
      const note = document.createElement('small');
      note.className = 'comby-note';
      note.textContent = 'Tap anywhere to hear me 🔊';
      bubble.appendChild(note);
    }
    gsap.fromTo(
      bubble,
      { opacity: 0, scale: 0.6, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: prefersReducedMotion ? 0 : 0.45, ease: 'back.out(2)', overwrite: true }
    );
    // while speaking, the bubble stays until the line ends (with a safety cap)
    bubbleTimer = setTimeout(hideBubble, speaking === true ? 15000 : speaking === 'blocked' ? ms + 2500 : ms);
  }

  function hideBubble() {
    clearTimeout(bubbleTimer);
    sfx.stopSpeaking();
    gsap.to(bubble, { opacity: 0, scale: 0.85, duration: 0.2, overwrite: true });
  }

  function arrive(name, a, line = rig.lines[name]) {
    api.arrived = true;
    setFacing(a.face);
    el.classList.toggle('bubble-left', a.bubble ? a.bubble === 'left' : a.fx > window.innerWidth * 0.55);
    poseTl = POSES[name]?.() || null;
    say(line);
    if (name === 'hero' && !hinted) {
      hinted = true;
      sfx.hint();
    }
  }

  function enter(name) {
    entered = true;
    scene = name;
    const a = anchor(name);
    const t = target(a);
    setFacing(a.face);
    gsap.set(el, { x: t.x, y: t.y, scale: t.scale, opacity: 1 });
    if (prefersReducedMotion) return arrive(name, a);
    // drop in from above with a squashy landing
    gsap
      .timeline({ onComplete: () => arrive(name, a) })
      .from(el, { y: t.y - window.innerHeight * 0.6, duration: 0.7, ease: 'power3.in' })
      .call(() => sfx.land())
      .to(hop, { scaleY: 0.82, scaleX: 1.14, duration: 0.12, ease: 'power2.out' })
      .to(hop, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
  }

  api.goTo = (name) => {
    if (!entered) return enter(name);
    scene = name;
    api.arrived = false;
    hideBubble();
    resetPose();
    moveTween?.kill();

    const a = anchor(name);
    const t = target(a);
    if (prefersReducedMotion) {
      gsap.set(el, t);
      return arrive(name, a);
    }

    const dx = t.x - gsap.getProperty(el, 'x');
    const dy = t.y - gsap.getProperty(el, 'y');
    if (Math.abs(dx) > 20) setFacing(Math.sign(dx));
    startWalk();
    moveTween = gsap.to(el, {
      ...t,
      duration: gsap.utils.clamp(0.7, 1.8, Math.hypot(dx, dy) / 650),
      ease: 'power2.inOut',
      onComplete: () => {
        stopWalk();
        arrive(name, a);
      },
    });
  };

  // features: walk along the progress bar as the cards scroll sideways
  api.follow = (progress) => {
    featureProgress = progress;
    if (scene !== 'features' || !api.arrived || isMobile()) return;
    const t = target(anchor('features'));
    const dx = t.x - gsap.getProperty(el, 'x');
    if (Math.abs(dx) < 1) return;
    setFacing(Math.sign(dx));
    startWalk();
    gsap.to(el, { x: t.x, y: t.y, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    clearTimeout(walkStopTimer);
    walkStopTimer = setTimeout(stopWalk, 200);
  };

  // swap characters: the current one spins away, the new one pops in on the same spot
  api.setCharacter = (name) => {
    if (!RIGS[name] || name === current) return;
    current = name;
    try {
      localStorage.setItem('comb-guide', name);
    } catch (e) {}
    if (!entered || prefersReducedMotion) {
      useRig(name);
      if (entered) say(rig.lines.hello, 2400);
      return;
    }
    hideBubble();
    stopWalk();
    resetPose();
    api.arrived = false;
    gsap
      .timeline()
      .call(() => sfx.whoosh())
      .to(hop, { scale: 0, rotation: 200, duration: 0.3, ease: 'back.in(1.6)' })
      .add(() => useRig(name))
      .set(hop, { rotation: -160 })
      .call(() => sfx.pop())
      .to(hop, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.8)' })
      .add(() => arrive(scene, anchor(scene), rig.lines.hello));
  };

  guideButtons.forEach((b) => b.addEventListener('click', () => api.setCharacter(b.dataset.guideOption)));

  sfx.onUnlock(() => {
    if (sfx.on && lineBlocked && lastLine) say(lastLine);
  });

  document.querySelector('.sound-toggle').addEventListener('click', () => {
    sfx.setOn(!sfx.on);
    if (sfx.on && entered) say('Yay, now you can hear me! 🎶', 2600);
    else if (!sfx.on) {
      // muted mid-line: the bubble no longer waits for the voice
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(hideBubble, 1500);
    }
  });

  // click: a happy jump
  hit.addEventListener('click', () => {
    if (!api.arrived) return;
    say(rig.lines.click, 2200);
    sfx.giggle();
    if (prefersReducedMotion) return;
    sfx.hop();
    gsap
      .timeline()
      .to(hop, { y: -60, scaleY: 1.08, scaleX: 0.93, duration: 0.28, ease: 'power2.out' })
      .to(parts.armL, { rotation: 130, duration: 0.2 }, '<')
      .to(parts.armR, { rotation: -130, duration: 0.2 }, '<')
      .add(rig.flourish(), '<')
      .to(hop, { y: 0, scaleY: 0.86, scaleX: 1.1, duration: 0.24, ease: 'power2.in' })
      .to(hop, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1.2, 0.4)' })
      .to([parts.armL, parts.armR], { rotation: 0, duration: 0.35 }, '<');
  });

  window.addEventListener('resize', () => {
    if (!entered || !api.arrived) return;
    gsap.set(el, target(anchor(scene)));
  });

  if (!prefersReducedMotion) {
    // blink the active character's eyes every few seconds
    const blink = () => {
      gsap.to(parts.eyes, { scaleY: 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.inOut' });
      gsap.delayedCall(2.5 + Math.random() * 3, blink);
    };
    gsap.delayedCall(2, blink);

    // eyes follow the pointer; lean a little with scroll speed
    const lean = gsap.quickTo(el, 'rotation', { duration: 0.5, ease: 'power3' });
    const gaze = { x: 0, y: 0 };
    gsap.ticker.add(() => {
      if (!entered) return;
      let gx = 0;
      let gy = 0;
      if (look) {
        gx = look.x;
        gy = look.y;
      } else if (pointer.x || pointer.y) {
        const r = svg.getBoundingClientRect();
        const dx = pointer.x - (r.left + r.width / 2);
        const dy = pointer.y - (r.top + r.height * rig.eyeY);
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.min(rig.look, d / 40);
        gx = (dx / d) * m * facing; // the SVG is mirrored when facing left
        gy = (dy / d) * m;
      }
      gaze.x += (gx - gaze.x) * 0.2;
      gaze.y += (gy - gaze.y) * 0.2;
      gsap.set(parts.pupils, { x: gaze.x, y: gaze.y });
      lean(gsap.utils.clamp(-8, 8, (lenis?.velocity || 0) * -0.35));
    });
  }

  return api;
})();

/* ------------------------------------------------------------------ */
/* Theme switcher                                                      */
/* ------------------------------------------------------------------ */
const swatches = document.querySelectorAll('[data-theme-option]');

function setTheme(name) {
  themeName = name;
  document.documentElement.dataset.theme = name;
  swatches.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeOption === name)));
  scene3d.applyTheme?.();
  try {
    localStorage.setItem('comb-theme', name);
  } catch (e) {}
}

setTheme(themeName);

swatches.forEach((button) => {
  button.addEventListener('click', (e) => {
    const name = button.dataset.themeOption;
    if (name === themeName) return;
    if (!document.startViewTransition || prefersReducedMotion) {
      setTheme(name);
      return;
    }
    // new theme grows out of the clicked swatch as a circle
    const x = e.clientX || window.innerWidth / 2;
    const y = e.clientY || 0;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => setTheme(name));
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/* Cursor + magnetic + hover glow                                      */
/* ------------------------------------------------------------------ */
if (isFinePointer && !prefersReducedMotion) {
  document.body.classList.add('has-cursor');
  const cursor = document.querySelector('.cursor');
  const dot = cursor.querySelector('.cursor-dot');
  const ring = cursor.querySelector('.cursor-ring');
  const label = cursor.querySelector('.cursor-label');
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.1 });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.1 });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    cursor.classList.add('is-visible');
    dotX(e.clientX);
    dotY(e.clientY);
    ringX(e.clientX);
    ringY(e.clientY);
  });

  document.querySelectorAll('a, button, [data-tilt]').forEach((el) => {
    el.addEventListener('pointerenter', () => {
      cursor.classList.add('is-hover');
      if (el.dataset.cursor) {
        label.textContent = el.dataset.cursor;
        cursor.classList.add('has-label');
      }
    });
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover', 'has-label'));
  });

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = el.classList.contains('cta-orb') ? 0.45 : 0.3;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });

  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      rx((0.5 - py) * 14);
      ry((px - 0.5) * 14);
    });
    card.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });

  document.querySelectorAll('[data-glow]').forEach((card) => {
    const inner = card.querySelector('.ai-card-inner');
    card.addEventListener('pointermove', (e) => {
      const r = inner.getBoundingClientRect();
      inner.style.setProperty('--mx', `${e.clientX - r.left}px`);
      inner.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Scroll choreography                                                 */
/* ------------------------------------------------------------------ */
function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.site-header', { yPercent: -100, opacity: 0, duration: 1.2, clearProps: 'transform,opacity' }, 0)
    .from('.hero-eyebrow', { y: 30, opacity: 0, duration: 1.2 }, 0.1)
    .from('.hero-title .split-word', { yPercent: 140, rotate: 4, duration: 1.4, stagger: 0.06 }, 0.15)
    .from('.hero-lead', { y: 30, opacity: 0, duration: 1.2 }, 0.6)
    .from('.hero-actions .button', { y: 30, opacity: 0, duration: 1.2, stagger: 0.08 }, 0.7)
    .from('.mini-stats li', { y: 30, opacity: 0, duration: 1.2, stagger: 0.08 }, 0.8)
    .from('.scroll-hint', { opacity: 0, duration: 1 }, 1.1);
  return tl;
}

function setupScrollAnimations() {
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // hero parallax out
    gsap.to('.hero-layout', {
      yPercent: -18,
      opacity: 0.2,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    // generic split-heading reveals (excluding hero, done in intro)
    document.querySelectorAll('[data-split]:not(.hero-title)').forEach((el) => {
      gsap.from(el.querySelectorAll('.split-word'), {
        yPercent: 140,
        rotate: 3,
        duration: 1.3,
        ease: 'expo.out',
        stagger: 0.04,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    gsap.utils.toArray('.eyebrow:not(.hero-eyebrow)').forEach((el) => {
      gsap.from(el, { y: 20, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });

    // marquee: constant drift + scroll velocity skew/boost
    const track = document.querySelector('.marquee-track');
    const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
    const skewTo = gsap.quickTo(track, 'skewX', { duration: 0.5, ease: 'power3' });
    const marqueeTick = () => {
      const v = lenis ? lenis.velocity : 0;
      skewTo(gsap.utils.clamp(-10, 10, -v * 0.25));
      loop.timeScale(1 + Math.min(Math.abs(v) * 0.15, 6));
    };
    gsap.ticker.add(marqueeTick);

    // why: words light up as you scroll
    document.querySelectorAll('[data-scrub-words]').forEach((p) => {
      gsap.to(p.querySelectorAll('.scrub-word'), {
        opacity: 1,
        stagger: 0.1,
        ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 45%', scrub: true },
      });
    });

    // scissors snip along each dashed divider
    document.querySelectorAll('[data-cut]').forEach((line) => {
      setCut(line, 0);
      const proxy = { p: 0 };
      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        scrollTrigger: { trigger: line, start: 'top 90%', end: 'top 30%', scrub: 0.5 },
        onUpdate: () => setCut(line, proxy.p),
      });
    });

    // product: pinned 3D dashboard that assembles itself
    const revenueEl = document.querySelector('[data-revenue]');
    const bookingsEl = document.querySelector('[data-bookings]');
    const counter = { revenue: 0, bookings: 0 };
    const productTl = gsap.timeline({
      scrollTrigger: { trigger: '.product', start: 'top top', end: '+=140%', scrub: 1, pin: '.product-pin', refreshPriority: 2 },
    });
    productTl
      .fromTo('.window-shell', { rotationX: 55, rotationZ: -8, scale: 0.7, y: 120, opacity: 0.3 }, { rotationX: 0, rotationZ: 0, scale: 1, y: 0, opacity: 1, duration: 1, ease: 'power2.out' })
      .from('.chart-bars span', { scaleY: 0, stagger: 0.08, duration: 0.5, ease: 'back.out(1.6)' }, 0.5)
      .to(counter, {
        revenue: 42800,
        bookings: 64,
        duration: 0.8,
        ease: 'power1.out',
        onUpdate: () => {
          revenueEl.textContent = Math.round(counter.revenue).toLocaleString('en-IN');
          bookingsEl.textContent = Math.round(counter.bookings);
        },
      }, 0.5)
      .from('.mini-stat-box', { y: 30, opacity: 0, stagger: 0.1, duration: 0.4 }, 0.8)
      .from('.chip-a', { x: -80, opacity: 0, duration: 0.5 }, 1)
      .from('.chip-b', { x: 80, opacity: 0, duration: 0.5 }, 1.1)
      .to('.window-shell', { rotationY: -8, rotationX: 6, duration: 0.6 }, 1.5)
      .to('.chip-a', { y: -30, duration: 0.6 }, 1.5)
      .to('.chip-b', { y: 30, duration: 0.6 }, 1.5);

    // workflow: drawn line + active steps
    gsap.to('.flow-line span', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.flow-list', start: 'top 60%', end: 'bottom 60%', scrub: true },
    });
    gsap.utils.toArray('.flow-step').forEach((step) => {
      gsap.from(step.querySelector('div:last-child'), {
        x: 60,
        opacity: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: step, start: 'top 75%' },
      });
      ScrollTrigger.create({
        trigger: step,
        start: 'top 60%',
        end: 'bottom 60%',
        onToggle: (self) => self.isActive && step.classList.add('is-active'),
        onLeaveBack: () => step.classList.remove('is-active'),
      });
    });

    // CTA orb
    gsap.from('.cta-orb', {
      scale: 0,
      rotate: -90,
      duration: 1.6,
      ease: 'elastic.out(1, 0.6)',
      scrollTrigger: { trigger: '.cta-orb', start: 'top 90%' },
    });

    // giant footer word
    gsap.from('.footer-giant', {
      yPercent: 40,
      ease: 'none',
      scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
    });

    return () => gsap.ticker.remove(marqueeTick);
  });

  // reduced motion: show the finished states
  mm.add('(prefers-reduced-motion: reduce)', () => {
    document.querySelectorAll('[data-cut]').forEach((line) => setCut(line, 1));
  });

  // desktop-only pinned sequences
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const track = document.querySelector('.features-track');
    const distance = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.features',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: '.features-pin',
        scrub: 1,
        refreshPriority: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          gsap.set('.progress-bar span', { scaleX: self.progress });
          comby.follow(self.progress);
        },
      },
    });

    gsap.from('.feature-card', {
      y: 120,
      opacity: 0,
      rotate: 4,
      stagger: 0.08,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.features', start: 'top 60%' },
    });

    // AI cards: first card recedes as the second slides over it
    const [first, second] = gsap.utils.toArray('.ai-card');
    gsap.to(first, {
      scale: 0.92,
      opacity: 0.5,
      filter: 'blur(2px)',
      ease: 'none',
      scrollTrigger: { trigger: second, start: 'top bottom', end: 'top 18%', scrub: true },
    });
  });

  mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray('.feature-card, .ai-card').forEach((card) => {
      gsap.from(card, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 88%' } });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Loaders → intro                                                     */
/* ------------------------------------------------------------------ */
const TAU = Math.PI * 2;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Scissors cut the sheet in two, then the halves fall away.
function buildCutLoader(el) {
  const top = el.querySelector('.pl-top');
  const bottom = el.querySelector('.pl-bottom');
  const slit = el.querySelector('.pl-slit');
  const scissors = el.querySelector('.pl-scissors');
  scissors.innerHTML = scissorsSVG;
  const bladeA = scissors.querySelector('.blade-a');
  const bladeB = scissors.querySelector('.blade-b');

  const SNIPS = 11;
  const state = { p: 0 };

  // Scissors pause while the blades open, then push forward as they close,
  // so the cut advances in steps like real cutting.
  const drawCut = () => {
    const vw = window.innerWidth;
    const w = scissors.offsetWidth;
    const p = state.p;
    const stepped = p - Math.sin(TAU * SNIPS * p) / (TAU * SNIPS);
    const travel = vw + w * 1.2; // run fully off-screen at the end
    const x = stepped * travel; // position of the cut front, in px
    const cutX = Math.min(x, vw);

    const angle = ((1 + Math.cos(TAU * SNIPS * p)) / 2) * 26;
    bladeA.style.transform = `rotate(${-angle}deg)`;
    bladeB.style.transform = `rotate(${angle}deg)`;
    // the pivot sits at 30/64 of the icon width; the cut front is just ahead of it
    scissors.style.transform = `translate(${x - w * 0.56}px, -50%)`;

    // the cut paper opens into a thin wedge behind the scissors
    const gap = Math.min(10, cutX * 0.012);
    top.style.clipPath = `polygon(0 0, 100% 0, 100% 50%, ${cutX}px 50%, 0 calc(50% - ${gap}px))`;
    bottom.style.clipPath = `polygon(0 calc(50% + ${gap}px), ${cutX}px 50%, 100% 50%, 100% 100%, 0 100%)`;
    slit.style.width = `${cutX}px`;
  };
  drawCut();

  return gsap
    .timeline({ paused: true })
    .to(state, { p: 1, duration: 2.6, ease: 'power1.inOut', onUpdate: drawCut })
    .to(slit, { opacity: 0, duration: 0.3 }, '-=0.15')
    .to(top, { yPercent: -62, rotation: -4, transformOrigin: '0% 50%', duration: 1.2, ease: 'expo.inOut' }, '-=0.1')
    .to(bottom, { yPercent: 62, rotation: 3, transformOrigin: '0% 50%', duration: 1.2, ease: 'expo.inOut' }, '<');
}

function runLoader() {
  document.querySelector('.preloader-cover')?.remove();

  const setupPage = () => {
    document.body.classList.remove('is-loading');
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.start();
    setupScrollAnimations();
    setupSceneTriggers();
    ScrollTrigger.refresh();
    goToScene('hero');
  };

  if (prefersReducedMotion) {
    setupPage();
    return;
  }

  const el = document.getElementById('loader-cut').content.firstElementChild.cloneNode(true);
  document.body.appendChild(el);
  document.body.classList.add('is-loading');
  lenis?.stop();

  // Long frames while the 3D scene compiles would otherwise make the timeline
  // jump ahead and skip most of the animation, so treat any big gap as one frame.
  gsap.ticker.lagSmoothing(500, 33);

  const tl = buildCutLoader(el);
  tl.add(() => {
    el.remove();
    gsap.ticker.lagSmoothing(0); // back to Lenis' preferred setting
    setupPage();
  }).add(heroIntro(), '-=0.75');

  // start once the first (heaviest) WebGL frame has been drawn
  requestAnimationFrame(() => requestAnimationFrame(() => tl.play()));
}

// Fonts affect layout of split text/pins, so wait for them before measuring.
(document.fonts?.ready ?? Promise.resolve()).then(runLoader);
