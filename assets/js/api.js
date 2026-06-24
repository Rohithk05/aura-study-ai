import { APPS_SCRIPT_URL } from './config.js';
import { showToast } from './components/toast.js';

export function toggleLoader(show) {
  const syncStatus = document.getElementById('sync-status');
  if (!syncStatus) return;
  if (show) {
    syncStatus.classList.add('syncing');
    syncStatus.innerHTML = `<span class="sync-dot" style="color: var(--color-warning);">●</span> Database Syncing...`;
  } else {
    syncStatus.classList.remove('syncing');
    syncStatus.innerHTML = `<span class="sync-dot" style="color: var(--color-success);">●</span> Live Sheets Active`;
  }
}

// -------------------------------------------------------------
// GOOGLE APPS SCRIPT WEB SERVICE FETCH CLIENT
// -------------------------------------------------------------

export async function fetchFromAppsScript(action, method = 'GET', bodyData = null) {
  if (!APPS_SCRIPT_URL) {
    console.warn("APPS_SCRIPT_URL is not set. Operating in Offline LocalStorage Mode.");
    return fetchLocalStorageMock(action, method, bodyData);
  }

  toggleLoader(true);
  try {
    let url = APPS_SCRIPT_URL;
    let options = {
      method: method,
      mode: 'cors'
    };

    if (method === 'GET') {
      url += `?action=${action}`;
    } else if (method === 'POST') {
      options.headers = {
        'Content-Type': 'text/plain;charset=utf-8'
      };
      options.body = JSON.stringify({
        action: action,
        ...bodyData
      });
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    toggleLoader(false);
    
    if (result.success) {
      // Toast notification for modifying actions
      if (method === 'POST' && action !== 'ai') {
        showToast("Database updated successfully!", "success");
      }
    } else {
      showToast(result.message || "Database action failed", "error");
    }
    
    return result;
  } catch (err) {
    console.error("Apps Script Connection Failed:", err);
    toggleLoader(false);
    showToast("Apps Script connection failed. Loading local database.", "error");
    return fetchLocalStorageMock(action, method, bodyData);
  }
}

// -------------------------------------------------------------
// OFFLINE FALLBACK MOCK ENGINE
// -------------------------------------------------------------

function fetchLocalStorageMock(action, method, bodyData) {
  let classes = JSON.parse(localStorage.getItem('aura_classes_db')) || [];
  let assignments = JSON.parse(localStorage.getItem('aura_assignments_db')) || [];
  let notes = JSON.parse(localStorage.getItem('aura_notes_db')) || [];
  let plans = JSON.parse(localStorage.getItem('aura_plans_db')) || [];
  let progress = JSON.parse(localStorage.getItem('aura_progress_db')) || [];

  if (method === 'GET') {
    switch (action) {
      case 'getSchedule':
        return { success: true, data: classes };
      case 'getAssignments':
        return { success: true, data: assignments };
      case 'getNotes':
        return { success: true, data: notes };
      case 'getStudyPlans':
        return { success: true, data: plans };
      case 'getProgress':
        return { success: true, data: progress };
      case 'getDashboard':
        return {
          success: true,
          data: {
            classesCount: classes.length,
            pendingAssignments: assignments.filter(a => a.status !== 'Completed').length,
            completedAssignments: assignments.filter(a => a.status === 'Completed').length,
            notesCount: notes.length,
            hoursStudied: progress.reduce((acc, curr) => acc + Number(curr.hoursStudied), 0),
            upcomingClasses: classes.slice(0, 3),
            criticalAssignments: assignments.filter(a => a.status !== 'Completed').sort((a,b) => (b.priority === 'High' ? 1 : -1)).slice(0, 3),
            studyPlans: plans,
            recentNotes: notes.slice(-3).reverse(),
            progressSummary: progress
          }
        };
    }
  } else {
    // POST methods
    switch (action) {
      case 'addSchedule':
        const newClass = { id: 'SCH-' + Date.now(), ...bodyData, createdAt: new Date().toISOString() };
        classes.push(newClass);
        localStorage.setItem('aura_classes_db', JSON.stringify(classes));
        showToast("Class scheduled locally!", "success");
        return { success: true, data: newClass };
      case 'deleteSchedule':
        classes = classes.filter(c => c.id !== bodyData.id);
        localStorage.setItem('aura_classes_db', JSON.stringify(classes));
        showToast("Class removed locally.", "success");
        return { success: true, message: 'Class deleted.' };
      case 'addAssignment':
        const newA = { id: 'ASG-' + Date.now(), ...bodyData, createdAt: new Date().toISOString() };
        assignments.push(newA);
        localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        showToast("Task added locally!", "success");
        return { success: true, data: newA };
      case 'updateAssignment':
        const aIndex = assignments.findIndex(a => a.id === bodyData.id);
        if (aIndex !== -1) {
          assignments[aIndex].status = bodyData.status;
          localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        }
        showToast("Task updated locally.", "success");
        return { success: true, message: 'Assignment updated.' };
      case 'deleteAssignment':
        assignments = assignments.filter(a => a.id !== bodyData.id);
        localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        showToast("Task deleted.", "success");
        return { success: true, message: 'Assignment deleted.' };
      case 'saveNotes':
        const newN = { id: 'NTE-' + Date.now(), ...bodyData, createdAt: new Date().toISOString() };
        notes.push(newN);
        localStorage.setItem('aura_notes_db', JSON.stringify(notes));
        showToast("AI Summary saved locally!", "success");
        return { success: true, data: newN };
      case 'saveStudyPlan':
        plans = bodyData.plan.map((p, idx) => ({ id: 'PLN-' + Date.now() + '-' + idx, ...p, completed: false }));
        localStorage.setItem('aura_plans_db', JSON.stringify(plans));
        showToast("Study plans generated locally!", "success");
        return { success: true, message: 'Plan saved.' };
      case 'updateStudyPlan':
        const pIndex = plans.findIndex(p => p.id === bodyData.id);
        if (pIndex !== -1) {
          plans[pIndex].completed = bodyData.completed;
          localStorage.setItem('aura_plans_db', JSON.stringify(plans));
        }
        showToast("Plan check updated.", "success");
        return { success: true, message: 'Plan updated.' };
      case 'updateProgress':
        const prgIndex = progress.findIndex(p => p.subject.toLowerCase() === bodyData.subject.toLowerCase());
        if (prgIndex !== -1) {
          progress[prgIndex].hoursStudied = bodyData.hoursStudied;
          progress[prgIndex].topicsCompleted = bodyData.topicsCompleted;
          progress[prgIndex].updatedAt = new Date().toISOString();
        } else {
          progress.push({ id: 'PRG-' + Date.now(), subject: bodyData.subject, hoursStudied: bodyData.hoursStudied, topicsCompleted: bodyData.topicsCompleted, updatedAt: new Date().toISOString() });
        }
        localStorage.setItem('aura_progress_db', JSON.stringify(progress));
        showToast("Progress logged locally!", "success");
        return { success: true, message: 'Progress updated.' };
      case 'ai':
        // Offline Local Mock Responses
        if (bodyData.mode === 'summarize') {
          return {
            success: true,
            data: JSON.stringify({
              summary: "A local mock overview summary representing your lecture notes content.",
              keyConcepts: ["Syllabus Milestones", "Normal Forms", "IP Address Routing"],
              definitions: [{ term: "Normalization", description: "Process of reducing redundances in database structures." }],
              formulas: ["Hours studied = Duration / 60"],
              interviewQuestions: [{ question: "What is 3NF?", answer: "Third Normal Form removes transitive dependencies." }],
              examQuestions: [{ question: "Prove BCNF satisfies 3NF?", answer: "BCNF is a stricter form of 3NF." }],
              flashcards: [{ front: "SRAM component", back: "Transistors cache cell" }],
              revisionTips: ["Focus on subnet masks calculations", "Solve past normal forms queries"]
            })
          };
        } else if (bodyData.mode === 'studyplan') {
          return {
            success: true,
            data: JSON.stringify([
              { date: "Day 1", subject: "DBMS", task: "Normal Forms theory revisions", duration: 120, isBreak: false },
              { date: "Day 1", subject: "Syllabus Break", task: "Rest & Hydrate", duration: 30, isBreak: true },
              { date: "Day 2", subject: "Computer Networks", task: "IP Header routing tables", duration: 120, isBreak: false }
            ])
          };
        } else if (bodyData.mode === 'chat') {
          return {
            success: true,
            data: "This is a local simulation response. Set up your Google Apps Script URL and save your GROQ_API_KEY in script settings to activate real Llama AI!"
          };
        }
    }
  }
}
