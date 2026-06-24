// Sidebar Controller Component

export function initSidebar() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle sidebar active highlights
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

export function updateActiveSidebarItem(viewId) {
  const target = document.querySelector(`.sidebar-menu .menu-item[data-view="${viewId}"]`);
  if (target) {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(i => i.classList.remove('active'));
    target.classList.add('active');
  }
}
