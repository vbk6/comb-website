/* COMB v2: a cinematic, scroll-driven story.
   1. Film: one pinned stage the camera pushes through (stylist → salon → dashboard)
   2. Features: pinned step-through with an exploded line drawing of shears
   3–5. AI, workflow and contact reveal as they enter */
const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduceMotion && Lenis) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// true while a nav link is scrolling the page, so pinned sections don't grab it
let navigating = false;
const afterNav = [];
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    navigating = true;
    const done = () => {
      navigating = false;
      afterNav.forEach((fn) => fn());
    };
    if (lenis) lenis.scrollTo(target, { duration: 1.6, force: true, onComplete: done });
    else {
      target.scrollIntoView();
      done();
    }
  });
});

/* ---------- split text into letters (kept whole per word for wrapping) ---------- */
$$('[data-chars]').forEach((el) => {
  const label = el.textContent.trim();
  el.setAttribute('aria-label', label);
  el.innerHTML = label
    .split(' ')
    .map((w) => `<span class="word" aria-hidden="true">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`)
    .join(' ');
});

// letters arrive out of a blur, a few at a time (the "focus pull")
const blurIn = (targets, opts = {}) =>
  gsap.fromTo(
    targets,
    { opacity: 0, filter: 'blur(14px)', x: 10 },
    { opacity: 1, filter: 'blur(0px)', x: 0, duration: 0.5, stagger: 0.025, ease: 'power2.out', ...opts }
  );
const blurOut = (targets, opts = {}) =>
  gsap.to(targets, { opacity: 0, filter: 'blur(14px)', duration: 0.35, stagger: 0.012, ease: 'power1.in', ...opts });

/* ---------- page progress (right edge) ---------- */
gsap.to('.progress span', {
  scaleY: 1,
  ease: 'none',
  scrollTrigger: { start: 0, end: 'max', scrub: true },
});

/* ---------- intro on load ---------- */
function intro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.shot-a img', { scale: 1.25, opacity: 0, duration: 2.4, ease: 'power2.out' }, 0)
    .from('.grid-lines span', { scaleX: 0, scaleY: 0, duration: 1.6, stagger: 0.06, ease: 'power3.inOut' }, 0.1)
    .from('.hud', { opacity: 0, y: -12, duration: 1 }, 0.5)
    .from('.intro-eyebrow', { opacity: 0, y: 16, duration: 1 }, 0.6)
    .from('.intro-title .line > span', { yPercent: 110, duration: 1.4, stagger: 0.12 }, 0.6)
    .from('.intro-lead', { opacity: 0, y: 24, duration: 1.2 }, 1.1)
    .from('.intro-stats li', { opacity: 0, y: 20, duration: 1, stagger: 0.08 }, 1.2)
    .from('.scroll-cue', { opacity: 0, duration: 1 }, 1.4);
  return tl;
}

