(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const mobile = () => window.matchMedia('(max-width:1024px)').matches;

  // Mobilmeny
  const burger = $('.burger');
  const nav = $('#meny');
  const setMenu = (open) => {
    if (!nav) return;
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Stäng menyn' : 'Öppna menyn');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  const setHdr = () => { const h = $('header.site'); if (h) document.documentElement.style.setProperty('--hdr', Math.round(h.getBoundingClientRect().bottom) + 'px'); };
  burger && burger.addEventListener('click', () => { setHdr(); setMenu(!nav.classList.contains('open')); });
  window.addEventListener('resize', setHdr);

  // Meganavigering: hovring på dator, klick överallt
  const dds = $$('.dd');
  const closeAll = (except) => dds.forEach((d) => {
    if (d !== except) { d.classList.remove('open'); $('button', d).setAttribute('aria-expanded', 'false'); }
  });
  dds.forEach((dd) => {
    const btn = $('button', dd);
    const set = (open) => { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', () => { const o = !dd.classList.contains('open'); closeAll(dd); set(o); });
    let t;
    dd.addEventListener('mouseenter', () => { if (mobile()) return; clearTimeout(t); closeAll(dd); set(true); });
    dd.addEventListener('mouseleave', () => { if (mobile()) return; t = setTimeout(() => set(false), 120); });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.dd')) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAll(); setMenu(false); } });
  nav && nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  // Skugga på headern
  const header = $('header.site');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Öppet just nu (svensk tid, mån–fre 07–16)
  const openEl = $('[data-open]');
  if (openEl) {
    try {
      const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value || '';
      const day = get('weekday').toLowerCase();
      const mins = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10);
      const weekday = !/^(lör|sön)/.test(day);
      const open = weekday && mins >= 420 && mins < 960;
      $('.dot', openEl).classList.toggle('closed', !open);
      $('[data-open-text]', openEl).textContent = open ? 'Öppet nu · stänger 16.00' : 'Stängt just nu · öppet mån–fre 07–16';
    } catch (e) { /* behåll standardtexten */ }
  }

  // Flikar
  $$('[role="tablist"]').forEach((list) => {
    const tabs = $$('[role="tab"]', list);
    const show = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') show(tabs[(i + 1) % tabs.length], true);
        if (e.key === 'ArrowLeft') show(tabs[(i - 1 + tabs.length) % tabs.length], true);
      });
    });
    // Öppna rätt flik från länk (#svets osv.)
    const fromHash = tabs.find((t) => t.dataset.hash && '#' + t.dataset.hash === location.hash);
    if (fromHash) show(fromHash);
  });

  // Maskinfilter
  const cats = $$('.cats button');
  if (cats.length) {
    const groups = $$('.mgroup');
    const apply = (id) => {
      cats.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === id)));
      groups.forEach((g) => { g.hidden = id !== 'alla' && g.id !== id; });
    };
    cats.forEach((b) => b.addEventListener('click', () => apply(b.dataset.cat)));
    const h = location.hash.slice(1);
    if (h && groups.some((g) => g.id === h)) apply(h);
  }

  // Tjänster: dragspel (ett öppet åt gången, öppnas från #ankare)
  const accItems = $$('.acc-it');
  const setAcc = (it, open) => {
    it.classList.toggle('open', open);
    $('.acc-h', it).setAttribute('aria-expanded', String(open));
    $('.acc-b', it).hidden = !open;
  };
  accItems.forEach((it) => $('.acc-h', it).addEventListener('click', () => {
    const open = !it.classList.contains('open');
    accItems.forEach((o) => setAcc(o, o === it ? open : false));
  }));
  const openFromHash = () => {
    const t = location.hash && document.getElementById(location.hash.slice(1));
    if (t && t.classList.contains('acc-it')) { accItems.forEach((o) => setAcc(o, o === t)); t.scrollIntoView({ block: 'start' }); }
  };
  openFromHash();
  window.addEventListener('hashchange', openFromHash);

  // Årtal
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Bildvisning
  const shots = $$('[data-lightbox]');
  if (shots.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<img alt=""><button type="button" aria-label="Stäng bilden">&times;</button>';
    document.body.appendChild(box);
    const img = $('img', box);
    const btn = $('button', box);
    let last;
    const close = () => { box.classList.remove('open'); last && last.focus(); };
    shots.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault(); last = a;
      img.src = a.getAttribute('href'); img.alt = $('img', a)?.alt || '';
      box.classList.add('open'); btn.focus();
    }));
    box.addEventListener('click', (e) => { if (e.target !== img) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  }

  // Formulär via FormSubmit (AJAX, vanlig POST som reserv)
  const form = $('form[data-ajax]');
  if (form) {
    const status = $('.status', form);
    if (/skickat=1/.test(location.search)) { status.textContent = 'Tack! Ditt meddelande är skickat – vi återkommer så snart vi kan.'; status.className = 'status full ok'; }
    form.addEventListener('submit', async (e) => {
      if (!window.fetch) return;
      e.preventDefault();
      const btn = $('button[type="submit"]', form);
      const label = btn.innerHTML;
      btn.disabled = true; btn.textContent = 'Skickar…';
      status.className = 'status full';
      try {
        const res = await fetch(form.dataset.ajax, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        status.textContent = 'Tack! Ditt meddelande är skickat – vi återkommer så snart vi kan.';
        status.className = 'status full ok';
      } catch (err) {
        status.textContent = 'Något gick fel. Ring oss på 031-98 01 60 eller mejla info@surteformverkstad.se.';
        status.className = 'status full err';
      } finally { btn.disabled = false; btn.innerHTML = label; }
    });
  }
})();
