import { fetchFromAppsScript } from '../api.js';
import { getDaysRemaining } from '../utils/helpers.js';

export async function loadAssignmentsView() {
  const listTodo = document.getElementById('list-todo-tasks') || document.getElementById('list-pending-tasks');
  const listProgress = document.getElementById('list-progress-tasks');
  const listReview = document.getElementById('list-review-tasks');
  const listCompleted = document.getElementById('list-completed-tasks');

  if (!listTodo || !listProgress || !listCompleted) return;

  // Set loading states
  listTodo.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;
  listProgress.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;
  if (listReview) listReview.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;
  listCompleted.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading...</div>`;

  try {
    const result = await fetchFromAppsScript('getAssignments', 'GET');
    if (!result.success) {
      listTodo.innerHTML = `<div style="color: var(--color-danger);">${result.message}</div>`;
      return;
    }

    const assignments = result.data;
    listTodo.innerHTML = '';
    listProgress.innerHTML = '';
    if (listReview) listReview.innerHTML = '';
    listCompleted.innerHTML = '';

    let countTodo = 0, countProg = 0, countReview = 0, countCompleted = 0;

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

      const pClass = a.priority ? a.priority.toLowerCase() : 'medium';
      
      // Normalize statuses to match columns
      let statusKey = a.status || 'To Do';
      if (statusKey === 'Pending') statusKey = 'To Do'; // Merge synonyms

      const cardHTML = `
        <div class="kanban-card" draggable="true" data-id="${a.id}">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <span class="kanban-card-subj">${a.subject}</span>
            <span class="badge priority-${pClass}">${a.priority || 'Medium'}</span>
          </div>
          <div class="kanban-card-title">${a.title}</div>
          <div class="kanban-card-meta">
            <span class="kanban-card-due" style="color: ${isAlert && statusKey !== 'Completed' ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight: ${isAlert && statusKey !== 'Completed' ? '600' : 'normal'};">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${statusKey === 'Completed' ? 'Completed' : dueStatusText}
            </span>
            <div class="kanban-card-actions">
              ${statusKey === 'To Do' ? `
                <button class="icon-btn edit-btn" data-id="${a.id}" data-action="progress" title="Move to In Progress">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              ` : ''}
              ${statusKey === 'In Progress' ? `
                <button class="icon-btn edit-btn" style="stroke: var(--color-warning);" data-id="${a.id}" data-action="review" title="Move to Review">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 11.08 22 12 2 12"/><polyline points="12 2 2 12 12 22"/></svg>
                </button>
              ` : ''}
              ${statusKey === 'Review' ? `
                <button class="icon-btn complete-btn" data-id="${a.id}" data-action="complete" title="Approve & Complete">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              ` : ''}
              <button class="icon-btn delete-btn" data-id="${a.id}" title="Delete Assignment">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;

      if (statusKey === 'To Do') {
        listTodo.innerHTML += cardHTML;
        countTodo++;
      } else if (statusKey === 'In Progress') {
        listProgress.innerHTML += cardHTML;
        countProg++;
      } else if (statusKey === 'Review') {
        if (listReview) {
          listReview.innerHTML += cardHTML;
          countReview++;
        }
      } else if (statusKey === 'Completed') {
        listCompleted.innerHTML += cardHTML;
        countCompleted++;
      }
    });

    // Update headers text counts
    const todoCountEl = document.getElementById('count-todo') || document.getElementById('count-pending');
    if (todoCountEl) todoCountEl.textContent = countTodo;
    
    const progCountEl = document.getElementById('count-progress');
    if (progCountEl) progCountEl.textContent = countProg;

    const reviewCountEl = document.getElementById('count-review');
    if (reviewCountEl) reviewCountEl.textContent = countReview;

    const compCountEl = document.getElementById('count-completed');
    if (compCountEl) compCountEl.textContent = countCompleted;

    // Attach actions event listeners
    document.querySelectorAll('.kanban-card-actions button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (btn.classList.contains('delete-btn')) {
          await deleteAssignmentItem(id);
        } else {
          const actionType = btn.getAttribute('data-action');
          let targetStatus = 'To Do';
          if (actionType === 'progress') targetStatus = 'In Progress';
          if (actionType === 'review') targetStatus = 'Review';
          if (actionType === 'complete') targetStatus = 'Completed';
          await updateAssignmentStatus(id, targetStatus);
        }
      });
    });

    // Staging drag event binds
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData("text/plain", card.getAttribute('data-id'));
      });
    });

  } catch (err) {
    console.error("Failed to render assignments Kanban view:", err);
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
