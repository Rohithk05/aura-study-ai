import { fetchFromAppsScript } from './api.js';

export async function loadProgressView() {
  const tableBody = document.getElementById('progress-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-primary);">Loading progress metrics...</td></tr>`;

  try {
    const result = await fetchFromAppsScript('getProgress', 'GET');
    if (!result.success) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-danger);">${result.message}</td></tr>`;
      return;
    }

    const progress = result.data;
    tableBody.innerHTML = '';

    if (progress.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No metrics logged yet. Update your subject progress on the right!</td></tr>`;
      return;
    }

    progress.forEach(p => {
      // Calculate completion visual bar (arbitrary target of 40 hours)
      const targetHours = 40;
      const progressPercent = Math.min(Math.round((p.hoursStudied / targetHours) * 100), 100);

      tableBody.innerHTML += `
        <tr>
          <td style="font-weight: 600;">${p.subject}</td>
          <td style="font-family: var(--font-mono);">${p.hoursStudied} Hrs</td>
          <td>${p.topicsCompleted} Topics</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="flex-grow: 1; height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 3px; overflow: hidden;">
                <div style="width: ${progressPercent}%; height: 100%; background: var(--gradient-success); box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);"></div>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-secondary);">${progressPercent}%</span>
            </div>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error("Progress metrics load failed:", err);
  }
}

export async function updateProgressMetrics() {
  const subject = document.getElementById('progress-subject').value.trim();
  const hoursStudied = parseInt(document.getElementById('progress-hours').value);
  const topicsCompleted = parseInt(document.getElementById('progress-topics').value);

  if (!subject || isNaN(hoursStudied) || isNaN(topicsCompleted)) return;

  const payload = {
    subject,
    hoursStudied,
    topicsCompleted
  };

  const result = await fetchFromAppsScript('updateProgress', 'POST', payload);
  if (result.success) {
    document.getElementById('form-add-progress').reset();
    await loadProgressView();
  } else {
    alert("Error updating progress metric: " + result.message);
  }
}
