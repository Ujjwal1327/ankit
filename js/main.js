(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     Reddit growth data (update when new quarters come out)
     Source: Reddit, Inc. quarterly earnings releases (SEC filings)
     Values in millions, Q2 of each year.
     --------------------------------------------------------- */
  const GROWTH_DATA = [
    { label: 'Q2 2023', year: '2023', daily: 60.4, weekly: 218.1 },
    { label: 'Q2 2024', year: '2024', daily: 91.2, weekly: 342.3 },
    { label: 'Q2 2025', year: '2025', daily: 110.4, weekly: 416.4 },
    { label: 'Q2 2026', year: '2026', daily: 130.3, weekly: 514.6 },
  ];
  const CHART_MAX = 150;
  const CHART_TICKS = [0, 50, 100, 150];

  /* ---------------- Navbar ---------------- */
  const nav = document.querySelector('[data-nav]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');

  const setMenu = (open) => {
    nav.classList.toggle('menu-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
  mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 992px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  const updateNav = () => nav.classList.toggle('scrolled', window.scrollY > 40);

  /* ---------------- Active link on scroll ---------------- */
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a:not(.btn)');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const hash = '#' + entry.target.id;
        navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === hash));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((section) => spy.observe(section));
  }

  /* ---------------- Hero title: split into words ---------------- */
  const wrapWord = (node, index) => {
    const outer = document.createElement('span');
    const inner = document.createElement('span');
    outer.className = 'word';
    inner.className = 'word-inner';
    inner.style.setProperty('--i', index);
    inner.append(node);
    outer.append(inner);
    return outer;
  };

  const splitWords = (el) => {
    const frag = document.createDocumentFragment();
    let index = 0;
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          frag.append(wrapWord(document.createTextNode(part), index++));
        });
      } else {
        frag.append(wrapWord(node.cloneNode(true), index++));
      }
    });
    el.textContent = '';
    el.append(frag);
  };

  if (!reduceMotion) document.querySelectorAll('[data-split]').forEach(splitWords);

  /* ---------------- Chart ---------------- */
  const chart = document.querySelector('[data-chart]');

  const renderChart = () => {
    const plot = chart.querySelector('[data-chart-plot]');
    const tableBody = chart.querySelector('[data-chart-table] tbody');

    const grid = CHART_TICKS.map((tick) => `
      <div class="chart-gl${tick === 0 ? ' chart-gl--base' : ''}" style="bottom:${(tick / CHART_MAX) * 100}%">
        <span>${tick}</span>
      </div>`).join('');

    const bars = GROWTH_DATA.map((d, i) => `
      <button type="button" class="chart-col" style="--h:${(d.daily / CHART_MAX) * 100}%; --i:${i}"
        aria-label="${d.label}: ${d.daily} million daily users, ${d.weekly} million weekly users">
        <span class="chart-bar-wrap">
          <span class="chart-value">${d.daily}M</span>
          <span class="chart-bar"></span>
        </span>
        <span class="chart-x">${d.year}</span>
        <span class="chart-tip" aria-hidden="true">
          <strong>${d.label}</strong>
          <span>${d.daily}M daily users</span>
          <span>${d.weekly}M weekly users</span>
        </span>
      </button>`).join('');

    plot.innerHTML = grid + `<div class="chart-bars">${bars}</div>`;

    tableBody.innerHTML = GROWTH_DATA.map((d) =>
      `<tr><td>${d.label}</td><td>${d.daily}</td><td>${d.weekly}</td></tr>`).join('');
  };

  if (chart) renderChart();

  /* ---------------- Counters ---------------- */
  const formatCount = (el, value) => {
    const decimals = Number(el.dataset.decimals || 0);
    el.textContent = value.toFixed(decimals) + (el.dataset.suffix || '');
  };

  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      formatCount(el, target * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------------- Scroll reveal, counters, chart in-view ---------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const counters = document.querySelectorAll('[data-count]');

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealEls.forEach((el) => el.removeAttribute('data-reveal'));
    if (chart) chart.classList.add('in-view');
  } else {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        obs.unobserve(el);
        el.classList.add('is-visible');
        // once revealed, drop the reveal styles so hover transitions are instant
        const done = (e) => {
          if (e.target !== el || e.propertyName !== 'opacity') return;
          el.removeAttribute('data-reveal');
          el.classList.remove('is-visible');
          el.removeEventListener('transitionend', done);
        };
        el.addEventListener('transitionend', done);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => revealObserver.observe(el));

    const countObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        animateCount(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => {
      formatCount(el, 0);
      countObserver.observe(el);
    });

    if (chart) {
      const chartObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          entry.target.classList.add('in-view');
        });
      }, { threshold: 0.35 });
      chartObserver.observe(chart);
    }
  }

  /* ---------------- Process steps: progress line ---------------- */
  const steps = document.querySelector('[data-steps]');
  const stepItems = steps ? Array.from(steps.querySelectorAll('.step')) : [];
  const stepsLine = steps ? steps.querySelector('.steps-line') : null;

  // offsets (li → .steps, number → li) ignore the reveal transforms
  const numCenter = (item) => {
    const num = item.querySelector('.step-num');
    return item.offsetTop + num.offsetTop + num.offsetHeight / 2;
  };

  const layoutStepsLine = () => {
    if (!stepItems.length) return;
    const first = numCenter(stepItems[0]);
    const last = numCenter(stepItems[stepItems.length - 1]);
    stepsLine.style.top = `${first}px`;
    stepsLine.style.bottom = 'auto';
    stepsLine.style.height = `${last - first}px`;
  };

  const updateSteps = () => {
    if (!stepItems.length) return;
    const trigger = window.innerHeight * 0.6;
    const lineRect = stepsLine.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (trigger - lineRect.top) / (lineRect.height || 1)));
    steps.style.setProperty('--progress', progress.toFixed(4));
    const stepsTop = steps.getBoundingClientRect().top;
    stepItems.forEach((item) => {
      item.classList.toggle('active', stepsTop + numCenter(item) <= trigger);
    });
  };

  /* ---------------- Card spotlight ---------------- */
  document.querySelectorAll('[data-spotlight]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  /* ---------------- Package buttons pre-select the form ---------------- */
  const packageSelect = document.getElementById('f-package');
  document.querySelectorAll('[data-package]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (packageSelect) packageSelect.value = btn.dataset.package;
    });
  });

  /* ---------------- Contact form ---------------- */
  const form = document.querySelector('[data-form]');
  const formSuccess = document.querySelector('[data-form-success]');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setError = (name, message) => {
    const field = form.elements[name];
    const holder = form.querySelector(`[data-error-for="${name}"]`);
    field.closest('.field').classList.toggle('has-error', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (holder) holder.textContent = message || '';
  };

  const validate = (data) => {
    const errors = {};
    if (!data.name.trim()) errors.name = 'Please enter your name.';
    if (!data.email.trim()) errors.email = 'Please enter your email.';
    else if (!emailPattern.test(data.email.trim())) errors.email = 'Please enter a valid email address.';
    if (!data.message.trim()) errors.message = 'Please tell us a little about your brand.';
    return errors;
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const errors = validate(data);
      ['name', 'email', 'message'].forEach((name) => setError(name, errors[name]));

      const firstError = Object.keys(errors)[0];
      if (firstError) {
        form.elements[firstError].focus();
        return;
      }

      // TODO: send the form data somewhere (email service, Google Sheet, CRM or your own API).
      // `data` looks like: { name, email, website, package, message }
      console.log('Contact form submitted:', data);

      form.hidden = true;
      formSuccess.hidden = false;
      formSuccess.setAttribute('tabindex', '-1');
      formSuccess.focus();
    });

    form.addEventListener('input', (e) => {
      if (e.target.name && e.target.closest('.field.has-error')) setError(e.target.name, '');
    });

    document.querySelector('[data-form-reset]').addEventListener('click', () => {
      form.reset();
      formSuccess.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------------- Footer year ---------------- */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------------- Scroll / resize loop ---------------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      updateNav();
      updateSteps();
    });
  };

  const onResize = () => {
    layoutStepsLine();
    onScroll();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', onResize);
  document.fonts && document.fonts.ready.then(onResize);
  onResize();
})();
