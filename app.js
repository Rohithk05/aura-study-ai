/**
 * AURA Study AI - Core JavaScript Controller with Real API Integrations
 * Supporting Google Identity Services (OAuth 2.0), Google Sheets, Calendar, and Gemini 1.5 Flash API
 */

// Simulated Baseline Semester Date
const baselineDateStr = "2026-06-24";

// Credentials state loaded from LocalStorage
let credentials = {
  geminiKey: localStorage.getItem('aura_gemini_key') || '',
  googleClientId: localStorage.getItem('aura_google_client_id') || '1054044990924-f7b5qghgocgl34vsqepm3p9kki93k039.apps.googleusercontent.com' // Fallback public client ID
};

let state = {
  classes: JSON.parse(localStorage.getItem('aura_classes')) || [
    { id: 1, subject: "Database Management Systems", time: "10:00 AM - 11:30 AM", date: "Wednesday", mode: "In-Person", notes: "Room 402, Lecture Hall B" },
    { id: 2, subject: "Computer Networks", time: "01:00 PM - 02:30 PM", date: "Wednesday", mode: "Online", notes: "Zoom link: meet.google.com/xyz-123" },
    { id: 3, subject: "Software Engineering", time: "11:30 AM - 01:00 PM", date: "Friday", mode: "In-Person", notes: "Lab 3, Main Block" }
  ],
  assignments: JSON.parse(localStorage.getItem('aura_assignments')) || [
    { id: 1, name: "DBMS Assignment 2", subject: "DBMS", due: "2026-07-02", status: "Pending", priority: "High" },
    { id: 2, name: "CN Lab Manual", subject: "Computer Networks", due: "2026-06-29", status: "In Progress", priority: "High" },
    { id: 3, name: "SE Requirement Document", subject: "Software Engineering", due: "2026-07-08", status: "Pending", priority: "Medium" }
  ],
  exams: JSON.parse(localStorage.getItem('aura_exams')) || [
    { id: 1, subject: "DBMS Midterm", date: "2026-07-04", notes: "Chapters 1-5, Normalization" },
    { id: 2, subject: "Computer Networks Endterm", date: "2026-07-14", notes: "Routing protocols & sockets" }
  ],
  chatHistory: JSON.parse(localStorage.getItem('aura_chat')) || [
    { sender: "assistant", text: "Hello! I am your AI academic planner. Enter your <strong>Gemini API Key</strong> in the Settings modal (bottom left) to connect this to real AI models!" }
  ]
};

// Google OAuth states
let tokenClient = null;
let googleAccessToken = null;
let spreadsheetId = localStorage.getItem('aura_spreadsheet_id') || null;

// Save state back to localStorage cache
function saveCache() {
  localStorage.setItem('aura_classes', JSON.stringify(state.classes));
  localStorage.setItem('aura_assignments', JSON.stringify(state.assignments));
  localStorage.setItem('aura_exams', JSON.stringify(state.exams));
  localStorage.setItem('aura_chat', JSON.stringify(state.chatHistory));
  updateUI();
}

// -------------------------------------------------------------
// GOOGLE CLOUD OAUTH & APIS INTEGRATION
// -------------------------------------------------------------

function initGoogleApis() {
  // 1. Initialize Google API Client library
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        // Sheets & Calendar Discovery Documents
        discoveryDocs: [
          'https://sheets.googleapis.com/v4/discovery?version=v4',
          'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
          'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
        ],
      });
      console.log('GAPI client discovery initialized.');
      checkActiveToken();
    } catch (err) {
      console.error('Error initializing GAPI client:', err);
    }
  });

  // 2. Initialize Google Identity Services Token Client
  if (credentials.googleClientId) {
    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: credentials.googleClientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file email profile',
        callback: async (resp) => {
          if (resp.error !== undefined) {
            throw (resp);
          }
          googleAccessToken = resp.access_token;
          localStorage.setItem('aura_google_token', googleAccessToken);
          
          // Set access token for GAPI
          gapi.client.setToken({ access_token: googleAccessToken });
          
          // Get user metadata
          await fetchUserProfile();
          updateConnectionStatus('google', 'online', 'Google Sheets Connected');
          
          // Sync database sheet
          triggerSyncFeedback('Initializing Google Sheets Sync...');
          await syncWithGoogleSheets();
        },
      });
      console.log('GIS Token Client initialized.');
    } catch (err) {
      console.error('Error initializing GIS Client:', err);
    }
  }
}

async function fetchUserProfile() {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleAccessToken}` }
    });
    const profile = await resp.json();
    
    document.getElementById('google-user-name').textContent = profile.name || 'Logged In Student';
    document.getElementById('google-user-email').textContent = profile.email || 'Google Account Linked';
    
    if (profile.picture) {
      document.getElementById('profile-avatar').innerHTML = `<img src="${profile.picture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }
    
    document.getElementById('btn-google-login').style.display = 'none';
    document.getElementById('btn-google-logout').style.display = 'block';
  } catch (err) {
    console.error('Error fetching user profile:', err);
  }
}

function checkActiveToken() {
  const cachedToken = localStorage.getItem('aura_google_token');
  if (cachedToken) {
    googleAccessToken = cachedToken;
    gapi.client.setToken({ access_token: googleAccessToken });
    fetchUserProfile();
    updateConnectionStatus('google', 'online', 'Google Sheets Connected');
    // Periodically verify or sync sheets data
    syncWithGoogleSheets();
  }
}

