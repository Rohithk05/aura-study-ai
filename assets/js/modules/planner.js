import { fetchFromAppsScript } from '../api.js';

export async function loadPlannerView() {
  const outputGrid = document.getElementById('planner-output-box');
  const emptyEl = document.getElementById('planner-empty');

  if (!outputGrid || !emptyEl) return;

  try {
    const result = await fetchFromAppsScript('getStudyPlans', 'GET');
    if (!result.success) {
      console.error("Failed to fetch study plans:", result.message);
      return;
    }

    const plans = result.data;
    if (plans.length === 0) {
      emptyEl.style.display = 'flex';
      outputGrid.style.display = 'none';
      return;
    }

    emptyEl.style.display = 'none';
    outputGrid.style.display = 'grid';
    outputGrid.innerHTML = '';

    const groupedPlans = {};
    plans.forEach(plan => {
      const dateKey = plan.date || 'Study Block';
      if (!groupedPlans[dateKey]) groupedPlans[dateKey] = [];
      groupedPlans[dateKey].push(plan);
    });

    Object.keys(groupedPlans).forEach(date => {
      let slotsHTML = '';
      groupedPlans[date].forEach(p => {
        slotsHTML += `
          <div class="slot-item" style="border-left: 3px solid ${p.completed ? 'var(--color-success)' : 'var(--color-warning)'}; background: ${p.completed ? 'rgba(16, 185, 129, 0.01)' : 'rgba(245, 158, 11, 0.01)'}; margin-bottom:8px;">
            <span class="slot-subject" style="display:flex; justify-content:space-between; align-items:center; font-weight:600; font-size:0.9rem;">
              ${p.subject}
              <input type="checkbox" class="plan-checkbox" data-id="${p.id}" ${p.completed ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
            </span>
            <span class="slot-topic" style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${p.task}</span>
            <span class="slot-time-block" style="font-size:0.75rem; margin-top:4px; font-family:var(--font-mono); color:var(--color-accent);">Duration: ${p.duration} Mins</span>
          </div>
        `;
      });

      outputGrid.innerHTML += `
        <div class="glass-panel day-plan-card">
          <div class="day-plan-header" style="font-weight:700; font-size:1rem; border-bottom:1px solid var(--border-glass); padding-bottom:8px; margin-bottom:12px;">
            <span>${date} Plan</span>
          </div>
          <div class="day-plan-slots">
            ${slotsHTML}
          </div>
        </div>
      `;
    });

    // Checkbox completions binds
    outputGrid.querySelectorAll('.plan-checkbox').forEach(box => {
      box.addEventListener('change', async () => {
        const id = box.getAttribute('data-id');
        const completed = box.checked;
        await toggleTaskCompleted(id, completed);
      });
    });

  } catch (err) {
    console.error("Planner load failed:", err);
  }
}

export async function generateSyllabusPlan() {
  const subjects = document.getElementById('study-subjects').value.trim();
  const examDate = document.getElementById('study-exam-date') ? document.getElementById('study-exam-date').value : '';
  const hours = parseInt(document.getElementById('study-hours').value);
  const difficulty = document.getElementById('study-difficulty') ? document.getElementById('study-difficulty').value : 'Medium';
  const confidence = document.getElementById('study-confidence') ? document.getElementById('study-confidence').value : 'Medium';
  const weakTopics = document.getElementById('study-weak').value.trim();

  if (!subjects || !examDate || isNaN(hours)) {
    alert("Please enter subjects list, exam date, and available daily hours!");
    return;
  }

  const outputGrid = document.getElementById('planner-output-box');
  const emptyEl = document.getElementById('planner-empty');

  emptyEl.style.display = 'none';
  outputGrid.style.display = 'grid';
  outputGrid.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Llama 3.3 is compiling personalized syllabus plans...</span></div>`;

  try {
    const payload = {
      mode: 'studyplan',
      promptData: {
        subjects,
        examDate,
        hours,
        difficulty,
        confidence,
        weakTopics
      }
    };

    const result = await fetchFromAppsScript('ai', 'POST', payload);
    if (!result.success) {
      outputGrid.innerHTML = `<div class="empty-state-text" style="color: var(--color-danger);">AI study planner failed: ${result.message}</div>`;
      return;
    }

    // Clean JSON formatting
    let cleanJSON = result.data.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleanJSON);

    // Save plan array to sheets database
    const saveResult = await fetchFromAppsScript('saveStudyPlan', 'POST', { plan: plan });
    if (saveResult.success) {
      await loadPlannerView();
    } else {
      alert("Error saving plan to Google Sheets: " + saveResult.message);
    }
  } catch (err) {
    console.error("AI Planner output parsing failed:", err);
    alert("AI response could not be parsed. Loading standard local study blocks.");
    const mockPlan = [
      { date: "Day 1", subject: "DBMS Revisions", task: "Solve normal forms questions", duration: 120 },
      { date: "Day 1", subject: "Syllabus Break", task: "Rest", duration: 30 }
    ];
    await fetchFromAppsScript('saveStudyPlan', 'POST', { plan: mockPlan });
    await loadPlannerView();
  }
}

export async function toggleTaskCompleted(id, completed) {
  const result = await fetchFromAppsScript('updateStudyPlan', 'POST', { id: id, completed: completed });
  if (!result.success) {
    alert("Error updating study plan task status: " + result.message);
  }
}
