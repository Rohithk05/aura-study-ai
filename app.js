import { loadDashboardView } from './dashboard.js';
import { loadScheduleView, addScheduleItem } from './schedule.js';
import { loadAssignmentsView, addAssignmentItem, updateAssignmentStatus } from './assignment.js';
import { loadNotesView, generateNoteSummary } from './notes.js';
import { loadPlannerView, generateSyllabusPlan } from './planner.js';
import { loadProgressView, updateProgressMetrics } from './progress.js';

// Global state trackers
let currentActiveView = 'dashboard';

// Clock updates
function initClock() {
  const clockEl = document.getElementById("clock-display");
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    
    // Simulate active baseline date + system hours
    clockEl.textContent = `2026-06-24 ${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

// Navigation View Controller
function initNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentViews = document.querySelectorAll('.content-view');
  const viewTitle = document.getElementById('view-title');

  menuItems.forEach(item => {
    item.addEventListener('click', async () => {
      const viewId = item.getAttribute('data-view');
      currentActiveView = viewId;
      
      // Update active list elements classes
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Toggle views display
      contentViews.forEach(view => {
        if (view.id === `view-${viewId}`) {
          view.classList.add('active-view');
        } else {
          view.classList.remove('active-view');
        }
      });

      // Headers titles mapping
      const titles = {
        'dashboard': 'Academic Dashboard',
        'schedule': 'Class schedules & Timetable',
        'assignments': 'Assignment Planner & Kanban',
        'notes': 'AI Notes Summarization',
        'planner': 'Study Timetable Planner',
        'progress': 'Academic Progress Card'
      };
      viewTitle.textContent = titles[viewId] || 'Academic Planner';

      // Load matching data dynamically from Sheets
      await refreshCurrentView();
    });
  });

  // Today schedule quick link on dashboard
  document.getElementById('btn-quick-schedule').addEventListener('click', () => {
    document.querySelector('[data-view="schedule"]').click();
  });
}

// Refresh active tab views
export async function refreshCurrentView() {
  switch (currentActiveView) {
    case 'dashboard':
      await loadDashboardView();
      break;
    case 'schedule':
      await loadScheduleView();
      break;
    case 'assignments':
      await loadAssignmentsView();
      break;
    case 'notes':
      await loadNotesView();
      break;
    case 'planner':
      await loadPlannerView();
      break;
    case 'progress':
      await loadProgressView();
      break;
  }
}

// Dark Mode Toggle
function initThemeController() {
  const btnToggle = document.getElementById('btn-toggle-theme');
  btnToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    
    const isDark = document.body.classList.contains('dark-mode');
    btnToggle.innerHTML = isDark ? `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="margin-right: 6px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      Toggle Light Mode
    ` : `
      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" style="margin-right: 6px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      Toggle Dark Mode
    `;
  });
}

// Bind Global forms submit handlers
function initEventBindings() {
  document.getElementById('form-add-class').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await addScheduleItem();
  });

  document.getElementById('form-add-assignment').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await addAssignmentItem();
  });

  document.getElementById('form-summarizer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await generateNoteSummary();
  });

  document.getElementById('form-study-planner').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await generateSyllabusPlan();
  });

  document.getElementById('form-add-progress').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await updateProgressMetrics();
  });

  // Global search filters
  document.getElementById('global-search').addEventListener('input', (ev) => {
    const query = ev.target.value.toLowerCase();
    filterPlannerContent(query);
  });
}

// Kanban Drag and Drop binds
function initKanbanDragDrop() {
  const cols = document.querySelectorAll('.kanban-col');
  cols.forEach(col => {
    col.addEventListener('dragover', (ev) => ev.preventDefault());
    col.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      let status = '';
      if (col.id === 'kanban-pending') status = 'Pending';
      if (col.id === 'kanban-progress') status = 'In Progress';
      if (col.id === 'kanban-completed') status = 'Completed';
      
      if (status && id) {
        await updateAssignmentStatus(id, status);
      }
    });
  });
}

// Simple text filter for tables/cards
function filterPlannerContent(query) {
  // Search and filter list items dynamically
  document.querySelectorAll('tbody tr').forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });

  document.querySelectorAll('.kanban-card').forEach(card => {
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(query) ? '' : 'none';
  });
}

// Page load hooks
window.addEventListener('DOMContentLoaded', async () => {
  initClock();
  initNavigation();
  initThemeController();
  initEventBindings();
  initKanbanDragDrop();

  // Load initial view
  await loadDashboardView();
});
