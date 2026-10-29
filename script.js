import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
/* Comb-through: tangled strands combed straight on scroll             */
/* ------------------------------------------------------------------ */
const combThrough = document.querySelector('.comb-through');
let drawStrands = () => {};

if (combThrough) {
  const group = combThrough.querySelector('.strand-group');
  const combEl = combThrough.querySelector('.comb-2d');

  // comb: vertical spine with teeth pointing right, into the strands
  const teeth = Array.from({ length: 27 }, (_, i) => {
    const y = 14 + i * 10.6;
    return `<rect x="16" y="${y}" width="48" height="4.4" rx="2.2" />`;
  }).join('');
  combEl.innerHTML = `
    <svg viewBox="0 0 70 300" aria-hidden="true">
      <defs>
        <linearGradient id="combGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color: var(--primary-2)" />
          <stop offset="1" style="stop-color: var(--accent)" />
        </linearGradient>
      </defs>
      <g fill="url(#combGrad)">
        <rect x="0" y="0" width="22" height="300" rx="9" />
        ${teeth}
      </g>
    </svg>`;

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const strands = Array.from({ length: 22 }, (_, i) => ({
    base: 18 + i * (224 / 21),
    a: 14 + rand() * 22,
    b: 6 + rand() * 12,
    f1: 0.006 + rand() * 0.01,
    f2: 0.02 + rand() * 0.02,
    p1: rand() * 6.28,
    p2: rand() * 6.28,
    p3: rand() * 6.28,
    width: 1 + rand() * 1.4,
    opacity: 0.35 + rand() * 0.55,
  }));

  const paths = strands.map((s) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-width', s.width.toFixed(2));
    path.setAttribute('opacity', s.opacity.toFixed(2));
    group.appendChild(path);
    return path;
  });

  const smooth = (e0, e1, x) => {
    const t = gsap.utils.clamp(0, 1, (x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };

  drawStrands = (progress) => {
    const combX = -80 + progress * 1380; // in svg units (0–1200 wide)
    strands.forEach((s, i) => {
      let d = '';
      for (let x = 0; x <= 1200; x += 12) {
        const tangle = smooth(combX - 10, combX + 160, x);
        const calm = Math.sin(x * 0.004 + i * 0.4) * 3;
        const chaos =
          Math.sin(x * s.f1 + s.p1) * s.a + Math.sin(x * s.f2 + s.p2) * s.b + Math.sin(x * 0.14 + s.p3) * 3;
        const y = s.base + calm + tangle * chaos;
        d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
      }
      paths[i].setAttribute('d', d);
    });
    const px = (combX / 1200) * combThrough.clientWidth;
    combEl.style.transform = `translateX(${px}px) rotate(${Math.sin(progress * 18) * 3}deg)`;
  };

  drawStrands(prefersReducedMotion ? 1 : 0);
}

/* ------------------------------------------------------------------ */
/* Themes: CSS handles the page, this table drives the 3D scene        */
/* ------------------------------------------------------------------ */
// palettes: [comb colour, scissor-handle colour] per section
const THEMES = {
  rose: {
    bg: '#120b0d',
    primary: '#e58fa0',
    accent: '#f2c98a',
    blade: '#efc3ad',
    stars: '#f6dcd2',
    light: false,
    palettes: {
      hero: ['#e58fa0', '#f2c98a'],
      why: ['#f4b8c2', '#e8b37a'],
      product: ['#d8738a', '#f6dcb4'],
      features: ['#f2c98a', '#e58fa0'],
      ai: ['#c9607a', '#f2c98a'],
      workflow: ['#e58fa0', '#f6dcb4'],
      cta: ['#e58fa0', '#f2c98a'],
    },
  },
  sage: {
    bg: '#0b1210',
    primary: '#8fcfa8',
    accent: '#f0a27a',
    blade: '#e6ece6',
    stars: '#dcefe2',
    light: false,
    palettes: {
      hero: ['#8fcfa8', '#f0a27a'],
      why: ['#b9e3c6', '#e8b48f'],
      product: ['#6fbf9a', '#f6d2b8'],
      features: ['#f0a27a', '#8fcfa8'],
      ai: ['#5fae8a', '#f0a27a'],
      workflow: ['#8fcfa8', '#f6d2b8'],
      cta: ['#8fcfa8', '#f0a27a'],
    },
  },
  blush: {
    bg: '#faf3ee',
    primary: '#d6587e',
    accent: '#b8864b',
    blade: '#e2b19b',
    stars: '#d6587e',
    light: true,
    palettes: {
      hero: ['#d6587e', '#c9a46a'],
      why: ['#e88aa6', '#c9a46a'],
      product: ['#c0446a', '#e0c08f'],
      features: ['#c9a46a', '#d6587e'],
      ai: ['#b23a60', '#c9a46a'],
      workflow: ['#d6587e', '#e0c08f'],
      cta: ['#d6587e', '#c9a46a'],
    },
  },
  candy: {
    bg: '#fff8fc',
    primary: '#ff2e88',
    accent: '#00a9b8',
    blade: '#d9dee6',
    stars: '#ff2e88',
    light: true,
    palettes: {
      hero: ['#ff2e88', '#00c2d1'],
      why: ['#ff7ab5', '#ffb100'],
      product: ['#e0156f', '#00c2d1'],
      features: ['#00c2d1', '#ff2e88'],
      ai: ['#9b3cff', '#ffb100'],
      workflow: ['#ff2e88', '#ffb100'],
      cta: ['#ff2e88', '#00c2d1'],
    },
  },
  noir: {
    bg: '#0a0a0b',
    primary: '#d4a94f',
    accent: '#e9e4da',
    blade: '#d8dbe0',
    stars: '#f0dcae',
    light: false,
    palettes: {
      hero: ['#d4a94f', '#e9e4da'],
      why: ['#e8c987', '#b8b2a6'],
      product: ['#b88a35', '#e9e4da'],
      features: ['#e9e4da', '#d4a94f'],
      ai: ['#c9973a', '#f4efe6'],
      workflow: ['#d4a94f', '#cfc8bb'],
      cta: ['#d4a94f', '#e9e4da'],
    },
  },
  midnight: {
    bg: '#050b18',
    primary: '#8a72ff',
    accent: '#79f0d5',
    blade: '#e8eef7',
    stars: '#bfccff',
    light: false,
    palettes: {
      hero: ['#8a72ff', '#79f0d5'],
      why: ['#3d8bff', '#b39cff'],
      product: ['#6f8bff', '#9ae8ff'],
      features: ['#2fcfb0', '#b39cff'],
      ai: ['#b06cff', '#79f0d5'],
      workflow: ['#6f8bff', '#79f0d5'],
      cta: ['#8a72ff', '#79f0d5'],
    },
  },
};

let themeName = THEMES[document.documentElement.dataset.theme] ? document.documentElement.dataset.theme : 'rose';
const theme = () => THEMES[themeName];
let currentScene = 'hero';

/* ------------------------------------------------------------------ */
/* WebGL: 3D comb + snipping scissors + hair clippings                 */
/* ------------------------------------------------------------------ */
function createCombGeometry() {
  const W = 4.2;
  const spineH = 0.55;
  const toothL = 1.15;
  const s = new THREE.Shape();

  s.moveTo(-W / 2, 0);
  s.lineTo(-W / 2, spineH * 0.5);
  s.quadraticCurveTo(-W / 2, spineH, -W / 2 + 0.3, spineH);
  s.lineTo(W / 2 - 0.3, spineH);
  s.quadraticCurveTo(W / 2, spineH, W / 2, spineH * 0.5);
  s.lineTo(W / 2, -toothL - 0.05);
  s.lineTo(W / 2 - 0.14, -toothL - 0.05);

  // teeth, right to left: fine half then wide half, like a real styling comb
  let x = W / 2 - 0.14;
  s.lineTo(x, 0);
  while (x > -W / 2 + 0.34) {
    const fine = x > 0;
    const gap = fine ? 0.07 : 0.11;
    const tw = fine ? 0.06 : 0.09;
    x -= gap;
    s.lineTo(x, 0);
    s.lineTo(x, -toothL + 0.04);
    s.quadraticCurveTo(x - tw / 2, -toothL - 0.02, x - tw, -toothL + 0.04);
    x -= tw;
    s.lineTo(x, 0);
  }
  s.lineTo(-W / 2 + 0.14, 0);
  s.lineTo(-W / 2 + 0.14, -toothL - 0.05);
  s.lineTo(-W / 2, -toothL - 0.05);
  s.lineTo(-W / 2, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.014,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.center();
  return geo;
}

function createScissors(bladeMat, handleMat) {
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.2, 0.14);
  bladeShape.quadraticCurveTo(1.6, 0.2, 3.0, 0.0);
  bladeShape.quadraticCurveTo(1.6, -0.02, -0.2, -0.1);
  bladeShape.quadraticCurveTo(-0.34, 0.02, -0.2, 0.14);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 16,
  });

  const shankLen = 0.95;
  const shankAngle = Math.atan2(-0.45, -0.9);
  const shankGeo = new THREE.CapsuleGeometry(0.075, shankLen, 6, 12);
  shankGeo.rotateZ(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.4, 0.09, 18, 56);

  const makeBlade = (zOffset) => {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.z = zOffset;
    const shank = new THREE.Mesh(shankGeo, handleMat);
    shank.rotation.z = shankAngle;
    shank.position.set(-0.45, -0.22, zOffset + 0.03);
    const ring = new THREE.Mesh(ringGeo, handleMat);
    ring.position.set(-1.22, -0.7, zOffset + 0.03);
    g.add(blade, shank, ring);
    return g;
  };

  const bladeA = makeBlade(0.04);
  const bladeB = makeBlade(-0.12);
  bladeB.scale.y = -1;

  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 24), bladeMat);
  screw.rotation.x = Math.PI / 2;

  const pivot = new THREE.Group();
  pivot.add(bladeA, bladeB, screw);
  pivot.position.x = -0.65; // centre the whole tool around its middle

  const root = new THREE.Group();
  root.add(pivot);
  return { root, bladeA, bladeB };
}