function handleAuthClick() {
  if (!tokenClient) {
    alert("Google Identity Client is loading or missing. Please verify your Client ID in Settings!");
    return;
  }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function handleSignoutClick() {
  if (googleAccessToken) {
    google.accounts.oauth2.revoke(googleAccessToken, () => {
      googleAccessToken = null;
      localStorage.removeItem('aura_google_token');
      localStorage.removeItem('aura_spreadsheet_id');
      spreadsheetId = null;
      
      document.getElementById('google-user-name').textContent = 'Guest Student';
      document.getElementById('google-user-email').textContent = 'Not Signed In';
      document.getElementById('profile-avatar').textContent = 'G';
      document.getElementById('btn-google-login').style.display = 'block';
      document.getElementById('btn-google-logout').style.display = 'none';
      
      updateConnectionStatus('google', 'offline', 'Google Sheets Offline');
      triggerSyncFeedback('Disconnected Google Sheets');
    });
  }
}

// -------------------------------------------------------------
// GOOGLE SHEETS SYNC CONTROLLER
// -------------------------------------------------------------

async function syncWithGoogleSheets() {
  if (!googleAccessToken) return;

  try {
    if (!spreadsheetId) {
      // Find spreadsheet named "AURA Academic Planner" or create a new one
      const driveList = await gapi.client.drive.files.list({
        q: "name = 'AURA Academic Planner' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
        fields: 'files(id)'
      });

      const files = driveList.result.files;
      if (files && files.length > 0) {
        spreadsheetId = files[0].id;
        localStorage.setItem('aura_spreadsheet_id', spreadsheetId);
        console.log('Found existing spreadsheet ID:', spreadsheetId);
      } else {
        // Create new spreadsheet
        const createResult = await gapi.client.sheets.spreadsheets.create({
          resource: {
            properties: { title: 'AURA Academic Planner' },
            sheets: [
              { properties: { title: 'Classes' } },
              { properties: { title: 'Assignments' } },
              { properties: { title: 'Exams' } }
            ]
          }
        });
        spreadsheetId = createResult.result.spreadsheetId;
        localStorage.setItem('aura_spreadsheet_id', spreadsheetId);
        console.log('Created new spreadsheet ID:', spreadsheetId);
        
        // Write default headers
        await writeDefaultHeadersToSheets();
      }
    }

    // Pull data from sheet
    await downloadDataFromSheets();
  } catch (err) {
    console.error('Error syncing spreadsheet metadata:', err);
    triggerSyncFeedback('Sheets Auth Revoked. Reconnect Google!');
  }
}

async function writeDefaultHeadersToSheets() {
  try {
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Classes!A1:F1',
      valueInputOption: 'RAW',
      resource: { values: [['ID', 'Subject', 'Time', 'Day', 'Mode', 'Notes']] }
    });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Assignments!A1:F1',
      valueInputOption: 'RAW',
      resource: { values: [['ID', 'Name', 'Subject', 'Due Date', 'Status', 'Priority']] }
    });
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: 'Exams!A1:D1',
      valueInputOption: 'RAW',
      resource: { values: [['ID', 'Subject Name', 'Exam Date', 'Topics Covered']] }
    });
    
    // Seed initial values to Google Sheets
    await uploadLocalStateToSheets();
  } catch (err) {
    console.error('Error writing headers:', err);
  }
}

async function downloadDataFromSheets() {
  try {
    // 1. Classes pull
    const classesResp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Classes!A2:F'
    });
    const classesRows = classesResp.result.values;
    if (classesRows) {
      state.classes = classesRows.map(row => ({
        id: parseInt(row[0]) || Date.now(),
        subject: row[1],
        time: row[2],
        date: row[3],
        mode: row[4],
        notes: row[5] || ''
      }));
    }

    // 2. Assignments pull
    const assignResp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Assignments!A2:F'
    });
    const assignRows = assignResp.result.values;
    if (assignRows) {
      state.assignments = assignRows.map(row => ({
        id: parseInt(row[0]) || Date.now(),
        name: row[1],
        subject: row[2],
        due: row[3],
        status: row[4],
        priority: row[5]
      }));
    }

    // 3. Exams pull
    const examsResp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Exams!A2:D'
    });
    const examsRows = examsResp.result.values;
    if (examsRows) {
      state.exams = examsRows.map(row => ({
        id: parseInt(row[0]) || Date.now(),
        subject: row[1],
        date: row[2],
        notes: row[3] || ''
      }));
    }

    saveCache();
    triggerSyncFeedback('Google Sheets Database Synced');
  } catch (err) {
    console.error('Error pulling spreadsheet data:', err);
  }
}

async function uploadLocalStateToSheets() {
  if (!googleAccessToken || !spreadsheetId) return;

  try {
    // Sync Classes Tab
    const classValues = state.classes.map(c => [c.id, c.subject, c.time, c.date, c.mode, c.notes]);
    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheetId, range: 'Classes!A2:F100' });
    if (classValues.length > 0) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `Classes!A2:F${classValues.length + 1}`,
        valueInputOption: 'RAW',
        resource: { values: classValues }
      });
    }

    // Sync Assignments Tab
    const assignValues = state.assignments.map(a => [a.id, a.name, a.subject, a.due, a.status, a.priority]);
    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheetId, range: 'Assignments!A2:F100' });
    if (assignValues.length > 0) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `Assignments!A2:F${assignValues.length + 1}`,
        valueInputOption: 'RAW',
        resource: { values: assignValues }
      });
    }

    // Sync Exams Tab
    const examValues = state.exams.map(e => [e.id, e.subject, e.date, e.notes]);
    await gapi.client.sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheetId, range: 'Exams!A2:D100' });
    if (examValues.length > 0) {
      await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `Exams!A2:D${examValues.length + 1}`,
        valueInputOption: 'RAW',
        resource: { values: examValues }
      });
    }
  } catch (err) {
    console.error('Error uploading state to sheet:', err);
  }
}

// -------------------------------------------------------------
// GOOGLE CALENDAR SYNC CONTROLLER
// -------------------------------------------------------------