/* ---------- 1. FILM ---------- */
function film() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.film',
      start: 'top top',
      end: () => `+=${window.innerHeight * 5.5}`,
      pin: '.film-stage',
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // push into the first shot while the headline drifts apart
  tl.to('.shot-a img', { scale: 1.5, duration: 1.4 }, 0)
    .to('.intro-eyebrow, .intro-lead, .intro-stats, .scroll-cue', { opacity: 0, y: -30, duration: 0.35 }, 0)
    .to('.intro-title .l1 > span', { xPercent: -18, opacity: 0, filter: 'blur(12px)', duration: 0.6 }, 0.12)
    .to('.intro-title .l2 > span', { xPercent: 12, opacity: 0, filter: 'blur(12px)', duration: 0.6 }, 0.18)
    .to('.intro-title .l3 > span', { xPercent: -8, opacity: 0, filter: 'blur(12px)', duration: 0.6 }, 0.24)

    // through it and into the salon
    .to('.shot-a', { opacity: 0, duration: 0.55 }, 0.8)
    .to('.shot-b', { opacity: 1, duration: 0.55 }, 0.8)
    .fromTo('.shot-b img', { scale: 1.7 }, { scale: 1.08, duration: 3.6, ease: 'power1.out' }, 0.8)

    // "From appointment chaos" → "to a calmer, smarter salon."
    // lines rise out of a mask like the opening headline, then lift away
    .fromTo('.why-eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, 1.2)
    .fromTo('.why-a > span', { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' }, 1.25)
    .to('.why-a > span', { yPercent: -110, duration: 0.4, ease: 'power2.in' }, 2.05)
    .fromTo('.why-b > span', { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' }, 2.3)
    .fromTo('.why-copy', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 2.55)
    .to('.why-eyebrow, .why-copy', { opacity: 0, y: -20, duration: 0.3 }, 3.3)
    .to('.why-b > span', { yPercent: -110, duration: 0.4, ease: 'power2.in' }, 3.3)

    // the dashboard flies in like a drone and hovers
    .fromTo(
      '.device',
      { opacity: 0, scale: 0.18, yPercent: 60, rotate: -14 },
      { opacity: 1, scale: 1, yPercent: 0, rotate: 0, duration: 1.3, ease: 'power2.out' },
      3.6
    )
    .fromTo('.device-bars span', { scaleY: 0 }, { scaleY: 1, stagger: 0.06, duration: 0.4, ease: 'power2.out' }, 4.2)
    .fromTo('.device-title .line > span', { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.12, ease: 'expo.out' }, 4.0)
    .fromTo('.device-copy', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, 4.5)
    .to({}, { duration: 0.6 }) // hold

    // fade to the workshop
    .to('.film-fade', { opacity: 1, duration: 0.5 });

  if (!reduceMotion) {
    gsap.to('.device-float', { y: -10, rotate: 0.6, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  }
}

/* ---------- 2. FEATURES ---------- */
const FEATURES = [
  { word: 'BOOK', name: 'Appointments', tag: 'Available now', desc: 'Track walk-ins, manage confirmations, reduce missed slots, and keep the day moving.' },
  { word: 'KNOW', name: 'Customer intelligence', tag: 'Available now', desc: 'See repeat bookings, customer history, and at-risk clients before they drift away.' },
  { word: 'BILL', name: 'Billing & payments', tag: 'Available now', desc: 'Keep invoices, payments, and billing history in one place without manual follow-up.' },
  { word: 'LEAD', name: 'Staff oversight', tag: 'Available now', desc: 'Assign shifts, monitor attendance, and understand staff productivity across branches.' },
  { word: 'REVIEW', name: 'Reports & insights', tag: 'Available now', desc: 'Review revenue trends, performance by branch, and daily actions with clear summaries.' },
  { word: 'MESSAGE', name: 'WhatsApp center', tag: 'Planned', desc: 'Use messaging workflows to keep customer communication fast, consistent, and personal.' },
];

function features() {
  const num = $('.f-num');
  const dots = $$('.f-dots i');
  const tag = $('.f-tag');
  const copy = $('.f-copy');
  const name = $('.f-name');
  const desc = $('.f-desc');
  const word = $('.f-word span');
  let current = 0;
  dots[0].classList.add('on');

  function show(i) {
    if (i === current) return;
    const down = i > current;
    current = i;
    const f = FEATURES[i];
    num.textContent = String(i + 1).padStart(2, '0');
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    tag.textContent = f.tag;
    tag.classList.toggle('planned', f.tag === 'Planned');

    gsap.killTweensOf([word, copy]);
    gsap
      .timeline()
      .to(word, { yPercent: down ? -105 : 105, duration: 0.35, ease: 'power3.in' })
      .add(() => (word.textContent = f.word))
      .fromTo(word, { yPercent: down ? 105 : -105 }, { yPercent: 0, duration: 0.6, ease: 'expo.out' });
    gsap
      .timeline()
      .to(copy, { opacity: 0, y: down ? -14 : 14, duration: 0.2 })
      .add(() => {
        name.textContent = f.name;
        desc.textContent = f.desc;
      })
      .fromTo(copy, { y: down ? 14 : -14 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
  }

  let rest = -1; // the feature the page last settled on

  // the shears come apart and back together as you move through the steps
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.features',
      start: 'top top',
      // a full screen of scrolling per feature
      end: () => `+=${window.innerHeight * FEATURES.length}`,
      pin: '.features-stage',
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (st) => show(stepAt(st.progress)),
      // entering from above starts before the first feature, from below after the last
      onToggle: (self) => {
        if (self.isActive) rest = self.direction > 0 ? -1 : FEATURES.length;
      },
    },
  });

  /* Scrolling here is ordinary smooth scrolling. When you stop, the page settles
     on the next feature in the direction you scrolled: a small swipe still moves
     one feature, and a big one can't skip past one. */
  const N = FEATURES.length;
  const st = tl.scrollTrigger;
  function stepAt(p) {
    return Math.min(N - 1, Math.floor(p * N));
  }
  const stepY = (i) => st.start + (st.end - st.start) * ((i + 0.5) / N);

  const settle = () => {
    if (!st.isActive || navigating) return;
    const pos = st.progress * N - 0.5; // 0 = centred on the first feature
    let target;
    if (pos > rest + 0.04) target = rest + 1;
    else if (pos < rest - 0.04) target = rest - 1;
    else return;
    if (target < 0 || target >= N) return; // heading out of the section: let it go
    rest = target;
    const y = stepY(target);
    if (lenis) lenis.scrollTo(y, { duration: 0.6, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  ScrollTrigger.addEventListener('scrollEnd', settle);
  afterNav.push(settle);
  const pivot = { svgOrigin: '200 206' };
  tl.fromTo('.shears-body', { rotation: -38, ...pivot }, { rotation: 22, duration: 6, ...pivot }, 0)
    .to('.part-a', { x: 46, y: -22, rotation: 9, duration: 1.6, ease: 'power2.inOut', ...pivot }, 0.3)
    .to('.part-b', { x: -46, y: 22, rotation: -9, duration: 1.6, ease: 'power2.inOut', ...pivot }, 0.3)
    .to('.part-screw', { x: 100, y: -86, duration: 1.6, ease: 'power2.inOut' }, 0.3)
    .to('.shears .leader', { opacity: 0.8, duration: 0.6 }, 1.2)
    .to('.shears .callouts text', { opacity: 1, stagger: 0.25, duration: 0.5 }, 1.4)
    .to('.shears .callouts text, .shears .leader', { opacity: 0, duration: 0.5 }, 4.4)
    .to('.part-a, .part-b, .part-screw', { x: 0, y: 0, rotation: 0, duration: 1.4, ease: 'power2.inOut', ...pivot }, 4.5);
}

/* ---------- 3–5. reveals ---------- */
function reveals() {
  $$('.stagger-title').forEach((title) => {
    gsap.from($$('.line > span', title), {
      yPercent: 110,
      duration: 1.3,
      stagger: 0.12,
      ease: 'expo.out',
      scrollTrigger: { trigger: title, start: 'top 82%' },
    });
  });

  $$('.ai-sub, .wf-sub, .ai .eyebrow, .workflow .eyebrow').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 24, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });

  $$('.ai-row').forEach((row) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 78%' }, defaults: { ease: 'expo.out' } });
    // only animate what this row has (Bay has messages, Studio has photos)
    const from = (sel, vars, at) => {
      const els = $$(sel, row);
      if (els.length) tl.from(els, vars, at);
    };
    from('.ai-meta > *', { opacity: 0, y: 16, stagger: 0.06, duration: 0.9 }, 0);
    from('.ai-name', { yPercent: 40, opacity: 0, filter: 'blur(10px)', duration: 1.2 }, 0.05);
    from('.ai-body p, .ai-list li', { opacity: 0, y: 18, stagger: 0.06, duration: 0.9 }, 0.2);
    // the live panel wipes open from the top
    from('.panel', { clipPath: 'inset(0 0 100% 0)', duration: 1.3, ease: 'expo.inOut' }, 0.15);
  });

  gsap.from('.wf-rule', {
    scaleX: 0,
    stagger: 0.12,
    duration: 1.2,
    ease: 'expo.inOut',
    scrollTrigger: { trigger: '.wf-steps', start: 'top 82%' },
  });
  gsap.from('.wf-steps li > :not(.wf-rule)', {
    opacity: 0,
    y: 22,
    stagger: 0.05,
    duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.wf-steps', start: 'top 80%' },
  });

  // contact: slow push into the photo, then the letters focus in
  gsap.fromTo(
    '.contact-bg img',
    { scale: 1.25 },
    { scale: 1, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true } }
  );
  const ct = gsap.timeline({ scrollTrigger: { trigger: '.contact-inner', start: 'top 60%' } });
  ct.add(blurIn('.contact-title .ch', { duration: 0.8, stagger: 0.05 }))
    .from('.contact-copy, .contact-cta', { opacity: 0, y: 20, stagger: 0.1, duration: 0.9, ease: 'power3.out' }, 0.3);
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
        // keep the latest few; older ones fold away at the top
        const all = feed.querySelectorAll('.bay-msg');
        if (all.length > MAX_VISIBLE) {
          gsap.to(all[0], { opacity: 0, height: 0, marginTop: -10, paddingTop: 0, paddingBottom: 0, borderWidth: 0, duration: 0.4, onComplete: () => all[0].remove() });
        }
        gsap.from(msg, { opacity: 0, x: -14, filter: 'blur(6px)', duration: 0.5, ease: 'power3.out' });
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
  let shade = 0; // the photo's natural colour
  let style = 0; // long waves

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

  // a visitor's own pick holds for a while before auto-play resumes
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

/* ---------- loader ---------- */
// Scissors travel across the middle of the screen, pausing while the blades
// open and pushing forward as they close, like real cutting. The sheet opens
// into a thin wedge behind them, then the two halves part.
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
    const x = stepped * (vw + w * 1.2); // run fully off-screen at the end
    const cutX = Math.min(x, vw);

    const angle = ((1 + Math.cos(TAU * SNIPS * p)) / 2) * 24;
    bladeA.style.transform = `rotate(${-angle}deg)`;
    bladeB.style.transform = `rotate(${angle}deg)`;
    // the pivot sits at 30/64 of the drawing; the cut front is just ahead of it
    scissors.style.transform = `translate(${x - w * 0.56}px, -50%)`;

    const gap = Math.min(8, cutX * 0.01);
    // the top half overlaps the uncut part by a pixel so no seam shows there
    top.style.clipPath = `polygon(0 0, 100% 0, 100% calc(50% + 1px), ${cutX}px calc(50% + 1px), ${cutX}px 50%, 0 calc(50% - ${gap}px))`;
    bottom.style.clipPath = `polygon(0 calc(50% + ${gap}px), ${cutX}px 50%, 100% 50%, 100% 100%, 0 100%)`;
    slit.style.width = `${cutX}px`;
  };
  drawCut();

  lenis?.stop();
  return gsap
    .timeline({ delay: 0.25 })
    .from('.ld-word', { yPercent: 18, opacity: 0, duration: 0.9, ease: 'expo.out' })
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

/* ---------- start ---------- */
(document.fonts?.ready ?? Promise.resolve()).then(() => {
  window.scrollTo(0, 0);
  film();
  features();
  reveals();
  bayDemo();
  studioDemo();
  ScrollTrigger.refresh();
  if (reduceMotion) {
    $('.loader')?.remove();
    document.body.classList.remove('is-loading');
    return;
  }
  // the opening shot starts its intro while the halves are still parting
  loader().add(intro(), '-=1.1');
});
