const modal = document.getElementById('new-post-modal');
if (modal?.dataset.open === 'true' && window.bootstrap) {
  bootstrap.Modal.getOrCreateInstance(modal).show();
}