async function addEventToGoogleCalendar(title, dateStr, timeRangeStr, notes) {
  if (!googleAccessToken) {
    console.log("No Google auth. Skipping Calendar creation.");
    return;
  }

  try {
    // Parse time range e.g. "10:00 AM - 11:30 AM" or default
    let startTimeStr = "09:00:00";
    let endTimeStr = "10:00:00";
    
    if (timeRangeStr && timeRangeStr.includes("-")) {
      const times = timeRangeStr.split("-").map(t => t.trim());
      startTimeStr = convertTimeTo24h(times[0]);
      endTimeStr = convertTimeTo24h(times[1]);
    }

    // Map day or YYYY-MM-DD date to calendar date string
    let finalDateStr = dateStr;
    if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // It's a day name (e.g. Wednesday). Calculate nearest day.
      finalDateStr = getNearestDayDateString(dateStr);
    }

    const startDateTime = `${finalDateStr}T${startTimeStr}`;
    const endDateTime = `${finalDateStr}T${endTimeStr}`;

    const event = {
      summary: title,
      description: notes || '',
      start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Kolkata' },
    };

    const request = gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    await request;
    console.log(`Calendar event created: ${title}`);
    triggerSyncFeedback('Google Calendar Event Created!');
  } catch (err) {
    console.error('Error adding event to Google Calendar:', err);
  }
}

function convertTimeTo24h(timeStr) {
  try {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier.toLowerCase() === 'pm') {
      hours = parseInt(hours, 10) + 12;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  } catch {
    return '09:00:00';
  }
}

function getNearestDayDateString(dayName) {
  const daysOfWeek = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDayNum = daysOfWeek[dayName.toLowerCase()];
  
  if (targetDayNum === undefined) return baselineDateStr; // Fallback
  
  const base = new Date(baselineDateStr + "T12:00:00");
  const baseDayNum = base.getDay();
  
  let daysDiff = targetDayNum - baseDayNum;
  if (daysDiff < 0) daysDiff += 7; // Next week's nearest day
  
  const targetDate = new Date(base.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// -------------------------------------------------------------
// GOOGLE GEMINI API CONTROLLER (REAL AI ENGINE)
// -------------------------------------------------------------

async function queryGemini(prompt, systemInstruction) {
  if (!credentials.geminiKey) {
    console.warn("No Gemini API key provided. Falling back to simulation mode.");
    return null;
  }

  try {
    updateConnectionStatus('gemini', 'warning', 'Gemini Querying...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${credentials.geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { maxOutputTokens: 2048 }
      })
    });

    const data = await response.json();
    updateConnectionStatus('gemini', 'online', 'Gemini AI Connected');

    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error(JSON.stringify(data));
    }
  } catch (err) {
    console.error("Gemini API call failed:", err);
    updateConnectionStatus('gemini', 'offline', 'Gemini AI Error');
    return null;
  }
}

// Update settings UI connection lights
function updateConnectionStatus(service, stateClass, tooltipText) {
  const badgeEl = document.getElementById(`${service}-status`);
  if (!badgeEl) return;

  const dot = badgeEl.querySelector('.status-indicator-dot');
  dot.className = `status-indicator-dot ${stateClass}`;
  
  // Set text
  badgeEl.childNodes[2].textContent = ` ${tooltipText}`;
  
  // Update coach connection header badge
  if (service === 'gemini') {
    const coachIndicator = document.getElementById('chat-ai-indicator');
    if (stateClass === 'online') {
      coachIndicator.textContent = 'Gemini AI Connected';
      coachIndicator.style.color = 'var(--color-success)';
      coachIndicator.style.borderColor = 'rgba(16, 185, 129, 0.2)';
      coachIndicator.style.background = 'rgba(16, 185, 129, 0.08)';
    } else {
      coachIndicator.textContent = 'AI Engine Offline';
      coachIndicator.style.color = 'var(--text-muted)';
      coachIndicator.style.borderColor = 'var(--border-glass)';
      coachIndicator.style.background = 'rgba(255, 255, 255, 0.02)';
    }
  }
}

// -------------------------------------------------------------
// CORE APP LOGIC & RENDERING
// -------------------------------------------------------------

