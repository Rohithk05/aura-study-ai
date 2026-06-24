import { fetchFromAppsScript, callAI } from './api.js';

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

    // Group plans by Date
    const groupedPlans = {};
    plans.forEach(plan => {
      const dateKey = plan.date || 'Syllabus Phase';
      if (!groupedPlans[dateKey]) groupedPlans[dateKey] = [];
      groupedPlans[dateKey].push(plan);
    });

    Object.keys(groupedPlans).forEach(date => {
      let slotsHTML = '';
      groupedPlans[date].forEach(p => {
        slotsHTML += `
          <div class="slot-item" style="border-left: 3px solid ${p.completed ? 'var(--color-success)' : 'var(--color-warning)'}; background: ${p.completed ? 'rgba(16, 185, 129, 0.01)' : 'rgba(245, 158, 11, 0.01)'};">
            <span class="slot-subject" style="display:flex; justify-content:space-between; align-items:center;">
              ${p.subject}
              <input type="checkbox" class="plan-checkbox" data-id="${p.id}" ${p.completed ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
            </span>
            <span class="slot-topic" style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${p.task}</span>
            <span class="slot-time-block" style="font-size:0.75rem; margin-top:4px;">Duration: ${p.duration} Mins</span>
          </div>
        `;
      });

      outputGrid.innerHTML += `
        <div class="glass-panel day-plan-card">
          <div class="day-plan-header">
            <span>${date} Plan</span>
          </div>
          <div class="day-plan-slots">
            ${slotsHTML}
          </div>
        </div>
      `;
    });

    // Bind checklist triggers
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
  const days = parseInt(document.getElementById('study-exam-days').value);
  const hours = parseInt(document.getElementById('study-hours').value);
  const weakSubject = document.getElementById('study-weak').value;

  if (!subjects) return;

  const outputGrid = document.getElementById('planner-output-box');
  const emptyEl = document.getElementById('planner-empty');

  emptyEl.style.display = 'none';
  outputGrid.style.display = 'grid';
  outputGrid.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Compiling customized study matrix...</span></div>`;

  const systemInstruction = `
    You are an AI Study Planner. Create a structured day-by-day revision timetable.
    You must respond ONLY with a raw JSON array of objects representing task blocks. Do not include markdown brackets, code blocks, or explanations. Just return the JSON content.
    Each object in the array must follow this schema:
    {
      "date": "Day 1",
      "subject": "Subject Name",
      "task": "Specific task topic detail",
      "duration": 120
    }
    Generate exactly 4-5 task slots covering the timeline, balancing difficult and easy subjects.
  `;

  const prompt = `Subjects: ${subjects}\nDays: ${days}\nDaily Study Hours: ${hours}\nWeak Focus: ${weakSubject}`;
  const response = await callAI(prompt, systemInstruction);

  try {
    const cleanJSON = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(cleanJSON);

    // Save plans to Sheets database
    const saveResult = await fetchFromAppsScript('saveStudyPlan', 'POST', { plan: plan });
    if (saveResult.success) {
      await loadPlannerView();
    } else {
      alert("Error saving study plans to sheets: " + saveResult.message);
    }
  } catch (err) {
    console.error("AI Planner output failed to compile:", err);
    alert("AI response could not be parsed. Loading standard local study blocks.");
    // Local mock load
    const mockPlan = [
      { date: "Day 1", subject: "DBMS", task: "Read relational logic and keys", duration: 120 },
      { date: "Day 1", subject: "Networks", task: "TCP vs UDP socket parameters", duration: 120 }
    ];
    await fetchFromAppsScript('saveStudyPlan', 'POST', { plan: mockPlan });
    await loadPlannerView();
  }
}

export async function toggleTaskCompleted(id, completed) {
  const result = await fetchFromAppsScript('updateStudyPlan', 'POST', { id: id, completed: completed });
  if (!result.success) {
    alert("Error updating plan task status: " + result.message);
  }
}
