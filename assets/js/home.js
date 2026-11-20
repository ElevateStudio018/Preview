(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Process: the step indicator fills as you scroll and the matching polaroid lifts
  var stepsBox = document.querySelector('[data-steps]');
  if (stepsBox) {
    var dots = stepsBox.querySelectorAll('.steps__bar li');
    var cards = stepsBox.querySelectorAll('.polaroid');
    var updateSteps = function () {
      var rect = stepsBox.getBoundingClientRect();
      var start = window.innerHeight * 0.85, span = rect.height + window.innerHeight * 0.3;
      var p = reduced ? 1 : Math.min(1, Math.max(0, (start - rect.top) / span));
      var cur = Math.min(dots.length - 1, Math.floor(p * dots.length));
      stepsBox.style.setProperty('--progress', cur / (dots.length - 1));
      Array.prototype.forEach.call(dots, function (d, i) {
        d.classList.toggle('is-done', i < cur);
        d.classList.toggle('is-cur', i === cur);
      });
      Array.prototype.forEach.call(cards, function (c, i) {
        c.classList.toggle('is-on', reduced || i <= cur);
        c.classList.toggle('is-cur', !reduced && i === cur);
      });
    };
    window.addEventListener('scroll', updateSteps, { passive: true });
    window.addEventListener('resize', updateSteps);
    updateSteps();
  }

  // FAQ: opening one question closes the others (fallback for browsers without exclusive <details name>)
  var faqItems = document.querySelectorAll('.faq__item');
  Array.prototype.forEach.call(faqItems, function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      Array.prototype.forEach.call(faqItems, function (other) { if (other !== item) other.open = false; });
    });
  });

  // Process: the "thermometer" beside one picture. No scroll-jacking: the steps change by themselves
  // every few seconds (paused while the visitor points at or focuses the section) or when a step is clicked.
  var flow = document.querySelector('.process .flow');
  if (flow) {
    var steps = Array.prototype.slice.call(flow.querySelectorAll('.flow__step'));
    var wrap = document.createElement('div');
    wrap.className = 'pscroll';
    wrap.style.setProperty('--n', steps.length);
    wrap.innerHTML = '<div class="pscroll__sticky"><div class="pscroll__nav"><span class="pscroll__line"><i></i></span><ol></ol></div><div class="pscroll__stage"><div class="pscroll__pic"></div><div class="pscroll__texts" aria-live="polite"></div></div></div>';
    var navList = wrap.querySelector('ol'), pic = wrap.querySelector('.pscroll__pic'), texts = wrap.querySelector('.pscroll__texts'), fill = wrap.querySelector('.pscroll__line i');
    pic.appendChild(steps[0].querySelector('.flow__img'));
    steps.forEach(function (step, i) {
      var li = document.createElement('li');
      li.innerHTML = '<button type="button"><span class="pscroll__label"></span><span class="pscroll__dot"></span></button>';
      li.querySelector('.pscroll__label').textContent = step.querySelector('.flow__when').textContent;
      li.querySelector('button').addEventListener('click', function () { show(i); restart(); });
      navList.appendChild(li);
      var panel = document.createElement('div');
      panel.className = 'pscroll__panel';
      var no = document.createElement('p'); no.className = 'pscroll__no'; no.textContent = step.querySelector('.flow__no').textContent + ' / 0' + steps.length;
      panel.appendChild(no);
      panel.appendChild(step.querySelector('.flow__title'));
      panel.appendChild(step.querySelector('.flow__text'));
      texts.appendChild(panel);
    });
    flow.replaceWith(wrap);
    var navItems = navList.children, panels = texts.children, current = 0, timer = null, paused = false, seen = false;
    var show = function (i) {
      current = i;
      fill.style.height = (steps.length > 1 ? i / (steps.length - 1) * 100 : 100) + '%';
      for (var k = 0; k < steps.length; k++) {
        navItems[k].classList.toggle('is-on', k === i);
        navItems[k].classList.toggle('is-done', k < i);
        panels[k].classList.toggle('is-on', k === i);
        panels[k].setAttribute('aria-hidden', String(k !== i));
      }
    };
    var tick = function () { if (!paused && seen) show((current + 1) % steps.length); };
    var restart = function () { clearInterval(timer); if (!reduced) timer = setInterval(tick, 4500); };
    wrap.addEventListener('mouseenter', function () { paused = true; });
    wrap.addEventListener('mouseleave', function () { paused = false; });
    wrap.addEventListener('focusin', function () { paused = true; });
    wrap.addEventListener('focusout', function () { paused = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { seen = e[0].isIntersecting; }, { threshold: .35 }).observe(wrap); else seen = true;
    show(0); restart();
  }

  // Fade-up reveal for cards
  if (reduced || !('IntersectionObserver' in window)) return;
  var revealTargets = document.querySelectorAll('.case, .post-card, .platform-card, .pair');
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -60px 0px' });
  revealTargets.forEach(function (el) {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

  // Card rows slide up as they come into view, one after another (headings stay put)
  var rvObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      rvObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -40px 0px' });
  ['.bento__tile', '.svc-card', '.hp-proj__card', '.faq__item'].forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) {
      el.classList.add('rv');
      el.style.setProperty('--i', String(i % 6));
      rvObserver.observe(el);
    });
  });
  document.querySelectorAll('.hp-proj__devs').forEach(function (el) {
    el.classList.add('rv-devs');
    rvObserver.observe(el);
  });
})();
