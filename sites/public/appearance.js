(() => {
  const key = 'mint-goals.appearance';
  let choice = 'system';
  try { choice = localStorage.getItem(key) || 'system'; } catch {}
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    const dark = choice === 'dark' || (choice !== 'light' && scheme.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#10241e' : '#eef4ed';
  }
  apply();
  scheme.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('theme');
    select.value = ['system','dark','light'].includes(choice) ? choice : 'system';
    select.addEventListener('change', () => {
      choice = select.value;
      try { localStorage.setItem(key, choice); } catch {}
      apply();
    });
  });
})();
