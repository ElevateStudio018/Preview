// The order page (bestall.html): the package comes preselected from ?plan= on the price page. Picking a package
// updates the summary and the meeting link; picking a way forward shows either the meeting button or the enquiry form.
(function () {
  var form = document.getElementById('bestall');
  if (!form) return;
  var plans = form.querySelectorAll('[data-plan]');
  var ways = form.querySelectorAll('[data-way]');
  var meet = form.querySelector('.js-co-meet');

  function pick(input) {
    // defaultChecked too, so the form's reset after sending keeps the choice
    input.checked = true;
    form.querySelectorAll('input[name="' + input.name + '"]').forEach(function (o) { o.defaultChecked = o === input; });
  }

  function show() {
    var plan = form.querySelector('[data-plan]:checked');
    var way = form.querySelector('[data-way]:checked');
    form.querySelectorAll('[data-sum]').forEach(function (s) { s.hidden = !plan || s.dataset.sum !== plan.dataset.plan; });
    form.querySelectorAll('[data-panel]').forEach(function (s) { s.hidden = !way || s.dataset.panel !== way.dataset.way; });
    if (plan) form.querySelectorAll('.js-co-name').forEach(function (s) { s.textContent = plan.dataset.name; });
    if (meet && plan) meet.href = meet.getAttribute('href').split('?')[0] + '?plan=' + plan.dataset.plan;
  }

  var q = new URLSearchParams(location.search);
  var want = (q.get('plan') || '').toLowerCase();
  plans.forEach(function (i) { if (i.dataset.plan === want) pick(i); });
  if (q.get('satt') === 'forfragan') ways.forEach(function (i) { if (i.dataset.way === 'ask') pick(i); });

  form.addEventListener('change', function (e) {
    if (e.target.matches('[data-plan], [data-way]')) {
      pick(e.target);
      show();
      if (e.target.dataset.plan && history.replaceState) history.replaceState(null, '', '?plan=' + e.target.dataset.plan);    }
  });
  if (meet) meet.addEventListener('click', function () { if (window.elevateTrack) window.elevateTrack('checkout', 'möte ' + (form.querySelector('[data-plan]:checked') || {}).value); });
  show();
})();
