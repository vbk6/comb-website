/* COMB v3: warm, object-led story.
   A wooden comb rests on an appointment-book mat, then floats to the centre and
   turns while the "why" lights up word by word. Features scroll normally, each
   with an orange construction drawing; Bay and Studio run live; the workflow
   cards slide sideways; a scissors loader cuts through COMB at the start. */
const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth <= 860;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduceMotion && Lenis) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView();
  });
});

/* ---------- build the comb and the mat ---------- */
function combPath() {
  const L = 18, R = 622, T = 18, S = 86, B = 214, r = 22;
  const n = 34, x0 = 46, x1 = 594, tw = 9;
  const pitch = (x1 - x0) / (n - 1);
  let d = `M${L + r},${T} H${R - r} Q${R},${T} ${R},${T + r} V${S} `;
  // along the bottom, right to left, down and up each tooth (rounded tips)
  for (let i = n - 1; i >= 0; i--) {
    const cx = x0 + i * pitch;
    const tip = B - (i % 2 ? 0 : 6); // alternate long and short teeth
    d += `H${cx + tw / 2} V${tip - 5} Q${cx + tw / 2},${tip} ${cx},${tip} Q${cx - tw / 2},${tip} ${cx - tw / 2},${tip - 5} V${S} `;
  }
  return d + `H${L} V${T + r} Q${L},${T} ${L + r},${T} Z`;
}
const COMB_D = combPath();
$('.comb-body').setAttribute('d', COMB_D);
$('.comb-depth').setAttribute('d', COMB_D);
$('.comb-shine').setAttribute('d', 'M44 26 H596');

$('.mat-hours').innerHTML = Array.from({ length: 14 }, (_, i) => `<span>${String(8 + i).padStart(2, '0')}:00</span>`).join('');
$('.mat-days').innerHTML = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => `<span>${d}</span>`).join('');

