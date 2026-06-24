import { fetchFromAppsScript } from '../api.js';

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

    // Render visual charts (SVG Bar and Pie Charts)
    renderSVGPieChart(progress);
    renderSVGBarGraph(progress);

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

// Renders an SVG bar chart of study hours per subject
function renderSVGBarGraph(progress) {
  const wrapper = document.getElementById('progress-bar-chart-container');
  if (!wrapper) return;

  const maxHours = Math.max(...progress.map(p => p.hoursStudied), 10);
  const chartHeight = 150;
  const barWidth = 40;
  const gap = 20;
  const startX = 30;

  let barsHTML = '';
  progress.forEach((p, idx) => {
    const x = startX + idx * (barWidth + gap);
    const barHeight = (p.hoursStudied / maxHours) * 110; // Scale height
    const y = chartHeight - barHeight - 20;

    barsHTML += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="var(--color-primary)" opacity="0.8"/>
      <text x="${x + barWidth / 2}" y="${y - 6}" font-size="9" fill="var(--text-primary)" text-anchor="middle" font-weight="bold">${p.hoursStudied}h</text>
      <text x="${x + barWidth / 2}" y="${chartHeight - 4}" font-size="8" fill="var(--text-muted)" text-anchor="middle">${p.subject.substring(0, 5)}..</text>
    `;
  });

  wrapper.innerHTML = `
    <svg width="100%" height="${chartHeight}" style="overflow: visible;">
      <!-- Grid line -->
      <line x1="10" y1="${chartHeight - 16}" x2="100%" y2="${chartHeight - 16}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
      ${barsHTML}
    </svg>
  `;
}

// Renders an SVG Pie Chart of topics completed
function renderSVGPieChart(progress) {
  const wrapper = document.getElementById('progress-pie-chart-container');
  if (!wrapper) return;

  const totalTopics = progress.reduce((acc, curr) => acc + curr.topicsCompleted, 0);
  if (totalTopics === 0) {
    wrapper.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--text-muted);">No topics completed to render distribution.</div>`;
    return;
  }

  const cx = 80;
  const cy = 80;
  const r = 50;
  let accumulatedAngle = 0;
  let pathsHTML = '';
  let legendHTML = '';

  const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-success)", "var(--color-warning)", "var(--color-danger)"];

  progress.forEach((p, idx) => {
    const angle = (p.topicsCompleted / totalTopics) * 360;
    const color = colors[idx % colors.length];

    // Coordinate Math for SVG Pie Slice Path
    const x1 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
    const y1 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
    
    accumulatedAngle += angle;
    
    const x2 = cx + r * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
    const y2 = cy + r * Math.sin((accumulatedAngle - 90) * Math.PI / 180);

    const largeArcFlag = angle > 180 ? 1 : 0;

    // Build SVG Path
    pathsHTML += `
      <path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" 
            fill="${color}" stroke="var(--bg-deep)" stroke-width="1.5" style="transition: transform 0.3s; transform-origin: ${cx}px ${cy}px;"
            onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
    `;

    // Legend
    legendHTML += `
      <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:var(--text-secondary);">
        <span style="width:12px; height:12px; border-radius:3px; background:${color};"></span>
        <span>${p.subject}: ${p.topicsCompleted} topics</span>
      </div>
    `;
  });

  wrapper.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; align-items:center; gap:20px;">
      <svg width="160" height="160" viewBox="0 0 160 160">
        ${pathsHTML}
        <!-- Core cutout ring for donut look -->
        <circle cx="${cx}" cy="${cy}" r="30" fill="var(--bg-glass-card)" />
      </svg>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${legendHTML}
      </div>
    </div>
  `;
}
