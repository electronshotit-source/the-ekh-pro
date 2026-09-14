import { mountPlates, renderPlate } from './plates.js';

document.addEventListener('DOMContentLoaded', () => {
  mountPlates();
  initLoader();
  initCursor();
  initHeader();
  initMobileNav();
  initReveal();
  initHeroSplit();
  initFilters();
  initLightbox();
  initTestimonials();
  initForm();
  initProgress();
  initSmoothAnchors();
  initYear();
});

/* ---------------- loader ---------------- */
function initLoader(){
  const loader = document.querySelector('.loader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => loader.classList.add('is-done'), 900);
  });
  // fallback in case load event is delayed
  setTimeout(() => loader.classList.add('is-done'), 2600);
}

/* ---------------- custom cursor ---------------- */
function initCursor(){
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;

  let mx = 0, my = 0, rx = 0, ry = 0;
  window.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = `${mx}px`; dot.style.top = `${my}px`;
    dot.classList.add('is-visible'); ring.classList.add('is-visible');
  }, { once: false });
  (function loop(){
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.left = `${rx}px`; ring.style.top = `${ry}px`;
    requestAnimationFrame(loop);
  })();

  document.addEventListener('mouseleave', () => { dot.classList.add('is-hidden'); ring.classList.add('is-hidden'); });
  document.addEventListener('mouseenter', () => { dot.classList.remove('is-hidden'); ring.classList.remove('is-hidden'); });

  const magnetic = document.querySelectorAll('a, button, .work-card, .filter-btn');
  magnetic.forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  });
}

/* ---------------- header show/hide + scrolled state ---------------- */
function initHeader(){
  const header = document.querySelector('.site-header');
  if (!header) return;
  let lastY = window.scrollY;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    if (y > lastY && y > 200) header.classList.add('is-hidden');
    else header.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });
}

/* ---------------- mobile nav ---------------- */
function initMobileNav(){
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.mobile-nav');
  if (!burger || !nav) return;
  burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    nav.classList.toggle('is-open');
    document.body.style.overflow = nav.classList.contains('is-open') ? 'hidden' : '';
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    burger.classList.remove('is-open');
    nav.classList.remove('is-open');
    document.body.style.overflow = '';
  }));
}

/* ---------------- scroll reveal ---------------- */
function initReveal(){
  const items = document.querySelectorAll('.reveal, .reveal-scale');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting){
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -60px 0px' });
  items.forEach((el) => io.observe(el));
}

/* ---------------- hero title split-into-lines animation ---------------- */
function initHeroSplit(){
  document.querySelectorAll('.hero-title .line span').forEach((span, i) => {
    span.style.animationDelay = `${0.15 + i * 0.12}s`;
  });
}

/* ---------------- portfolio filters ---------------- */
function initFilters(){
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.work-card');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const cat = btn.dataset.filter;
      cards.forEach((card) => {
        const match = cat === 'all' || card.dataset.category === cat;
        card.style.display = match ? '' : 'none';
      });
    });
  });
}

/* ---------------- lightbox ---------------- */
function initLightbox(){
  const cards = Array.from(document.querySelectorAll('.work-card'));
  const lightbox = document.querySelector('.lightbox');
  if (!cards.length || !lightbox) return;

  const plateHost = lightbox.querySelector('.lightbox-plate');
  const titleEl = lightbox.querySelector('[data-lb-title]');
  const catEl = lightbox.querySelector('[data-lb-cat]');
  const descEl = lightbox.querySelector('[data-lb-desc]');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('[data-lb-prev]');
  const nextBtn = lightbox.querySelector('[data-lb-next]');
  let current = 0;

  function open(i){
    current = (i + cards.length) % cards.length;
    const card = cards[current];
    const seed = Number(card.querySelector('[data-plate]')?.dataset.plate || 0);
    plateHost.innerHTML = renderPlate({ seed, label: card.dataset.title });
    titleEl.textContent = card.dataset.title || '';
    catEl.textContent = card.dataset.categoryLabel || '';
    descEl.textContent = card.dataset.desc || '';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function close(){
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  cards.forEach((card, i) => card.addEventListener('click', () => open(i)));
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
  prevBtn.addEventListener('click', () => open(current - 1));
  nextBtn.addEventListener('click', () => open(current + 1));
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') open(current - 1);
    if (e.key === 'ArrowRight') open(current + 1);
  });
}

/* ---------------- testimonial slider ---------------- */
function initTestimonials(){
  const slides = document.querySelectorAll('.quote-slide');
  const dots = document.querySelectorAll('.quote-dots button');
  if (!slides.length) return;
  let i = 0, timer;

  function show(idx){
    slides.forEach((s, n) => s.classList.toggle('is-active', n === idx));
    dots.forEach((d, n) => d.classList.toggle('is-active', n === idx));
    i = idx;
  }
  function next(){ show((i + 1) % slides.length); }

  dots.forEach((d, n) => d.addEventListener('click', () => { show(n); restart(); }));
  function restart(){ clearInterval(timer); timer = setInterval(next, 6000); }
  restart();
}

/* ---------------- contact form (client-side demo) ---------------- */
function initForm(){
  const form = document.querySelector('.contact-form');
  if (!form) return;
  const status = form.querySelector('.form-status');

  form.querySelectorAll('input, textarea, select').forEach((field) => {
    const wrap = field.closest('.form-field');
    const sync = () => wrap && wrap.classList.toggle('has-value', !!field.value);
    field.addEventListener('input', sync);
    field.addEventListener('change', sync);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('#name')?.value.trim();
    if (!name) {
      status.textContent = 'Please tell me your name so I know who to reply to.';
      return;
    }
    status.textContent = 'Sending...';
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    setTimeout(() => {
      status.textContent = `Thank you, ${name.split(' ')[0]} — your brief has been received. Expect a reply within 48 hours.`;
      form.reset();
      form.querySelectorAll('.form-field').forEach((w) => w.classList.remove('has-value'));
      btn.disabled = false;
    }, 1100);
  });
}

/* ---------------- scroll progress bar ---------------- */
function initProgress(){
  const bar = document.querySelector('.scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    bar.style.width = `${scrolled}%`;
  }, { passive: true });
}

/* ---------------- smooth in-page anchors + active nav link ---------------- */
function initSmoothAnchors(){
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const navLinks = document.querySelectorAll('.main-nav a[href^="#"]');
  const sections = Array.from(navLinks).map((l) => document.querySelector(l.getAttribute('href'))).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = `#${entry.target.id}`;
      const link = document.querySelector(`.main-nav a[href="${id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        navLinks.forEach((l) => l.classList.remove('is-active'));
        link.classList.add('is-active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach((s) => io.observe(s));
}

function initYear(){
  const el = document.querySelector('[data-year]');
  if (el) el.textContent = new Date().getFullYear();
}