function getDaysRemaining(targetDateStr) {
  const target = new Date(targetDateStr + "T00:00:00");
  const base = new Date(baselineDateStr + "T00:00:00");
  const diffTime = target.getTime() - base.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function initClock() {
  const clockEl = document.getElementById("clock-display");
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    clockEl.textContent = `${baselineDateStr} ${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

function initNavigation() {
  const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
  const contentViews = document.querySelectorAll('.content-view');
  const viewTitle = document.getElementById('view-title');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      
      menuItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      contentViews.forEach(view => {
        if (view.id === `view-${viewId}`) {
          view.classList.add('active-view');
        } else {
          view.classList.remove('active-view');
        }
      });

      const titles = {
        'dashboard': 'Academic Dashboard',
        'chat': 'Llama AI Academic Coach',
        'schedule': 'Class Planner & Schedules',
        'assignments': 'Assignment Tracker Kanban',
        'summarizer': 'AI Lecture Summarizer',
        'planner': 'Study Timetable Planner',
        'countdown': 'Exam Countdowns & Revision'
      };
      viewTitle.textContent = titles[viewId] || 'Academic Planner';
    });
  });

  document.getElementById('btn-quick-schedule').addEventListener('click', () => {
    document.querySelector('[data-view="schedule"]').click();
  });
}

function renderDashboard() {
  const pendingCount = state.assignments.filter(a => a.status !== 'Completed').length;
  const examCount = state.exams.filter(e => getDaysRemaining(e.date) >= 0).length;
  const todayClasses = state.classes.filter(c => c.date.toLowerCase() === 'wednesday'); // Simulated Wed baseline
  const completedCount = state.assignments.filter(a => a.status === 'Completed').length;

  document.getElementById('stat-pending-tasks').textContent = pendingCount;
  document.getElementById('stat-exams').textContent = examCount;
  document.getElementById('stat-classes').textContent = todayClasses.length;
  document.getElementById('stat-completed').textContent = completedCount;

  const schedContainer = document.getElementById('dashboard-schedule-container');
  schedContainer.innerHTML = '';
  if (todayClasses.length === 0) {
    schedContainer.innerHTML = `<div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">No lectures scheduled for today.</div>`;
  } else {
    todayClasses.forEach(c => {
      const isOnline = c.mode.toLowerCase() === 'online';
      schedContainer.innerHTML += `
        <div class="sched-item">
          <div class="sched-time">${c.time}</div>
          <div class="sched-details">
            <span class="sched-subj">${c.subject}</span>
            <span class="sched-loc">${c.notes || ''}</span>
          </div>
          <span class="sched-badge ${isOnline ? 'online' : 'in-person'}">${c.mode}</span>
        </div>
      `;
    });
  }

  const assignContainer = document.getElementById('dashboard-assignments-container');
  assignContainer.innerHTML = '';
  const critical = state.assignments
    .filter(a => a.status !== 'Completed')
    .sort((a, b) => {
      const priorities = { 'High': 3, 'Medium': 2, 'Low': 1 };
      return priorities[b.priority] - priorities[a.priority];
    })
    .slice(0, 3);

  if (critical.length === 0) {
    assignContainer.innerHTML = `<div class="empty-state-text" style="padding: 20px; text-align: center; color: var(--text-muted);">No critical assignments pending.</div>`;
  } else {
    critical.forEach(a => {
      const days = getDaysRemaining(a.due);
      let dueText = `Due in ${days} days (${a.due})`;
      if (days < 0) dueText = `Overdue by ${Math.abs(days)} days! (${a.due})`;
      if (days === 0) dueText = `Due TODAY!`;
      if (days === 1) dueText = `Due TOMORROW!`;

      assignContainer.innerHTML += `
        <div class="assign-item-mini">
          <div class="assign-info-mini">
            <span class="assign-title-mini">${a.name} <span class="badge priority-${a.priority.toLowerCase()}">${a.priority}</span></span>
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

function renderSchedule() {
  const tbody = document.getElementById('schedule-table-body');
  tbody.innerHTML = '';

  if (state.classes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No classes scheduled yet.</td></tr>`;
    return;
  }

  const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
  const sortedClasses = [...state.classes].sort((a, b) => (dayOrder[a.date] || 8) - (dayOrder[b.date] || 8));

  sortedClasses.forEach((c) => {
    const isOnline = c.mode.toLowerCase() === 'online';
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: 600;">${c.subject}</td>
        <td style="font-family: var(--font-mono); font-size: 0.85rem;">${c.time}</td>
        <td>${c.date}</td>
        <td>
          <span class="sched-badge ${isOnline ? 'online' : 'in-person'}">${c.mode}</span>
        </td>
        <td style="color: var(--text-secondary);">${c.notes || '-'}</td>
        <td>
          <button class="icon-btn delete-btn" onclick="deleteClass(${c.id})" title="Delete class">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </td>
      </tr>
    `;
  });
}

async function addClass() {
  const subjInput = document.getElementById('class-subject');
  const timeInput = document.getElementById('class-time');
  const dateInput = document.getElementById('class-date');
  const modeInput = document.getElementById('class-mode');
  const notesInput = document.getElementById('class-notes');

  const newClass = {
    id: Date.now(),
    subject: subjInput.value.trim(),
    time: timeInput.value.trim(),
    date: dateInput.value.trim(),
    mode: modeInput.value,
    notes: notesInput.value.trim()
  };

  state.classes.push(newClass);
  saveCache();
  
  // Create Calendar target
  await addEventToGoogleCalendar(`Class: ${newClass.subject}`, newClass.date, newClass.time, newClass.notes);
  await uploadLocalStateToSheets();

  subjInput.value = '';
  timeInput.value = '';
  dateInput.value = '';
  notesInput.value = '';
}

async function deleteClass(id) {
  state.classes = state.classes.filter(c => c.id !== id);
  saveCache();
  await uploadLocalStateToSheets();
}

function renderAssignments() {
  const listPending = document.getElementById('list-pending-tasks');
  const listProgress = document.getElementById('list-progress-tasks');
  const listCompleted = document.getElementById('list-completed-tasks');

  listPending.innerHTML = '';
  listProgress.innerHTML = '';
  listCompleted.innerHTML = '';

  let countP = 0, countPr = 0, countC = 0;

  state.assignments.forEach(a => {
    const days = getDaysRemaining(a.due);
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

    const cardHTML = `
      <div class="kanban-card" draggable="true" ondragstart="drag(event, ${a.id})">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <span class="kanban-card-subj">${a.subject}</span>
          <span class="badge priority-${a.priority.toLowerCase()}">${a.priority}</span>
        </div>
        <div class="kanban-card-title">${a.name}</div>
        <div class="kanban-card-meta">
          <span class="kanban-card-due" style="color: ${isAlert ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight: ${isAlert ? '600' : 'normal'};">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${dueStatusText}
          </span>
          <div class="kanban-card-actions">
            ${a.status !== 'Completed' ? `
              <button class="icon-btn complete-btn" onclick="updateAssignmentStatus(${a.id}, 'Completed')" title="Mark Completed">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            ` : ''}
            ${a.status === 'Pending' ? `
              <button class="icon-btn edit-btn" onclick="updateAssignmentStatus(${a.id}, 'In Progress')" title="Move to In Progress">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            ` : ''}
            <button class="icon-btn delete-btn" onclick="deleteAssignment(${a.id})" title="Delete Assignment">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    if (a.status === 'Pending') {
      listPending.innerHTML += cardHTML;
      countP++;
    } else if (a.status === 'In Progress') {
      listProgress.innerHTML += cardHTML;
      countPr++;
    } else if (a.status === 'Completed') {
      listCompleted.innerHTML += cardHTML;
      countC++;
    }
  });

  document.getElementById('count-pending').textContent = countP;
  document.getElementById('count-progress').textContent = countPr;
  document.getElementById('count-completed').textContent = countC;
}

async function updateAssignmentStatus(id, newStatus) {
  const index = state.assignments.findIndex(a => a.id === id);
  if (index !== -1) {
    state.assignments[index].status = newStatus;
    saveCache();
    await uploadLocalStateToSheets();
  }
}

async function deleteAssignment(id) {
  state.assignments = state.assignments.filter(a => a.id !== id);
  saveCache();
  await uploadLocalStateToSheets();
}

async function addAssignment() {
  const nameInput = document.getElementById('assign-name');
  const subjInput = document.getElementById('assign-subject');
  const dueInput = document.getElementById('assign-due');
  const prioritySelect = document.getElementById('assign-priority');
  const statusSelect = document.getElementById('assign-status');

  const newAssign = {
    id: Date.now(),
    name: nameInput.value.trim(),
    subject: subjInput.value.trim(),
    due: dueInput.value.trim(),
    priority: prioritySelect.value,
    status: statusSelect.value
  };

  state.assignments.push(newAssign);
  saveCache();
  await uploadLocalStateToSheets();

  nameInput.value = '';
  subjInput.value = '';
  dueInput.value = '';
}

// Note Summarizer with live Gemini API
async function generateAISummary() {
  const rawText = document.getElementById('summarizer-text').value.trim();
  const focusMode = document.getElementById('summarizer-focus').value;

  if (!rawText) return;

  const outputBox = document.getElementById('summarizer-output-box');
  const emptyEl = document.getElementById('summarizer-empty');

  emptyEl.style.display = 'none';
  outputBox.style.display = 'block';
  outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Querying Google Gemini API for note compilation...</span></div>`;

  // Check if live API Key is present
  if (!credentials.geminiKey) {
    setTimeout(() => {
      outputBox.innerHTML = `
        <div class="empty-state-text" style="color: var(--color-danger); text-align: left;">
          <strong>Error: Gemini API Key Missing!</strong><br>
          We are currently running in mock simulation mode. Open the <strong>API Settings Keys</strong> modal at the bottom left, paste your API Key from Google AI Studio, and hit save to unlock real AI note summaries.
        </div>
      `;
    }, 1000);
    return;
  }

  const systemInstruction = `
    You are AURA Study AI, a high-yield note summarizer designed for university students. 
    Analyze the lecture transcript or text pasted by the user. 
    Summarize it cleanly, using html tags where appropriate. Avoid markdown formatting inside the text blocks, just output clean structured lists.
    Format your response into three sections:
    1. A header <h2> specifying the main topic.
    2. A section titled "MAIN LECTURE SUMMARY" (short bullet points).
    3. A section titled "DEFINITIONS & CRITICAL CONCEPTS" (terms + explanations).
    4. A section titled "EXAM STUDY REVISION NOTES" (likelihood of appearing on tests, formula keys, or core diagrams references).
  `;

  const prompt = `Focus Mode: ${focusMode}\nLecture Raw Notes:\n${rawText}`;
  const response = await queryGemini(prompt, systemInstruction);

  if (response) {
    // Format response into bullet list styles
    outputBox.innerHTML = `
      <div class="summary-heading">Gemini AI Synthesis</div>
      <div class="summarizer-raw-output">${response.replace(/\n/g, '<br>')}</div>
    `;
  } else {
    outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-danger);">Failed to connect to the Gemini API endpoint. Please check your network connection or API Key.</div>`;
  }
}

// Study Plan Generator with Gemini API
async function generateStudyPlan() {
  const subjects = document.getElementById('study-subjects').value.split(',').map(s => s.trim());
  const days = parseInt(document.getElementById('study-exam-days').value);
  const dailyHours = parseInt(document.getElementById('study-hours').value);
  const weakSubject = document.getElementById('study-weak').value;

  const outputGrid = document.getElementById('planner-output-box');
  const emptyEl = document.getElementById('planner-empty');

  emptyEl.style.display = 'none';
  outputGrid.style.display = 'grid';
  outputGrid.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Gemini is building your adaptive study syllabus...</span></div>`;

  if (!credentials.geminiKey) {
    // Simulation fallback
    setTimeout(() => {
      runSimulationStudyPlan(subjects, days, dailyHours, weakSubject);
    }, 1000);
    return;
  }

  const systemInstruction = `
    You are an AI study coach. Generate a day-by-day revision timeline.
    Output only a JSON representation of the schedule so that we can render cards on the frontend.
    Do NOT output any conversational text or markdown blocks, just return a raw JSON array of objects.
    Each object representing a Day should have this schema:
    {
      "dayNum": 1,
      "studyHours": 4,
      "slots": [
        {
          "timeLabel": "09:00 AM - 11:00 AM",
          "subject": "DBMS",
          "topic": "Normalization theory & examples",
          "outcome": "Write clean tables up to 3NF",
          "isWeakFocus": true
        }
      ]
    }
    Generate details for 3 days of revision blocks based on:
    - Subjects: ${subjects.join(', ')}
    - Weak subject: ${weakSubject}
    - Daily Study Hours: ${dailyHours}
  `;

  const prompt = `Generate JSON array of study slots.`;
  const response = await queryGemini(prompt, systemInstruction);

  try {
    // Sanitize output block (sometimes models surround JSON with ```json ```)
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const dayPlans = JSON.parse(jsonStr);

    outputGrid.innerHTML = '';
    dayPlans.forEach(day => {
      let slotsHTML = '';
      day.slots.forEach(slot => {
        slotsHTML += `
          <div class="slot-item" style="${slot.isWeakFocus ? 'border-left: 3px solid var(--color-warning); background: rgba(245, 158, 11, 0.02);' : ''}">
            <span class="slot-time-block">${slot.timeLabel}</span>
            <span class="slot-subject">${slot.subject} ${slot.isWeakFocus ? '<span class="badge priority-medium" style="font-size:0.6rem; padding: 2px 5px;">Weak Subject Focus</span>' : ''}</span>
            <span class="slot-topic">${slot.topic}</span>
            <span class="slot-outcome">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Expected: ${slot.outcome}
            </span>
          </div>
        `;
      });

      outputGrid.innerHTML += `
        <div class="glass-panel day-plan-card">
          <div class="day-plan-header">
            <span>Day ${day.dayNum} Schedule</span>
            <span style="font-size:0.75rem; color:var(--text-secondary); font-family:var(--font-mono);">${day.studyHours} hrs study</span>
          </div>
          <div class="day-plan-slots">
            ${slotsHTML}
          </div>
        </div>
      `;
    });
  } catch (err) {
    console.error("Failed to parse Gemini planner output. Running simulation fallback:", err);
    runSimulationStudyPlan(subjects, days, dailyHours, weakSubject);
  }
}

function runSimulationStudyPlan(subjects, days, dailyHours, weakSubject) {
  const outputGrid = document.getElementById('planner-output-box');
  outputGrid.innerHTML = '';
  const loopLimit = Math.min(days, 3);
  for (let dayNum = 1; dayNum <= loopLimit; dayNum++) {
    let slotsHTML = '';
    const totalBlocks = Math.ceil(dailyHours / 2);
    for (let blockIndex = 1; blockIndex <= totalBlocks; blockIndex++) {
      let currentSubj = subjects[blockIndex % subjects.length] || subjects[0];
      if (blockIndex === 1 && subjects.includes(weakSubject)) currentSubj = weakSubject;

      const isWeak = currentSubj === weakSubject;
      let topicText = isWeak ? "Core theory & past question drills" : "Syllabus revision & chapter reviews";
      let outcomeText = isWeak ? "Critical weak topics mastered" : "Complete 1 syllabus chapter";
      let timeLabel = blockIndex === 1 ? "09:00 AM - 11:00 AM" : "03:00 PM - 05:00 PM";

      slotsHTML += `
        <div class="slot-item" style="${isWeak ? 'border-left: 3px solid var(--color-warning); background: rgba(245, 158, 11, 0.02);' : ''}">
          <span class="slot-time-block">${timeLabel}</span>
          <span class="slot-subject">${currentSubj} ${isWeak ? '<span class="badge priority-medium" style="font-size:0.6rem; padding: 2px 5px;">Weak Focus</span>' : ''}</span>
          <span class="slot-topic">${topicText}</span>
          <span class="slot-outcome">Expected: ${outcomeText}</span>
        </div>
      `;
    }
    outputGrid.innerHTML += `
      <div class="glass-panel day-plan-card">
        <div class="day-plan-header">
          <span>Day ${dayNum} Plan (Simulation)</span>
        </div>
        <div class="day-plan-slots">${slotsHTML}</div>
      </div>
    `;
  }
}

// Render Countdowns
function renderCountdowns() {
  const container = document.getElementById('countdowns-container');
  container.innerHTML = '';
  const tableBody = document.getElementById('revision-recommendations-table');
  tableBody.innerHTML = '';

  if (state.exams.length === 0) {
    container.innerHTML = `<div class="empty-state-text" style="width: 100%; text-align: center; color: var(--text-muted); padding: 45px;">No active countdowns configured.</div>`;
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No exams loaded.</td></tr>`;
    return;
  }

  const sortedExams = [...state.exams].sort((a, b) => getDaysRemaining(a.date) - getDaysRemaining(b.date));

  sortedExams.forEach(e => {
    const days = getDaysRemaining(e.date);
    const isUrgent = days <= 5;
    
    container.innerHTML += `
      <div class="glass-panel countdown-card ${isUrgent ? 'urgent' : ''}">
        <span class="countdown-label">Days Remaining</span>
        <span class="countdown-days">${days < 0 ? 'Passed' : days}</span>
        <span class="countdown-subject">${e.subject}</span>
        <span class="countdown-date">${e.date}</span>
        <span style="font-size:0.7rem; color: var(--text-muted); margin-top: 4px;">${e.notes || ''}</span>
      </div>
    `;
  });

  sortedExams.forEach((e, idx) => {
    const days = getDaysRemaining(e.date);
    let urgency = 'Low';
    let urgencyClass = 'priority-low';
    let suggestedTodayAction = 'Review chapter notes and definitions.';
    let crashPlan = 'Standard Load';

    if (days <= 3) {
      urgency = 'Critical';
      urgencyClass = 'priority-high';
      suggestedTodayAction = 'Do high-yield past question paper drills TODAY. Sleep early.';
      crashPlan = '🚨 Active Crash Mode';
    } else if (days <= 7) {
      urgency = 'High';
      urgencyClass = 'priority-medium';
      suggestedTodayAction = 'Master key weak topics. Practice formula sheets.';
      crashPlan = 'Strategic revision';
    }

    tableBody.innerHTML += `
      <tr>
        <td style="font-weight: 700; color: var(--color-accent);">Rank #${idx + 1}</td>
        <td style="font-weight: 600;">${e.subject}</td>
        <td>
          <span class="badge ${urgencyClass}">${urgency}</span>
        </td>
        <td style="font-family: var(--font-mono);">${days} Days</td>
        <td>${suggestedTodayAction}</td>
        <td style="font-size: 0.8rem; font-weight: 650; color: ${days <= 3 ? 'var(--color-danger)' : 'var(--text-secondary)'};">${crashPlan}</td>
      </tr>
    `;
  });
}

