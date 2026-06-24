import { fetchFromAppsScript } from '../api.js';

export async function loadScheduleView() {
  const tbody = document.getElementById('schedule-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-primary);">Loading schedule...</td></tr>`;

  try {
    const result = await fetchFromAppsScript('getSchedule', 'GET');
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-danger);">Error: ${result.message}</td></tr>`;
      return;
    }

    const schedule = result.data;
    tbody.innerHTML = '';

    if (schedule.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No classes scheduled yet. Add your lectures using the form on the right!</td></tr>`;
      return;
    }

    const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    const sorted = [...schedule].sort((a, b) => (dayOrder[a.date] || 8) - (dayOrder[b.date] || 8));

    sorted.forEach(c => {
      const isOnline = c.mode && c.mode.toLowerCase() === 'online';
      tbody.innerHTML += `
        <tr>
          <td style="font-weight: 600;">${c.subject}</td>
          <td style="font-family: var(--font-mono); font-size: 0.85rem;">${c.time}</td>
          <td>${c.date}</td>
          <td>
            <span class="sched-badge ${isOnline ? 'online' : 'in-person'}">${c.mode || 'In-Person'}</span>
          </td>
          <td style="color: var(--text-secondary);">${c.faculty || '-'} ${c.room ? '(Room ' + c.room + ')' : ''}</td>
          <td>
            <button class="icon-btn delete-btn" data-id="${c.id}" title="Delete class">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm("Are you sure you want to remove this class?")) {
          await deleteScheduleItem(id);
        }
      });
    });
  } catch (err) {
    console.error("Failed to render Schedule list:", err);
  }
}

export async function addScheduleItem() {
  const subject = document.getElementById('class-subject').value.trim();
  const time = document.getElementById('class-time').value.trim();
  const date = document.getElementById('class-date').value.trim();
  const mode = document.getElementById('class-mode').value;
  const faculty = document.getElementById('class-notes').value.trim();
  const room = document.getElementById('class-room') ? document.getElementById('class-room').value.trim() : '';

  if (!subject || !time || !date) return;

  const payload = {
    subject,
    time,
    date,
    mode,
    faculty,
    room
  };

  const result = await fetchFromAppsScript('addSchedule', 'POST', payload);
  if (result.success) {
    document.getElementById('form-add-class').reset();
    await loadScheduleView();
  } else {
    alert("Error adding class: " + result.message);
  }
}

export async function deleteScheduleItem(id) {
  const result = await fetchFromAppsScript('deleteSchedule', 'POST', { id: id });
  if (result.success) {
    await loadScheduleView();
  } else {
    alert("Error deleting class: " + result.message);
  }
}
