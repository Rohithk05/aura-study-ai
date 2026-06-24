// Generic Modal Component Controller

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scrolling
  }
}

export function initModalBinds() {
  // Bind escape key and overlay clicks to dismiss modals
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const activeModals = document.querySelectorAll('.modal-overlay.active');
      activeModals.forEach(modal => closeModal(modal.id));
    }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}