async function addExam() {
  const subjInput = document.getElementById('exam-subject');
  const dateInput = document.getElementById('exam-date');
  const notesInput = document.getElementById('exam-notes');

  const newExam = {
    id: Date.now(),
    subject: subjInput.value.trim(),
    date: dateInput.value,
    notes: notesInput.value.trim()
  };

  state.exams.push(newExam);
  saveCache();
  
  // Sync to Google Calendar
  await addEventToGoogleCalendar(`Exam: ${newExam.subject}`, newExam.date, '09:00 AM - 12:00 PM', newExam.notes);
  await uploadLocalStateToSheets();

  subjInput.value = '';
  dateInput.value = '';
  notesInput.value = '';
  closeExamForm();
}

// -------------------------------------------------------------
// CHAT BOT INTERACTION LOGIC
// -------------------------------------------------------------

async function handleSendMessage() {
  const inputEl = document.getElementById('chat-input-field');
  const userText = inputEl.value.trim();

  if (!userText) return;

  state.chatHistory.push({ sender: 'user', text: userText });
  inputEl.value = '';
  saveCache();

  const historyContainer = document.getElementById('chat-history-container');
  historyContainer.scrollTop = historyContainer.scrollHeight;

  // Render assistant typing placeholder
  state.chatHistory.push({ sender: 'assistant', text: '<span style="animation: pulseLight 1s infinite alternate;">AURA is typing...</span>' });
  renderChatBubbles();
  historyContainer.scrollTop = historyContainer.scrollHeight;

  if (!credentials.geminiKey) {
    // Local simulation response fallback
    setTimeout(() => {
      state.chatHistory.pop(); // Remove typing indicator
      runLocalChatSimulation(userText);
    }, 1000);
    return;
  }

  const systemInstruction = `
    You are AURA Academic Coach, powered by Gemini AI. Your purpose is to act as a structured study helper.
    Always respond in a clear, supportive, student-friendly, and structured manner.
    When the user gives messy or incomplete info, structure it cleanly.
    Follow these output formats strictly:
    
    1. If the user tells you about an assignment (e.g. DBMS assignment next Friday), formulate the response into this precise structured checklist:
       Assignment: [Name]
       Due Date: [Date]
       Status: Pending
       Priority: High/Medium/Low
       Suggested Action: [Action]
       
       Also output this exact trigger text at the end: "TRIGGER:ADD_ASSIGNMENT|[name]|[subject]|[due_date]|[priority]"
    
    2. If the user asks for summaries:
       Main Topic
       Key Concepts
       Important Definitions
       Exam Notes
       Short Revision Summary
       
    3. If the user asks for a study plan:
       Create a day-wise plan with subject-wise blocks, revision order, mock tests, and breaks.
       
    Keep responses highly visual and formatted using neat lists.
  `;

  const response = await queryGemini(userText, systemInstruction);
  state.chatHistory.pop(); // Remove typing indicator

  if (response) {
    let finalOutput = response;
    
    // Check if the model emitted the add assignment trigger
    if (response.includes("TRIGGER:ADD_ASSIGNMENT")) {
      const parts = response.split("TRIGGER:ADD_ASSIGNMENT")[1].trim().split("|");
      if (parts.length >= 4) {
        const name = parts[1];
        const subject = parts[2];
        const due = parts[3];
        const priority = parts[4] || 'High';
        
        finalOutput = response.split("TRIGGER:ADD_ASSIGNMENT")[0] + `
          <div style="margin-top: 12px; padding: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px;">
            <button class="glow-btn" style="padding: 6px 12px; font-size: 0.75rem;" onclick="addMockChatAssignment('${name}', '${subject}', '${due}', '${priority}')">Click to Sync into Sheets Tracker</button>
          </div>
        `;
      }
    }

    state.chatHistory.push({ sender: 'assistant', text: finalOutput.replace(/\n/g, '<br>') });
  } else {
    state.chatHistory.push({ sender: 'assistant', text: 'Error: Failed to process query using Gemini API. Verify your API credentials.' });
  }

  saveCache();
  historyContainer.scrollTop = historyContainer.scrollHeight;
}

