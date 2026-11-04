(() => {
  // Mobilmeny
  const burger = document.querySelector('.burger');
  const nav = document.getElementById('meny');
  if (burger && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Stäng menyn' : 'Öppna menyn');
    };
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  // Skugga på headern vid scroll
  const header = document.querySelector('header.site');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Innehåll som glider in
  const els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add('in'));
  }

  // Årtal i footern
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // Bildvisning
  const links = document.querySelectorAll('[data-lightbox]');
  if (links.length) {
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<img alt=""><button type="button" aria-label="Stäng bilden">&times;</button>';
    document.body.appendChild(box);
    const img = box.querySelector('img');
    const btn = box.querySelector('button');
    let last = null;
    const close = () => { box.classList.remove('open'); if (last) last.focus(); };
    links.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      last = a;
      img.src = a.getAttribute('href');
      img.alt = a.querySelector('img')?.alt || '';
      box.classList.add('open');
      btn.focus();
    }));
    box.addEventListener('click', (e) => { if (e.target !== img) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
  }

  // Kontaktformulär (FormSubmit, AJAX med vanlig POST som reserv)
  const form = document.querySelector('form[data-ajax]');
  if (form) {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      if (!window.fetch) return;
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Skickar…';
      status.className = 'form-status';
      try {
        const res = await fetch(form.dataset.ajax, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = 'Tack! Ditt meddelande är skickat – vi återkommer så snart vi kan.';
        status.className = 'form-status ok';
      } catch (err) {
        status.textContent = 'Något gick fel. Ring oss gärna på 031-98 01 60 eller mejla info@surteformverkstad.se.';
        status.className = 'form-status err';
      } finally {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    });
  }
})();