const scene3d = { state: null, ready: false };

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 9);

  // brand-tinted rim lights
  const rimA = new THREE.PointLight(theme().primary, 30, 20);
  rimA.position.set(-4, 3, 3);
  const rimB = new THREE.PointLight(theme().accent, 24, 20);
  rimB.position.set(4, -3, 3);
  scene.add(rimA, rimB, new THREE.AmbientLight(0xffffff, 0.15));

  const isMobile = window.innerWidth < 900;

  const combMat = new THREE.MeshPhysicalMaterial({
    color: theme().palettes.hero[0],
    roughness: 0.16,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 1,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [180, 700],
  });
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: theme().blade, metalness: 1, roughness: 0.14, clearcoat: 0.6 });
  const handleMat = new THREE.MeshPhysicalMaterial({
    color: theme().palettes.hero[1],
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    iridescence: 0.6,
  });

  const comb = new THREE.Mesh(createCombGeometry(), combMat);
  const combGroup = new THREE.Group();
  combGroup.add(comb);
  scene.add(combGroup);

  const scissors = createScissors(bladeMat, handleMat);
  scene.add(scissors.root);

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

  const state = { ...sceneTargets('hero'), spin: 0 };
  const snip = { angle: 0.42 };
  scene3d.state = state;
  scene3d.materials = { combMat, handleMat };
  scene3d.ready = true;

  // swap scene colours instantly (the page itself is revealed by the view transition)
  scene3d.applyTheme = () => {
    const t = theme();
    renderer.setClearColor(t.bg, 1);
    rimA.color.set(t.primary);
    rimB.color.set(t.accent);
    bladeMat.color.set(t.blade);
    uniforms.uStar.value.set(t.stars);
    uniforms.uClipA.value.set(t.primary);
    uniforms.uClipB.value.set(t.accent);
    // additive glow vanishes on a light background, so use normal blending there
    [stars.material, clippings.material].forEach((mat) => {
      mat.blending = t.light ? THREE.NormalBlending : THREE.AdditiveBlending;
      mat.needsUpdate = true;
    });
    const [combHex, handleHex] = t.palettes[currentScene];
    gsap.killTweensOf([combMat.color, handleMat.color]);
    combMat.color.set(combHex);
    handleMat.color.set(handleHex);
    render();
  };

  // idle double-snip, then pause
  const snipLoop = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
  snipLoop
    .to(snip, { angle: 0.02, duration: 0.16, ease: 'power3.in' })
    .to(snip, { angle: 0.42, duration: 0.28, ease: 'power2.out' })
    .to(snip, { angle: 0.02, duration: 0.16, ease: 'power3.in' })
    .to(snip, { angle: 0.42, duration: 0.4, ease: 'power2.out' });
  if (prefersReducedMotion) snipLoop.pause();

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

    const v = lenis ? lenis.velocity : 0;
    snipLoop.timeScale(1 + Math.min(Math.abs(v) * 0.08, 3));

    rot.x = lerp(rot.x, pointer.ny * 0.35, 0.04);
    rot.y = lerp(rot.y, pointer.nx * 0.5, 0.04);

    combGroup.position.x = lerp(combGroup.position.x, state.cx + pointer.nx * 0.12, 0.06);
    combGroup.position.y = lerp(combGroup.position.y, state.cy + pointer.ny * 0.12 + Math.sin(t * 0.8) * 0.08, 0.06);
    combGroup.scale.setScalar(lerp(combGroup.scale.x, state.cs, 0.06));
    combGroup.rotation.z = lerp(combGroup.rotation.z, state.crz, 0.06) + Math.sin(t * 0.6) * 0.002;
    comb.rotation.x = rot.x * 0.6 + Math.sin(t * 0.5) * 0.18;
    comb.rotation.y = rot.y * 0.8 + state.spin + v * 0.004;

    const s = scissors.root;
    s.position.x = lerp(s.position.x, state.sx - pointer.nx * 0.15, 0.06);
    s.position.y = lerp(s.position.y, state.sy - pointer.ny * 0.12 + Math.sin(t * 0.9 + 1) * 0.1, 0.06);
    s.scale.setScalar(lerp(s.scale.x, state.ss, 0.06));
    s.rotation.z = lerp(s.rotation.z, state.srz, 0.06);
    s.rotation.x = -rot.x * 0.5 + Math.sin(t * 0.7) * 0.12;
    s.rotation.y = rot.y * 0.6 + Math.sin(t * 0.4) * 0.2;
    scissors.bladeA.rotation.z = snip.angle;
    scissors.bladeB.rotation.z = -snip.angle;

    stars.rotation.y = t * 0.015 + rot.y * 0.15;
    clippings.rotation.y = rot.y * 0.1;

    camera.position.x = lerp(camera.position.x, pointer.nx * 0.3, 0.03);
    camera.position.y = lerp(camera.position.y, pointer.ny * 0.2, 0.03);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  if (prefersReducedMotion) {
    // snap to targets and draw once
    combGroup.position.set(state.cx, state.cy, 0);
    combGroup.scale.setScalar(state.cs);
    combGroup.rotation.z = state.crz;
    scissors.root.position.set(state.sx, state.sy, 0);
    scissors.root.scale.setScalar(state.ss);
    scissors.root.rotation.z = state.srz;
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

/* ------------------------------------------------------------------ */
/* Scene states per section (tools move + recolour as you scroll)      */
/* ------------------------------------------------------------------ */

// c* = comb, s* = scissors: position, scale, z-rotation
function sceneTargets(name) {
  const m = window.innerWidth < 900;
  const map = m
    ? {
        hero: { cx: 1.05, cy: 2.5, cs: 0.34, crz: -0.35, sx: 0.85, sy: 1.95, ss: 0.28, srz: 0.5 },
        why: { cx: 1.2, cy: 2.3, cs: 0.32, crz: 0.4, sx: -1.2, sy: -2.3, ss: 0.3, srz: -2.6 },
        product: { cx: -0.9, cy: 2.2, cs: 0.32, crz: 1.1, sx: 0.9, sy: -2.2, ss: 0.32, srz: 2.8 },
        features: { cx: 1.1, cy: 2.3, cs: 0.3, crz: -0.2, sx: -1.1, sy: -2.4, ss: 0.28, srz: 0.3 },
        ai: { cx: -1.1, cy: -2.3, cs: 0.32, crz: 0.6, sx: 1.1, sy: 2.3, ss: 0.3, srz: -2.4 },
        workflow: { cx: 1.1, cy: 2.2, cs: 0.32, crz: -1.3, sx: 1.0, sy: -2.3, ss: 0.3, srz: 0.9 },
        cta: { cx: -0.7, cy: -1.9, cs: 0.4, crz: 0.5, sx: 0.7, sy: 2.0, ss: 0.36, srz: -2.6 },
      }
    : {
        hero: { cx: 2.5, cy: 0.6, cs: 0.95, crz: -0.55, sx: 2.3, sy: -1.1, ss: 0.75, srz: 0.5 },
        why: { cx: -3.7, cy: 1.9, cs: 0.5, crz: 0.35, sx: 3.8, sy: -2.1, ss: 0.45, srz: -2.6 },
        product: { cx: -3.5, cy: 1.2, cs: 0.6, crz: 1.2, sx: 3.6, sy: -1.3, ss: 0.6, srz: 2.8 },
        features: { cx: 3.4, cy: 2.1, cs: 0.45, crz: -0.2, sx: 1.7, sy: 2.2, ss: 0.4, srz: 0.3 },
        ai: { cx: -3.9, cy: -2.2, cs: 0.55, crz: 0.6, sx: 3.9, sy: 2.3, ss: 0.5, srz: -2.4 },
        workflow: { cx: 3.2, cy: 0.8, cs: 0.7, crz: -1.3, sx: 3.1, sy: -1.6, ss: 0.55, srz: 0.9 },
        cta: { cx: -3.0, cy: -1.3, cs: 0.75, crz: 0.5, sx: 3.0, sy: 1.4, ss: 0.7, srz: -2.6 },
      };
  return map[name];
}

initWebGL();

function goToScene(name) {
  currentScene = name;
  if (!scene3d.ready) return;
  const state = scene3d.state;
  gsap.to(state, { ...sceneTargets(name), duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
  // a full turn of the comb on every scene change, always landing face-on
  const turn = Math.PI * 2;
  gsap.to(state, { spin: (Math.round(state.spin / turn) + 1) * turn, duration: 1.8, ease: 'power3.inOut', overwrite: 'auto' });

  const [combHex, handleHex] = theme().palettes[name];
  const { combMat, handleMat } = scene3d.materials;
  [
    [combMat.color, combHex],
    [handleMat.color, handleHex],
  ].forEach(([color, hex]) => {
    const target = new THREE.Color(hex);
    gsap.to(color, { r: target.r, g: target.g, b: target.b, duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' });
  });
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

    // comb sweeps through the tangled strands
    const combProxy = { p: 0 };
    gsap.to(combProxy, {
      p: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.comb-through', start: 'top 85%', end: 'bottom 30%', scrub: 0.6 },
      onUpdate: () => drawStrands(combProxy.p),
    });

    // scissors snip along each dashed divider
    document.querySelectorAll('[data-cut]:not([data-cut="preloader"])').forEach((line) => {
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
    drawStrands(1);
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
        onUpdate: (self) => gsap.set('.progress-bar span', { scaleX: self.progress }),
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

// Loader 1: scissors cut the sheet in two, then the halves fall away.
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

// Loader 2: a comb straightens a band of tangled strands; combed strands light up
// wherever they pass through the letters, so the name appears line by line.
function buildCombLoader(el) {
  const canvas = el.querySelector('.pl-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const state = { p: 0, fill: 0 };
  const colors = { text: cssVar('--text-rgb'), a: cssVar('--primary-2'), b: cssVar('--accent') };
  let W, H, fontSize, mask, strands, bandTop, bandBottom, spacing;

  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };

  const setFont = (c) => {
    c.font = `700 ${fontSize}px "Inter Tight", Inter, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = `${-0.05 * fontSize}px`;
  };

  const setup = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    fontSize = Math.min(W * 0.24, 320);

    // text mask, sampled to decide which strand segments sit inside the letters
    const m = document.createElement('canvas');
    m.width = W;
    m.height = H;
    const mc = m.getContext('2d');
    setFont(mc);
    mc.fillText('COMB', W / 2, H / 2);
    mask = mc.getImageData(0, 0, W, H).data;

    bandTop = H / 2 - fontSize * 0.62;
    bandBottom = H / 2 + fontSize * 0.62;
    spacing = Math.max(4.5, fontSize / 44);
    const count = Math.floor((bandBottom - bandTop) / spacing);
    const amp = fontSize * 0.14;
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    strands = Array.from({ length: count }, (_, i) => ({
      base: bandTop + i * spacing,
      a: amp * (0.5 + rand()),
      b: amp * (0.2 + rand() * 0.4),
      f1: 0.004 + rand() * 0.006,
      f2: 0.012 + rand() * 0.014,
      p1: rand() * TAU,
      p2: rand() * TAU,
      alpha: 0.35 + rand() * 0.4,
    }));
  };

  const inside = (x, y) => {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return false;
    return mask[(yi * W + xi) * 4 + 3] > 110;
  };

  const drawComb = (x) => {
    const top = bandTop - 50;
    const height = bandBottom - bandTop + 100;
    const grad = ctx.createLinearGradient(0, top, 0, top + height);
    grad.addColorStop(0, colors.a);
    grad.addColorStop(1, colors.b);
    ctx.fillStyle = grad;
    ctx.shadowColor = colors.b;
    ctx.shadowBlur = 36;
    ctx.beginPath();
    ctx.roundRect(x - 22, top, 24, height, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    // teeth point forward, into the tangles
    const teeth = Math.floor(height / (spacing * 2.6));
    const gap = height / teeth;
    for (let i = 0; i < teeth; i++) {
      ctx.beginPath();
      ctx.roundRect(x, top + gap * (i + 0.3), 48, Math.max(3, gap * 0.38), 3);
      ctx.fill();
    }
  };

  const render = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const combX = -80 + state.p * (W + 220);
    const faint = new Path2D();
    const lit = new Path2D();

    strands.forEach((s, i) => {
      let px = 0;
      let py = 0;
      let target = null;
      for (let x = 0; x <= W + 6; x += 6) {
        const tangle = smooth(combX - 10, combX + 240, x);
        const calm = Math.sin(x * 0.003 + i * 0.35) * 1.5;
        const chaos = Math.sin(x * s.f1 + s.p1) * s.a + Math.sin(x * s.f2 + s.p2) * s.b;
        const y = s.base + calm + tangle * chaos;
        if (x > 0) {
          // lines only glow in a thin band trailing the comb; past that the solid text takes over
          const mx = (px + x) / 2;
          const glowing = tangle < 0.02 && mx > combX - 70 && inside(mx, (py + y) / 2);
          const path = glowing ? lit : faint;
          if (path !== target) {
            path.moveTo(px, py);
            target = path;
          }
          path.lineTo(x, y);
        }
        px = x;
        py = y;
      }
    });

    ctx.lineCap = 'round';
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${colors.text}, ${0.28 * (1 - state.fill)})`;
    ctx.stroke(faint);

    const grad = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
    grad.addColorStop(0, colors.a);
    grad.addColorStop(1, colors.b);
    // crisp, solid name everywhere the comb has already passed (edge hides under the spine)
    if (combX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.max(0, combX - 70), H);
      ctx.clip();
      ctx.fillStyle = grad;
      setFont(ctx);
      ctx.fillText('COMB', W / 2, H / 2);
      ctx.restore();
    }

    ctx.strokeStyle = grad;
    ctx.lineWidth = spacing * 0.6;
    ctx.stroke(lit);
    if (combX > -100 && combX < W + 100) drawComb(combX);
  };

  setup();
  render();
  const onResize = () => {
    setup();
    render();
  };
  window.addEventListener('resize', onResize);

  return gsap
    .timeline({ paused: true, onComplete: () => window.removeEventListener('resize', onResize) })
    .to(state, { p: 1, duration: 2.8, ease: 'power1.inOut', onUpdate: render })
    // leftover strands fade, leaving just the clean name
    .to(state, { fill: 1, duration: 0.5, ease: 'power2.out', onUpdate: render }, '-=0.2')
    .to(el, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '+=0.3');
}

const LOADERS = { cut: buildCutLoader, comb: buildCombLoader };
let loaderName = 'cut';
try {
  const saved = localStorage.getItem('comb-loader');
  if (LOADERS[saved]) loaderName = saved;
} catch (e) {}

let pageReady = false;
let loaderPlaying = false;

// First run sets up the page behind the loader; later runs just replay it.
function runLoader() {
  document.querySelector('.preloader-cover')?.remove();

  const setupPage = () => {
    document.body.classList.remove('is-loading');
    window.scrollTo(0, 0);
    lenis?.scrollTo(0, { immediate: true, force: true });
    lenis?.start();
    if (!pageReady) {
      pageReady = true;
      setupScrollAnimations();
      setupSceneTriggers();
      ScrollTrigger.refresh();
    }
    goToScene('hero');
  };

  if (prefersReducedMotion) {
    setupPage();
    return;
  }

  loaderPlaying = true;
  const el = document.getElementById(`loader-${loaderName}`).content.firstElementChild.cloneNode(true);
  document.body.appendChild(el);
  document.body.classList.add('is-loading');
  lenis?.stop();

  // Long frames while the 3D scene compiles would otherwise make the timeline
  // jump ahead and skip most of the animation, so treat any big gap as one frame.
  gsap.ticker.lagSmoothing(500, 33);

  const tl = LOADERS[loaderName](el);
  tl.add(() => {
    el.remove();
    gsap.ticker.lagSmoothing(0); // back to Lenis' preferred setting
    loaderPlaying = false;
    setupPage();
  }).add(heroIntro(), '-=0.75');

  // start once the first (heaviest) WebGL frame has been drawn
  requestAnimationFrame(() => requestAnimationFrame(() => tl.play()));
}

/* ------------------------------------------------------------------ */
/* Loader switch                                                       */
/* ------------------------------------------------------------------ */
const loaderButtons = document.querySelectorAll('[data-loader-option]');
const markLoader = () =>
  loaderButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.loaderOption === loaderName)));
markLoader();

loaderButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (loaderPlaying || !pageReady) return;
    loaderName = button.dataset.loaderOption;
    markLoader();
    try {
      localStorage.setItem('comb-loader', loaderName);
    } catch (e) {}
    closeMenu();
    runLoader(); // replay so the choice can be seen straight away
  });
});

// Fonts affect layout of split text/pins (and the loader's canvas text), so wait for them.
(document.fonts?.ready ?? Promise.resolve()).then(runLoader);