window.addMockChatAssignment = async function(name, subject, due, priority) {
  const newA = {
    id: Date.now(),
    name: name,
    subject: subject,
    due: due,
    priority: priority,
    status: 'Pending'
  };
  state.assignments.push(newA);
  saveCache();
  await uploadLocalStateToSheets();
  
  state.chatHistory.push({ 
    sender: 'assistant', 
    text: `✅ Synced: Assignment <strong>"${name}"</strong> has been written to Google Sheets and added to your Kanban board!` 
  });
  saveCache();
};

function runLocalChatSimulation(userText) {
  let responseText = '';
  const textLower = userText.toLowerCase();

  if (textLower.includes("dbms assignment") && textLower.includes("next friday")) {
    responseText = `
      <p>I've noted the assignment details and mapped priority constraints:</p>
      <div class="chat-structured-block">
        <strong>Assignment:</strong> DBMS Assignment<br>
        <strong>Due Date:</strong> Next Friday (2026-07-03)<br>
        <strong>Status:</strong> Pending<br>
        <strong>Priority:</strong> High<br>
        <strong>Suggested Action:</strong> Start today and finish the rough draft by Wednesday.
      </div>
      <p>Click below to sync this into Google Sheets:</p>
      <button class="glow-btn" style="padding: 6px 12px; font-size: 0.75rem;" onclick="addMockChatAssignment('DBMS Assignment', 'DBMS', '2026-07-03', 'High')">Add to Sheets</button>
    `;
  } else {
    responseText = `
      <p>I am running in Simulation mode. Open the <strong>API Settings Keys</strong> dialog to add your Gemini API Key for real-time AI responses.</p>
    `;
  }

  state.chatHistory.push({ sender: 'assistant', text: responseText });
  saveCache();
}

