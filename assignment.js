import { fetchFromAppsScript } from './api.js';

// Calculate days remaining helper
function getDaysRemaining(targetDateStr) {
  const target = new Date(targetDateStr + "T00:00:00");
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export async function loadAssignmentsView() {
  const listPending = document.getElementById('list-pending-tasks');
  const listProgress = document.getElementById('list-progress-tasks');
  const listCompleted = document.getElementById('list-completed-tasks');

  if (!listPending || !listProgress || !listCompleted) return;

  listPending.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;
  listProgress.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;
  listCompleted.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;

  try {
    const result = await fetchFromAppsScript('getAssignments', 'GET');
    if (!result.success) {
      listPending.innerHTML = `<div style="color: var(--color-danger);">${result.message}</div>`;
      return;
    }

    const assignments = result.data;
    listPending.innerHTML = '';
    listProgress.innerHTML = '';
    listCompleted.innerHTML = '';

    let countP = 0, countPr = 0, countC = 0;

    assignments.forEach(a => {
      const days = getDaysRemaining(a.dueDate);
      let dueStatusText = `${days} days left`;
      let isAlert = false;
      
      if (days < 0) {
        dueStatusText = `Overdue!`;
        isAlert = true;
      } else if (days === 0) {
        dueStatusText = `TODAY!`;
        isAlert = true;
      } else if (days === 1) {
        dueStatusText = `Tomorrow`;
        isAlert = true;
      }

      // Format clean status class strings
      const pClass = a.priority ? a.priority.toLowerCase() : 'medium';
      const statusClean = a.status ? a.status.toLowerCase().replace(' ', '-') : 'pending';

      const cardHTML = `
        <div class="kanban-card" draggable="true" data-id="${a.id}">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <span class="kanban-card-subj">${a.subject}</span>
            <span class="badge priority-${pClass}">${a.priority || 'Medium'}</span>
          </div>
          <div class="kanban-card-title">${a.title}</div>
          <div class="kanban-card-meta">
            <span class="kanban-card-due" style="color: ${isAlert && a.status !== 'Completed' ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight: ${isAlert && a.status !== 'Completed' ? '600' : 'normal'};">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${a.status === 'Completed' ? 'Completed' : dueStatusText}
            </span>
            <div class="kanban-card-actions">
              ${a.status !== 'Completed' ? `
                <button class="icon-btn complete-btn" data-id="${a.id}" title="Mark Completed">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              ` : ''}
              ${a.status === 'Pending' ? `
                <button class="icon-btn edit-btn" data-id="${a.id}" title="Move to In Progress">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              ` : ''}
              <button class="icon-btn delete-btn" data-id="${a.id}" title="Delete Assignment">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;

      if (a.status === 'Pending') {
        listPending.innerHTML += cardHTML;
        countP++;
      } else if (a.status === 'In Progress') {
        listProgress.innerHTML += cardHTML;
        countPr++;
      } else if (a.status === 'Completed') {
        listCompleted.innerHTML += cardHTML;
        countC++;
      }
    });

    document.getElementById('count-pending').textContent = countP;
    document.getElementById('count-progress').textContent = countPr;
    document.getElementById('count-completed').textContent = countC;

    // Attach Event Listeners to actions
    document.querySelectorAll('.kanban-card .complete-btn').forEach(btn => {
      btn.addEventListener('click', () => updateAssignmentStatus(btn.getAttribute('data-id'), 'Completed'));
    });
    document.querySelectorAll('.kanban-card .edit-btn').forEach(btn => {
      btn.addEventListener('click', () => updateAssignmentStatus(btn.getAttribute('data-id'), 'In Progress'));
    });
    document.querySelectorAll('.kanban-card .delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteAssignmentItem(btn.getAttribute('data-id')));
    });

    // Setup drag listeners for cards
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData("text/plain", card.getAttribute('data-id'));
      });
    });

  } catch (err) {
    console.error("Failed to render assignments list:", err);
  }
}

export async function addAssignmentItem() {
  const title = document.getElementById('assign-name').value.trim();
  const subject = document.getElementById('assign-subject').value.trim();
  const dueDate = document.getElementById('assign-due').value.trim();
  const priority = document.getElementById('assign-priority').value;
  const status = document.getElementById('assign-status').value;

  if (!title || !subject || !dueDate) return;

  const payload = {
    title,
    subject,
    dueDate,
    priority,
    status
  };

  const result = await fetchFromAppsScript('addAssignment', 'POST', payload);
  if (result.success) {
    document.getElementById('form-add-assignment').reset();
    await loadAssignmentsView();
  } else {
    alert("Error adding assignment: " + result.message);
  }
}

export async function updateAssignmentStatus(id, status) {
  const result = await fetchFromAppsScript('updateAssignment', 'POST', { id: id, status: status });
  if (result.success) {
    await loadAssignmentsView();
  } else {
    alert("Error updating assignment status: " + result.message);
  }
}

export async function deleteAssignmentItem(id) {
  if (confirm("Are you sure you want to delete this task?")) {
    const result = await fetchFromAppsScript('deleteAssignment', 'POST', { id: id });
    if (result.success) {
      await loadAssignmentsView();
    } else {
      alert("Error deleting assignment: " + result.message);
    }
  }
}
