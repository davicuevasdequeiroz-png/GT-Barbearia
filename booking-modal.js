(() => {
  const modal = document.getElementById('booking-modal');
  const openBtn = document.getElementById('booking-open');
  if (!modal || !openBtn) return;
  let lastFocus = null;

  const open = () => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('booking-open');
    if (window.gtLenis) window.gtLenis.stop();
    void modal.offsetWidth; // force reflow so the fade/scale transition runs
    modal.classList.add('is-open');
    modal.querySelector('.booking-option').focus({ preventScroll: true });
  };
  const close = () => {
    modal.classList.remove('is-open');
    document.body.classList.remove('booking-open');
    if (window.gtLenis) window.gtLenis.start();
    setTimeout(() => { if (!modal.classList.contains('is-open')) modal.hidden = true; }, 230);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };

  openBtn.addEventListener('click', open);
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-booking-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('a,button')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
