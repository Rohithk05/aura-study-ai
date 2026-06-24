import { fetchFromAppsScript } from './api.js';

// Calculate days remaining helper
function getDaysRemaining(targetDateStr) {
  const target = new Date(targetDateStr + "T00:00:00");
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export async function loadDashboardView() {
  try {
    const result = await fetchFromAppsScript('getDashboard', 'GET');
    if (!result.success) {
      console.error("Failed to load dashboard metrics:", result.message);
      return;
    }

    const data = result.data;

    // 1. Update Core Stats Badges
    document.getElementById('stat-pending-tasks').textContent = data.pendingAssignments;
    document.getElementById('stat-classes').textContent = data.classesCount;
    document.getElementById('stat-completed').textContent = data.completedAssignments;

    // Calculate next exam countdown
    let examsCountText = "0";
    let examsSubtext = "No upcoming exams";
    if (data.upcomingClasses && data.upcomingClasses.length > 0) {
      // Pull count from local storage exams if present
      const localExams = JSON.parse(localStorage.getItem('aura_exams_db')) || [];
      if (localExams.length > 0) {
        const sorted = [...localExams].sort((a,b) => getDaysRemaining(a.date) - getDaysRemaining(b.date));
        const nearest = sorted[0];
        const days = getDaysRemaining(nearest.date);
        examsCountText = days > 0 ? days : "0";
        examsSubtext = `Days left: ${nearest.subject}`;
      }
    }
    
    // Fallback if not configured
    const statExams = document.getElementById('stat-exams');
    const statExamsSubtext = document.getElementById('stat-exams-subtext');
    if (statExams && statExamsSubtext) {
      statExams.textContent = examsCountText;
      statExamsSubtext.textContent = examsSubtext;
    }

    // 2. Render Today's Classes List on Dashboard
    const schedContainer = document.getElementById('dashboard-schedule-container');
    if (schedContainer) {
      schedContainer.innerHTML = '';
      if (!data.upcomingClasses || data.upcomingClasses.length === 0) {
        schedContainer.innerHTML = `<div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">No classes logged. Go to the Schedule tab to add your courses!</div>`;
      } else {
        data.upcomingClasses.forEach(c => {
          const isOnline = c.mode && c.mode.toLowerCase() === 'online';
          schedContainer.innerHTML += `
            <div class="sched-item">
              <div class="sched-time">${c.time}</div>
              <div class="sched-details">
                <span class="sched-subj">${c.subject}</span>
                <span class="sched-loc">${c.room ? 'Room ' + c.room : ''} ${c.faculty ? '• ' + c.faculty : ''}</span>
              </div>
              <span class="sched-badge ${isOnline ? 'online' : 'in-person'}">${c.mode || 'In-Person'}</span>
            </div>
          `;
        });
      }
    }

    // 3. Render Critical Assignments
    const assignContainer = document.getElementById('dashboard-assignments-container');
    if (assignContainer) {
      assignContainer.innerHTML = '';
      if (!data.criticalAssignments || data.criticalAssignments.length === 0) {
        assignContainer.innerHTML = `<div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">All caught up! No assignments pending.</div>`;
      } else {
        data.criticalAssignments.forEach(a => {
          const days = getDaysRemaining(a.dueDate);
          let dueText = `Due in ${days} days (${a.dueDate})`;
          if (days < 0) dueText = `Overdue! (${a.dueDate})`;
          if (days === 0) dueText = `Due TODAY!`;
          if (days === 1) dueText = `Due TOMORROW!`;

          assignContainer.innerHTML += `
            <div class="assign-item-mini">
              <div class="assign-info-mini">
                <span class="assign-title-mini">${a.title} <span class="badge priority-${a.priority.toLowerCase()}">${a.priority}</span></span>
                <span class="assign-due-mini" style="color: ${days <= 2 ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight: ${days <= 2 ? '600' : 'normal'};">
                  ${dueText}
                </span>
              </div>
              <span class="badge status-${a.status.toLowerCase().replace(' ', '-')}">${a.status}</span>
            </div>
          `;
        });
      }
    }
  } catch (err) {
    console.error("Dashboard compilation rendering failed:", err);
  }
}
