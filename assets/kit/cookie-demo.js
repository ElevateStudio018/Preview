// Cookie banner demo: shows the visitor's saved choice on the page
document.addEventListener('elevate:consent', function (e) { document.getElementById('out').textContent = 'Sparat val: ' + JSON.stringify(e.detail); });