function renderChatBubbles() {
  const container = document.getElementById('chat-history-container');
  container.innerHTML = '';
  state.chatHistory.forEach(msg => {
    const isAssistant = msg.sender === 'assistant';
    container.innerHTML += `
      <div class="chat-bubble ${isAssistant ? 'assistant' : 'user'}">
        <div class="bubble-avatar">${isAssistant ? 'L3' : 'RK'}</div>
        <div class="bubble-content">${msg.text}</div>
      </div>
    `;
  });
}

// -------------------------------------------------------------
// CREDENTIALS & MODAL HANDLERS
// -------------------------------------------------------------

function showSettingsModal() {
  document.getElementById('settings-modal').classList.add('active');
  document.getElementById('settings-gemini-key').value = credentials.geminiKey;
  document.getElementById('settings-google-client-id').value = credentials.googleClientId;
}

function hideSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

function saveCredentials() {
  const gKey = document.getElementById('settings-gemini-key').value.trim();
  const clientId = document.getElementById('settings-google-client-id').value.trim();

  credentials.geminiKey = gKey;
  credentials.googleClientId = clientId;

  localStorage.setItem('aura_gemini_key', gKey);
  localStorage.setItem('aura_google_client_id', clientId);

  hideSettingsModal();
  
  // Re-initialize connections
  if (gKey) {
    updateConnectionStatus('gemini', 'online', 'Gemini AI Connected');
  } else {
    updateConnectionStatus('gemini', 'offline', 'Gemini AI Offline');
  }
  
  if (clientId) {
    initGoogleApis();
  }
  
  triggerSyncFeedback('Credentials Saved Successfully');
}

