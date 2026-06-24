import { fetchFromAppsScript } from '../api.js';
import { getDaysRemaining } from '../utils/helpers.js';

export async function loadDashboardView() {
  try {
    const result = await fetchFromAppsScript('getDashboard', 'GET');
    if (!result.success) {
      console.error("Dashboard database fetch failed:", result.message);
      return;
    }

    const data = result.data;

    // 1. Core dashboard figures mapping
    const pendingCount = data.pendingAssignments || 0;
    const completedCount = data.completedAssignments || 0;
    const totalAssignments = pendingCount + completedCount;
    
    // Calculate completion percentage
    const completionPercent = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;
    
    // Load local exams to calculate nearest exam countdown days
    const localExams = JSON.parse(localStorage.getItem('aura_exams_db')) || [];
    let examDaysText = "0";
    let examLabel = "No upcoming exams";
    if (localExams.length > 0) {
      const sorted = [...localExams].sort((a,b) => getDaysRemaining(a.date) - getDaysRemaining(b.date));
      const nearest = sorted[0];
      const days = getDaysRemaining(nearest.date);
      examDaysText = days > 0 ? days : "0";
      examLabel = nearest.subject;
    }

    // Populate stats fields
    document.getElementById('stat-pending-tasks').textContent = pendingCount;
    document.getElementById('stat-classes').textContent = data.classesCount || 0;
    document.getElementById('stat-completed').textContent = completedCount;

    // 2. Render SVG progress circle for Completion Percentage
    const progressCard = document.getElementById('stat-completed').parentElement.parentElement;
    if (progressCard) {
      // Find or insert circular SVG gauge
      let gaugeWrapper = progressCard.querySelector('.svg-gauge-wrapper');
      if (!gaugeWrapper) {
        gaugeWrapper = document.createElement('div');
        gaugeWrapper.className = 'svg-gauge-wrapper';
        gaugeWrapper.style.cssText = "width: 55px; height: 55px; position: relative;";
        progressCard.appendChild(gaugeWrapper);
      }
      
      const strokeDashoffset = 126 - (126 * completionPercent) / 100;
      gaugeWrapper.innerHTML = `
        <svg width="55" height="55" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="4" />
          <circle cx="22" cy="22" r="20" fill="none" stroke="var(--color-success)" stroke-width="4" 
                  stroke-dasharray="126" stroke-dashoffset="${strokeDashoffset}" 
                  stroke-linecap="round" transform="rotate(-90 22 22)" style="transition: stroke-dashoffset 0.6s ease;"/>
        </svg>
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">
          ${completionPercent}%
        </div>
      `;
    }

    // 3. Render Today's Classes list
    const schedContainer = document.getElementById('dashboard-schedule-container');
    if (schedContainer) {
      schedContainer.innerHTML = '';
      if (!data.upcomingClasses || data.upcomingClasses.length === 0) {
        schedContainer.innerHTML = `
          <div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">
            No classes scheduled. Check the Schedule tab to add entries.
          </div>`;
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

    // 4. Render Critical Deadlines
    const assignContainer = document.getElementById('dashboard-assignments-container');
    if (assignContainer) {
      assignContainer.innerHTML = '';
      if (!data.criticalAssignments || data.criticalAssignments.length === 0) {
        assignContainer.innerHTML = `<div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">All caught up! No critical deadlines.</div>`;
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

    // 5. Append AI Recommendation based on exam date
    appendDashboardAIRecommendations(examDaysText, examLabel, pendingCount);

  } catch (err) {
    console.error("Dashboard compilation rendering failed:", err);
  }
}

function appendDashboardAIRecommendations(examDays, examLabel, pendingTasks) {
  const detailsGrid = document.querySelector('.dashboard-details');
  if (!detailsGrid) return;

  let adviceCard = document.getElementById('dashboard-ai-advice');
  if (!adviceCard) {
    adviceCard = document.createElement('div');
    adviceCard.id = 'dashboard-ai-advice';
    adviceCard.className = 'glass-panel detail-card';
    adviceCard.style.gridColumn = "1 / -1";
    adviceCard.style.marginTop = "24px";
    detailsGrid.appendChild(adviceCard);
  }

  let text = "Welcome back! Your academic dashboard is fully synchronized with Google Sheets.";
  let badgeColor = "var(--color-primary)";
  
  if (examDays !== "0" && Number(examDays) <= 5) {
    text = `🚨 **Critical Focus Required:** Your **${examLabel}** exam is in **${examDays} days**! Master your formula sheets and start a high-yield crash revision strategy today.`;
    badgeColor = "var(--color-danger)";
  } else if (pendingTasks > 3) {
    text = `⚠️ **Backlog Notice:** You have **${pendingTasks} pending assignments** in your Kanban board. Prioritize the high-urgency tasks in the To-Do list to get back on track.`;
    badgeColor = "var(--color-warning)";
  } else {
    text = `🌟 **Steady Progress:** You are maintaining a balanced study load. Use the **AI Note Summarizer** to build flashcards and prepare for upcoming classes ahead of time.`;
  }

  adviceCard.innerHTML = `
    <div class="card-header">
      <h3>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="stroke: ${badgeColor};"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/></svg>
        AI Academic Coach Recommendations
      </h3>
    </div>
    <div style="font-size: 0.95rem; line-height: 1.5; color: var(--text-primary);">
      ${text}
    </div>
  `;
}
