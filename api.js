import { APPS_SCRIPT_URL, GROQ_API_KEY } from './config.js';

// Central loader for visual spinner
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
// GOOGLE APPS SCRIPT CLIENT API
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
        // Apps Script receives text/plain to bypass complex preflight CORS options
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
    return result;
  } catch (err) {
    console.error("Apps Script Connection Failed:", err);
    toggleLoader(false);
    // Graceful fallback to LocalStorage mock so app stays completely runnable
    alert("Connection to Google Apps Script failed. Falling back to offline simulator.");
    return fetchLocalStorageMock(action, method, bodyData);
  }
}

// -------------------------------------------------------------
// GROQ AI llama-3.3-70b-versatile CLIENT API
// -------------------------------------------------------------

export async function callAI(prompt, systemInstruction) {
  if (!GROQ_API_KEY) {
    console.warn("GROQ_API_KEY is not set. Generating simulation fallback response.");
    return callAISimulator(prompt, systemInstruction);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices[0].message.content) {
      return data.choices[0].message.content;
    } else {
      throw new Error("Invalid output response structure from Groq.");
    }
  } catch (err) {
    console.error("Groq API Call failed:", err);
    alert("Groq API error. Running offline simulation fallback.");
    return callAISimulator(prompt, systemInstruction);
  }
}

// -------------------------------------------------------------
// OFFLINE FALLBACK ENGINE (LOCALSTORAGE ENGINE)
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
        return { success: true, data: newClass };
      case 'deleteSchedule':
        classes = classes.filter(c => c.id !== bodyData.id);
        localStorage.setItem('aura_classes_db', JSON.stringify(classes));
        return { success: true, message: 'Class deleted locally.' };
      case 'addAssignment':
        const newA = { id: 'ASG-' + Date.now(), ...bodyData, status: 'Pending', createdAt: new Date().toISOString() };
        assignments.push(newA);
        localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        return { success: true, data: newA };
      case 'updateAssignment':
        const aIndex = assignments.findIndex(a => a.id === bodyData.id);
        if (aIndex !== -1) {
          assignments[aIndex].status = bodyData.status;
          localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        }
        return { success: true, message: 'Assignment updated locally.' };
      case 'deleteAssignment':
        assignments = assignments.filter(a => a.id !== bodyData.id);
        localStorage.setItem('aura_assignments_db', JSON.stringify(assignments));
        return { success: true, message: 'Assignment deleted.' };
      case 'saveNotes':
        const newN = { id: 'NTE-' + Date.now(), ...bodyData, createdAt: new Date().toISOString() };
        notes.push(newN);
        localStorage.setItem('aura_notes_db', JSON.stringify(notes));
        return { success: true, data: newN };
      case 'saveStudyPlan':
        plans = bodyData.plan.map((p, idx) => ({ id: 'PLN-' + Date.now() + '-' + idx, ...p, completed: false }));
        localStorage.setItem('aura_plans_db', JSON.stringify(plans));
        return { success: true, message: 'Plan saved locally.' };
      case 'updateStudyPlan':
        const pIndex = plans.findIndex(p => p.id === bodyData.id);
        if (pIndex !== -1) {
          plans[pIndex].completed = bodyData.completed;
          localStorage.setItem('aura_plans_db', JSON.stringify(plans));
        }
        return { success: true, message: 'Plan task status updated.' };
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
        return { success: true, message: 'Progress updated.' };
    }
  }
}

function callAISimulator(prompt, systemInstruction) {
  // Return intelligent local mock responses
  if (systemInstruction.includes("note summarizer")) {
    return `
<h2>Summary: Advanced Concepts Compilation</h2>
<br>
<strong>MAIN LECTURE SUMMARY</strong><br>
- Condensed representation of dense notes inputs.<br>
- Visual maps outlining structure patterns.<br>
<br>
<strong>DEFINITIONS & CRITICAL CONCEPTS</strong><br>
- <em>Normalization:</em> Process of database structure organization to minimize redundancies.<br>
- <em>Redundancy:</em> Unnecessary duplication of data records across layers.<br>
<br>
<strong>EXAM STUDY REVISION NOTES</strong><br>
- Study 3NF normalization proofs. High likelihood of test questions.
    `;
  } else if (systemInstruction.includes("AI study coach")) {
    return JSON.stringify([
      {
        "dayNum": 1,
        "studyHours": 4,
        "slots": [
          { "timeLabel": "09:00 AM - 11:00 AM", "subject": "DBMS", "topic": "Normalization theory", "outcome": "Solve 3NF questions", "isWeakFocus": true },
          { "timeLabel": "02:00 PM - 04:00 PM", "subject": "Networks", "topic": "IP Routing protocols", "outcome": "Learn OSPF packet header", "isWeakFocus": false }
        ]
      }
    ]);
  } else if (prompt.includes("Flashcards")) {
    return `
- **Concept**: SRAM vs DRAM
  **Definition**: SRAM is cache memory using transistors (fast, expensive). DRAM is main system RAM using capacitors (slower, must refresh).
- **Concept**: Normalization Goal
  **Definition**: Organize database relations to reduce anomalies and remove dependencies.
    `;
  } else if (prompt.includes("Quiz")) {
    return `
1. **Question**: What is Thrashing in virtual memory?
   - **Answer**: A state where the CPU spends more time swapping pages in/out of secondary disk than executing instructions.
2. **Question**: What layer does Router operate on?
   - **Answer**: The Network Layer (Layer 3).
    `;
  }
  return "Operational Simulation Output. Enter your Groq API Key to enable the real Llama 3.3 AI Model.";
}