// Sync feedback banner
function triggerSyncFeedback(msg) {
  const syncStatus = document.getElementById('sync-status');
  syncStatus.classList.add('syncing');
  syncStatus.innerHTML = `<span class="sync-dot" style="color: var(--color-warning);">●</span> ${msg}`;

  setTimeout(() => {
    syncStatus.classList.remove('syncing');
    syncStatus.innerHTML = `<span class="sync-dot" style="color: var(--color-success);">●</span> Google Cloud Active`;
  }, 2500);
}

// -------------------------------------------------------------
// DOM EVENT BINDINGS
// -------------------------------------------------------------

function initEventBindings() {
  // Sync operations
  document.getElementById('btn-sync-calendar').addEventListener('click', async () => {
    triggerSyncFeedback('Syncing calendar elements...');
    if (googleAccessToken) {
      for (const c of state.classes) {
        await addEventToGoogleCalendar(`Class: ${c.subject}`, c.date, c.time, c.notes);
      }
      for (const e of state.exams) {
        await addEventToGoogleCalendar(`Exam: ${e.subject}`, e.date, '09:00 AM - 12:00 PM', e.notes);
      }
    } else {
      alert("Please connect Google Sheets/Calendar first!");
    }
  });

  document.getElementById('btn-sync-sheets').addEventListener('click', async () => {
    if (!googleAccessToken) {
      handleAuthClick();
    } else {
      triggerSyncFeedback('Uploading records...');
      await uploadLocalStateToSheets();
    }
  });

  document.getElementById('btn-google-login').addEventListener('click', handleAuthClick);
  document.getElementById('btn-google-logout').addEventListener('click', handleSignoutClick);

  // Settings triggers
  document.getElementById('btn-open-settings').addEventListener('click', showSettingsModal);
  document.getElementById('btn-close-settings').addEventListener('click', hideSettingsModal);
  document.getElementById('btn-cancel-settings').addEventListener('click', hideSettingsModal);
  document.getElementById('form-settings').addEventListener('submit', (ev) => {
    ev.preventDefault();
    saveCredentials();
  });

  // Action forms submits
  document.getElementById('form-add-class').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await addClass();
  });
  document.getElementById('form-add-assignment').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await addAssignment();
  });
  document.getElementById('form-add-exam').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    await addExam();
  });
  document.getElementById('form-study-planner').addEventListener('submit', (ev) => {
    ev.preventDefault();
    generateStudyPlan();
  });
  document.getElementById('form-summarizer').addEventListener('submit', (ev) => {
    ev.preventDefault();
    generateAISummary();
  });

  // Chat keyboard send
  document.getElementById('chat-input-field').addEventListener('keypress', (ev) => {
    if (ev.key === 'Enter') handleSendMessage();
  });
  document.getElementById('btn-chat-send').addEventListener('click', handleSendMessage);

  // Clear note outputs
  document.getElementById('btn-clear-summarizer').addEventListener('click', () => {
    document.getElementById('summarizer-text').value = '';
    document.getElementById('summarizer-output-box').style.display = 'none';
    document.getElementById('summarizer-empty').style.display = 'flex';
  });
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const box = document.getElementById('summarizer-output-box');
    if (box.style.display === 'none') {
      alert("No summaries generated!");
      return;
    }
    const blob = new Blob([box.innerText], { type: 'text/plain' });
    const el = document.createElement('a');
    el.href = URL.createObjectURL(blob);
    el.download = 'Gemini_AI_Lecture_Summary.txt';
    el.click();
  });

  document.getElementById('btn-add-exam-trigger').addEventListener('click', () => {
    document.getElementById('exam-form-card').style.display = 'block';
    document.getElementById('btn-add-exam-trigger').style.display = 'none';
  });
  document.getElementById('btn-close-exam-form').addEventListener('click', () => {
    document.getElementById('exam-form-card').style.display = 'none';
    document.getElementById('btn-add-exam-trigger').style.display = 'block';
  });
}

// Drag & Drop
window.drag = function(ev, id) {
  ev.dataTransfer.setData("text", id);
};

function initKanbanDropzone() {
  const cols = document.querySelectorAll('.kanban-col');
  cols.forEach(col => {
    col.addEventListener('dragover', (ev) => ev.preventDefault());
    col.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const id = parseInt(ev.dataTransfer.getData("text"));
      let status = '';
      if (col.id === 'kanban-pending') status = 'Pending';
      if (col.id === 'kanban-progress') status = 'In Progress';
      if (col.id === 'kanban-completed') status = 'Completed';
      
      if (status) {
        await updateAssignmentStatus(id, status);
      }
    });
  });
}

function updateUI() {
  renderDashboard();
  renderSchedule();
  renderAssignments();
  renderCountdowns();
  renderChatBubbles();
}

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  initNavigation();
  initKanbanDropzone();
  initEventBindings();
  
  // Set initial status indicators
  if (credentials.geminiKey) {
    updateConnectionStatus('gemini', 'online', 'Gemini AI Connected');
  }
  
  // Initial draw
  updateUI();

  // Load Google APIs
  initGoogleApis();
});
