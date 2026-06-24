import { initSidebar, updateActiveSidebarItem } from './components/sidebar.js';
import { initModalBinds } from './components/modal.js';
import { loadDashboardView } from './modules/dashboard.js';
import { loadScheduleView, addScheduleItem } from './modules/schedule.js';
import { loadAssignmentsView, addAssignmentItem, updateAssignmentStatus } from './modules/assignment.js';
import { loadNotesView, generateNoteSummary } from './modules/notes.js';
import { loadPlannerView, generateSyllabusPlan } from './modules/planner.js';
import { loadProgressView, updateProgressMetrics } from './modules/progress.js';
import { fetchFromAppsScript } from './api.js';

let currentActiveView = 'dashboard';

// Clock updates
function initClock() {
  const clockEl = document.getElementById("clock-display");
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `2026-06-24 ${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

// Routing view loader
async function refreshCurrentView() {
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

// Bind Navigation
function initNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentViews = document.querySelectorAll('.content-view');
  const viewTitle = document.getElementById('view-title');

  menuItems.forEach(item => {
    item.addEventListener('click', async () => {
      const viewId = item.getAttribute('data-view');
      currentActiveView = viewId;

      contentViews.forEach(view => {
        if (view.id === `view-${viewId}`) {
          view.classList.add('active-view');
        } else {
          view.classList.remove('active-view');
        }
      });

      const titles = {
        'dashboard': 'Academic Dashboard',
        'schedule': 'Class Planner & Schedules',
        'assignments': 'Assignment Tracker Kanban',
        'notes': 'AI Note Summarizer',
        'planner': 'Study Timetable Planner',
        'progress': 'Academic Progress Card'
      };
      viewTitle.textContent = titles[viewId] || 'Academic Planner';

      await refreshCurrentView();
    });
  });
}

// Theme controls
function initThemeController() {
  const btnToggle = document.getElementById('btn-toggle-theme');
  if (!btnToggle) return;
  
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

// Floating AI assistant triggers
function initFloatingAIAssistant() {
  const btnFloat = document.getElementById('btn-float-ai');
  const chatContainer = document.getElementById('floating-chat-container');
  const btnClose = document.getElementById('btn-close-float-chat');
  const btnSend = document.getElementById('btn-float-chat-send');
  const chatInput = document.getElementById('float-chat-input');
  const historyBox = document.getElementById('float-chat-history');

  if (!btnFloat || !chatContainer) return;

  btnFloat.addEventListener('click', () => {
    chatContainer.classList.toggle('active');
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      chatContainer.classList.remove('active');
    });
  }

  async function sendAssistantMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Print user bubble
    historyBox.innerHTML += `
      <div style="align-self: flex-end; background: var(--gradient-glow); color: #fff; padding: 8px 12px; border-radius: 12px 12px 2px 12px; font-size: 0.85rem; max-width: 80%; line-height: 1.4; margin-bottom: 10px;">
        ${text}
      </div>
    `;
    chatInput.value = '';
    historyBox.scrollTop = historyBox.scrollHeight;

    // Loading indicator
    const loadBubble = document.createElement('div');
    loadBubble.style.cssText = "align-self: flex-start; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); color: var(--text-primary); padding: 8px 12px; border-radius: 12px 12px 12px 2px; font-size: 0.85rem; max-width: 80%; line-height: 1.4; margin-bottom: 10px;";
    loadBubble.innerHTML = `<span style="animation: pulseLight 1s infinite alternate;">AURA typing...</span>`;
    historyBox.appendChild(loadBubble);
    historyBox.scrollTop = historyBox.scrollHeight;

    try {
      const result = await fetchFromAppsScript('ai', 'POST', {
        mode: 'chat',
        promptData: { text: text }
      });
      loadBubble.remove();
      
      let reply = "Google Apps Script error: No response received.";
      if (result.success) {
        reply = result.data.replace(/\n/g, '<br>');
      }

      historyBox.innerHTML += `
        <div style="align-self: flex-start; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); color: var(--text-primary); padding: 8px 12px; border-radius: 12px 12px 12px 2px; font-size: 0.85rem; max-width: 80%; line-height: 1.4; margin-bottom: 10px;">
          ${reply}
        </div>
      `;
    } catch {
      loadBubble.remove();
      historyBox.innerHTML += `
        <div style="align-self: flex-start; background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); color: var(--color-danger); padding: 8px 12px; border-radius: 12px 12px 12px 2px; font-size: 0.85rem; max-width: 80%; line-height: 1.4; margin-bottom: 10px;">
          Error connecting to AI router. Verify script settings.
        </div>
      `;
    }
    historyBox.scrollTop = historyBox.scrollHeight;
  }

  if (btnSend) {
    btnSend.addEventListener('click', sendAssistantMessage);
  }
  if (chatInput) {
    chatInput.addEventListener('keypress', (ev) => {
      if (ev.key === 'Enter') sendAssistantMessage();
    });
  }
}

// Binds CRUD forms triggers
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
    document.querySelectorAll('tbody tr').forEach(row => {
      row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.style.display = card.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
  });
}

// Kanban drag binds
function initKanbanDragDrop() {
  const cols = document.querySelectorAll('.kanban-col');
  cols.forEach(col => {
    col.addEventListener('dragover', (ev) => ev.preventDefault());
    col.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      let status = '';
      if (col.id === 'kanban-todo') status = 'To Do';
      if (col.id === 'kanban-progress') status = 'In Progress';
      if (col.id === 'kanban-review') status = 'Review';
      if (col.id === 'kanban-completed') status = 'Completed';
      
      if (status && id) {
        await updateAssignmentStatus(id, status);
      }
    });
  });
}

// App bootstrapping
window.addEventListener('DOMContentLoaded', async () => {
  initClock();
  initSidebar();
  initModalBinds();
  initNavigation();
  initThemeController();
  initFloatingAIAssistant();
  initEventBindings();
  initKanbanDragDrop();

  // Load dashboard on boot
  await loadDashboardView();
});