/* ---------- split paragraphs into words that light up ---------- */
$$('[data-words]').forEach((el) => {
  el.innerHTML = el.textContent
    .trim()
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span>`)
    .join(' ');
});

/* ---------- the comb's journey ---------- */
// where the comb rests in the hero, and where it floats to for the "why"
const heroPose = () =>
  isMobile()
    ? { x: 0, y: -window.innerHeight * 0.11, rotation: -12, scale: 0.92 }
    : { x: -window.innerWidth * 0.03, y: window.innerHeight * 0.06, rotation: -16, scale: 0.88 };
const whyPose = () =>
  isMobile()
    ? { x: 0, y: -window.innerHeight * 0.04, rotation: -8, scale: 0.72 }
    : { x: 0, y: 0, rotation: -90, scale: 0.8 };

function combJourney() {
  gsap.set('.comb-move', heroPose());

  // hero → centre of the "why"
  gsap
    .timeline({
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        endTrigger: '.why',
        end: 'top top',
        scrub: 1,
        invalidateOnRefresh: true,
      },
    })
    .fromTo(
      '.comb-move',
      { x: () => heroPose().x, y: () => heroPose().y, rotation: () => heroPose().rotation, scale: () => heroPose().scale },
      { x: () => whyPose().x, y: () => whyPose().y, rotation: () => whyPose().rotation, scale: () => whyPose().scale, ease: 'power1.inOut' }
    )
    .to('.mat', { opacity: 0.25, scale: 1.08, ease: 'none' }, 0)
    .to('.hero-word', { yPercent: -40, opacity: 0, ease: 'none' }, 0);

  // pinned "why": the comb turns while the words light up, then it lifts away
  const why = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.why',
      start: 'top top',
      end: () => `+=${window.innerHeight * 1.6}`,
      pin: '.why-stage',
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });
  why
    .to('.comb-move', { rotationY: 360, duration: 3 }, 0)
    .fromTo('.why-title span', { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.25, duration: 0.5 }, 0)
    .to('.why-copy .w', { opacity: 1, stagger: 0.05, duration: 0.2 }, 0.3)
    .to('.comb-move', { y: () => -window.innerHeight * 0.9, opacity: 0, duration: 0.8, ease: 'power2.in' }, 3);
}

// the comb leans toward the pointer while it rests in the hero
function combTilt() {
  if (reduceMotion || !window.matchMedia('(hover: hover)').matches) return;
  const rx = gsap.quickTo('.comb', 'rotationX', { duration: 0.8, ease: 'power3' });
  const ry = gsap.quickTo('.comb', 'rotationY', { duration: 0.8, ease: 'power3' });
  gsap.set('.comb', { transformPerspective: 900 });
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / window.innerWidth - 0.5;
    const ny = e.clientY / window.innerHeight - 0.5;
    rx(-ny * 18);
    ry(nx * 22);
  });
}

/* ---------- loader ---------- */
// Scissors travel across the middle, pausing while the blades open and pushing
// forward as they close. The sheet opens into a thin wedge, then the halves part.
function loader() {
  const el = $('.loader');
  const top = $('.ld-top', el);
  const bottom = $('.ld-bottom', el);
  const slit = $('.ld-slit', el);
  const scissors = $('.ld-scissors', el);
  const bladeA = $('.blade-a', el);
  const bladeB = $('.blade-b', el);
  const TAU = Math.PI * 2;
  const SNIPS = 11;
  const state = { p: 0 };

  const drawCut = () => {
    const vw = window.innerWidth;
    const w = scissors.offsetWidth;
    const p = state.p;
    const stepped = p - Math.sin(TAU * SNIPS * p) / (TAU * SNIPS);
    const x = stepped * (vw + w * 1.2);
    const cutX = Math.min(x, vw);
    const angle = ((1 + Math.cos(TAU * SNIPS * p)) / 2) * 24;
    bladeA.style.transform = `rotate(${-angle}deg)`;
    bladeB.style.transform = `rotate(${angle}deg)`;
    scissors.style.transform = `translate(${x - w * 0.56}px, -50%)`;
    const gap = Math.min(9, cutX * 0.011);
    // the top half overlaps the uncut part by a pixel so no seam shows there
    top.style.clipPath = `polygon(0 0, 100% 0, 100% calc(50% + 1px), ${cutX}px calc(50% + 1px), ${cutX}px 50%, 0 calc(50% - ${gap}px))`;
    bottom.style.clipPath = `polygon(0 calc(50% + ${gap}px), ${cutX}px 50%, 100% 50%, 100% 100%, 0 100%)`;
    slit.style.width = `${cutX}px`;
  };
  drawCut();

  lenis?.stop();
  return gsap
    .timeline({ delay: 0.25 })
    .from('.ld-word', { yPercent: 20, opacity: 0, duration: 0.9, ease: 'expo.out' })
    .to(state, { p: 1, duration: 2.4, ease: 'power1.inOut', onUpdate: drawCut }, 0.35)
    .to(slit, { opacity: 0, duration: 0.3 }, '-=0.15')
    .to(top, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, '-=0.1')
    .to(bottom, { yPercent: 100, duration: 1.2, ease: 'expo.inOut' }, '<')
    .add(() => {
      el.remove();
      document.body.classList.remove('is-loading');
      lenis?.start();
    });
}

/* ---------- hero intro ---------- */
function intro() {
  return gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from('.comb-tilt', { y: () => -window.innerHeight * 0.7, rotation: -40, opacity: 0, duration: 1.6, ease: 'power3.out' }, 0)
    .from('.mat', { opacity: 0, scale: 1.06, duration: 1.4 }, 0)
    .from('.hero-word', { yPercent: 60, opacity: 0, duration: 1.4 }, 0.2)
    .from('.hero-kicker, .nav', { opacity: 0, y: -10, duration: 1 }, 0.4)
    .from('.hero-lead, .hero-stats', { opacity: 0, y: 26, duration: 1.2, stagger: 0.1 }, 0.55)
    .from('.hero-card', { opacity: 0, y: 30, duration: 1.2 }, 0.7)
    .from('.scroll-cue', { opacity: 0, duration: 1 }, 1);
}

/* ---------- sections ---------- */
function reveals() {
  // product
  gsap
    .timeline({ scrollTrigger: { trigger: '.product', start: 'top 70%' }, defaults: { ease: 'expo.out' } })
    .from('.product .kicker', { opacity: 0, y: 14, duration: 0.8 })
    .from('.product-title', { yPercent: 30, opacity: 0, duration: 1.2 }, 0.05)
    .from('.dash', { y: 80, rotation: -4, opacity: 0, duration: 1.4 }, 0.2)
    .fromTo('.dash-bars span', { scaleY: 0 }, { scaleY: 1, stagger: 0.07, duration: 0.9, ease: 'power3.out' }, 0.6)
    .from('.product-note, .product .footnote', { opacity: 0, y: 20, duration: 1, stagger: 0.1 }, 0.7);

  // features: each drawing sketches itself in as it arrives
  $$('.feat').forEach((feat) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: feat, start: 'top 62%' }, defaults: { ease: 'power2.out' } });
    // skip parts a drawing doesn't have
    const add = (method, sel, vars, at) => {
      const els = $$(sel, feat);
      if (els.length) tl[method](els, vars, at);
    };
    add('from', '.feat-panel > *', { opacity: 0, y: 22, stagger: 0.06, duration: 0.8 }, 0);
    add('from', '.guide', { opacity: 0, duration: 0.8 }, 0.1);
    add('to', '.ink:not(.dash)', { strokeDashoffset: 0, duration: 1.1, stagger: 0.08, ease: 'power2.inOut' }, 0.2);
    add('to', '.fill, .fill-text, .ink.dash, .handles rect', { opacity: 1, duration: 0.5, stagger: 0.05 }, 0.9);
    add('from', '.feat-caption, .feat-formula', { opacity: 0, y: 12, duration: 0.8, stagger: 0.1 }, 1);
  });

  // AI
  gsap
    .timeline({ scrollTrigger: { trigger: '.ai', start: 'top 70%' }, defaults: { ease: 'expo.out' } })
    .from('.ai .kicker', { opacity: 0, y: 14, duration: 0.8 })
    .from('.ai-title', { yPercent: 25, opacity: 0, duration: 1.2 }, 0.05)
    .from('.ai-sub', { opacity: 0, y: 18, duration: 1 }, 0.25);
  $$('.ai-card').forEach((card) => {
    gsap.from(card, { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: card, start: 'top 85%' } });
  });

  // workflow: the cards slide sideways while the section holds (desktop)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const track = $('.flow-track');
    const distance = () => track.scrollWidth - track.parentElement.clientWidth;
    gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.flow',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: '.flow-stage',
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });
  });
  gsap.from('.flow-head > *', { opacity: 0, y: 24, stagger: 0.1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.flow', start: 'top 70%' } });

  // contact: the line lights up as you reach it
  gsap.to('.contact-title .w', {
    opacity: 1,
    stagger: 0.05,
    ease: 'none',
    scrollTrigger: { trigger: '.contact-title', start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
  gsap.from('.foot-word', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.foot', start: 'top 90%' } });
}

/* ---------- nav state + progress ---------- */
function chrome() {
  const nav = $('.nav');
  const links = $$('[data-nav]');
  ScrollTrigger.create({
    start: () => window.innerHeight * 0.6,
    end: 'max',
    onToggle: (self) => nav.classList.toggle('is-scrolled', self.isActive),
  });
  $$('[data-section]').forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive) return;
        links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === section.dataset.section));
      },
    });
  });
  gsap.to('.progress span', {
    y: () => window.innerHeight - 200,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: true, invalidateOnRefresh: true },
  });
}

/* ---------- live AI demos (they only run while on screen) ---------- */
const whileVisible = (el, start, stop) =>
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0.2 }).observe(el);

// Bay: illustrative insights arrive one at a time, with actions you can tap
function bayDemo() {
  const feed = $('.bay-feed');
  if (!feed) return;
  const INSIGHTS = [
    { text: 'Good morning! Revenue is up 8% on last week.' },
    { text: "3 regular clients haven't booked in 6 weeks. Send them a reminder?", actions: ['Send reminder', 'Later'] },
    { text: 'Thursday 4–6 PM looks understaffed. Move a stylist from Friday?', actions: ['Adjust shifts'] },
    { text: 'Colour services are your top earner this month. Feature them in your next offer?', actions: ['Create offer'] },
  ];
  const MAX_VISIBLE = 3;

  const message = ({ text, actions }) => {
    const msg = document.createElement('div');
    msg.className = 'bay-msg';
    msg.textContent = text;
    if (actions) {
      const row = document.createElement('div');
      row.className = 'bay-actions';
      actions.forEach((label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => {
          row.querySelectorAll('button').forEach((x) => {
            x.classList.remove('is-done');
            x.textContent = x.textContent.replace(/^✓ /, '');
          });
          b.classList.add('is-done');
          b.textContent = `✓ ${label}`;
        });
        row.appendChild(b);
      });
      msg.appendChild(row);
    }
    return msg;
  };

  if (reduceMotion) {
    INSIGHTS.slice(0, MAX_VISIBLE).forEach((i) => feed.appendChild(message(i)));
    return;
  }

  let i = 0;
  let tl = null;
  const next = () => {
    const typing = document.createElement('div');
    typing.className = 'bay-typing';
    typing.innerHTML = '<i></i><i></i><i></i>';
    tl = gsap
      .timeline({ onComplete: () => (tl = gsap.delayedCall(2.6, next)) })
      .add(() => feed.appendChild(typing))
      .from(typing, { opacity: 0, y: 10, duration: 0.3 })
      .add(() => {
        typing.remove();
        const msg = message(INSIGHTS[i++ % INSIGHTS.length]);
        feed.appendChild(msg);
        const all = feed.querySelectorAll('.bay-msg');
        if (all.length > MAX_VISIBLE) {
          gsap.to(all[0], { opacity: 0, height: 0, marginTop: -10, paddingTop: 0, paddingBottom: 0, duration: 0.4, onComplete: () => all[0].remove() });
        }
        gsap.from(msg, { opacity: 0, y: 16, scale: 0.96, transformOrigin: '0% 100%', duration: 0.45, ease: 'back.out(1.8)' });
      }, '+=1');
  };

  whileVisible(
    feed,
    () => (tl ? tl.resume() : next()),
    () => tl?.pause()
  );
}

// Studio: tap a shade or style; otherwise it cycles through them on its own
function studioDemo() {
  const stage = $('.studio-stage');
  if (!stage) return;
  const shades = $$('.studio-shades .shade');
  const styles = $$('.studio-styles .style-btn');
  const photos = $$('.studio-photo', stage);
  const caption = $('.studio-caption');
  let shade = 0;
  let style = 0;

  const render = () => {
    const s = shades[shade];
    const natural = s.classList.contains('shade-natural');
    stage.classList.toggle('is-natural', natural);
    if (!natural) {
      stage.style.setProperty('--hair', s.style.getPropertyValue('--c'));
      stage.style.setProperty('--hair-light', s.style.getPropertyValue('--l'));
      stage.style.setProperty('--hair-deep', s.dataset.deep);
    }
    shades.forEach((b, k) => b.setAttribute('aria-pressed', String(k === shade)));
    styles.forEach((b, k) => b.setAttribute('aria-pressed', String(k === style)));
    photos.forEach((p) => p.classList.toggle('is-on', p.dataset.style === styles[style].dataset.style));
    caption.innerHTML = `Previewing <strong>${s.dataset.name}</strong> · <strong>${styles[style].textContent}</strong>`;
  };
  render();

  let timer = null;
  let step = 0;
  let pausedUntil = 0;
  const tick = () => {
    if (Date.now() >= pausedUntil) {
      if (step++ % 2) style = (style + 1) % styles.length;
      else shade = (shade + 1) % shades.length;
      render();
    }
    timer = setTimeout(tick, 2400);
  };
  const pick = () => (pausedUntil = Date.now() + 9000);
  shades.forEach((b, k) => b.addEventListener('click', () => ((shade = k), pick(), render())));
  styles.forEach((b, k) => b.addEventListener('click', () => ((style = k), pick(), render())));

  if (reduceMotion) return;
  whileVisible(
    stage,
    () => {
      if (!timer) timer = setTimeout(tick, 1600);
    },
    () => {
      clearTimeout(timer);
      timer = null;
    }
  );
}

/* ---------- start ---------- */
(document.fonts?.ready ?? Promise.resolve()).then(() => {
  window.scrollTo(0, 0);
  combJourney();
  combTilt();
  reveals();
  chrome();
  bayDemo();
  studioDemo();
  ScrollTrigger.refresh();
  if (reduceMotion) {
    $('.loader')?.remove();
    document.body.classList.remove('is-loading');
    return;
  }
  // the hero starts arriving while the halves are still parting
  loader().add(intro(), '-=1.1');
});
