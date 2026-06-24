/**
 * Aura Study AI - Production Backend Database & AI Controller
 * Attach this script to your Google Sheet (Extensions -> Apps Script)
 * Store your GROQ_API_KEY in File -> Project Settings -> Script Properties
 */

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function initializeDatabase() {
  getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
}

function doGet(e) {
  initializeDatabase();
  const action = e.parameter.action;
  let responseData = { success: false, message: "Invalid action or parameters." };

  try {
    switch (action) {
      case "getSchedule":
        responseData = { success: true, data: getSchedule() };
        break;
      case "getAssignments":
        responseData = { success: true, data: getAssignments() };
        break;
      case "getNotes":
        responseData = { success: true, data: getNotes() };
        break;
      case "getStudyPlans":
        responseData = { success: true, data: getStudyPlans() };
        break;
      case "getProgress":
        responseData = { success: true, data: getProgress() };
        break;
      case "getDashboard":
        responseData = { success: true, data: getDashboard() };
        break;
      default:
        responseData = { success: false, message: "Action '" + action + "' is not supported on GET." };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  initializeDatabase();
  let responseData = { success: false, message: "Invalid payload." };

  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    switch (action) {
      case "addSchedule":
        responseData = { success: true, data: addSchedule(postData) };
        break;
      case "deleteSchedule":
        responseData = { success: true, message: deleteSchedule(postData.id) };
        break;
      case "addAssignment":
        responseData = { success: true, data: addAssignment(postData) };
        break;
      case "updateAssignment":
        responseData = { success: true, message: updateAssignment(postData.id, postData.status) };
        break;
      case "deleteAssignment":
        responseData = { success: true, message: deleteAssignment(postData.id) };
        break;
      case "saveNotes":
        responseData = { success: true, data: saveNotes(postData) };
        break;
      case "saveStudyPlan":
        responseData = { success: true, message: saveStudyPlan(postData.plan) };
        break;
      case "updateStudyPlan":
        responseData = { success: true, message: updateStudyPlan(postData.id, postData.completed) };
        break;
      case "updateProgress":
        responseData = { success: true, message: updateProgress(postData) };
        break;
      case "ai":
        responseData = { success: true, data: handleAI(postData.mode, postData.promptData) };
        break;
      default:
        responseData = { success: false, message: "Action '" + action + "' is not supported on POST." };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
                       .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// SECURE AI ROUTING ENGINE (GROQ API CALLS)
// -------------------------------------------------------------

function handleAI(mode, promptData) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in Apps Script Project Settings -> Script Properties!");
  }

  let systemInstruction = "";
  let userPrompt = "";

  if (mode === "summarize" || mode === "notes") {
    systemInstruction = `
      You are AURA Study AI Note Analyst. Analyze the pasted notes.
      You MUST respond ONLY with a raw JSON object containing the parsed categories.
      Do not output any markdown ticks, conversational text, or wrapper tags.
      Required JSON schema:
      {
        "summary": "Short paragraph summary of notes",
        "keyConcepts": ["Concept 1", "Concept 2"],
        "definitions": [{"term": "Term", "description": "Meaning"}],
        "formulas": ["Formula 1", "Formula 2"],
        "interviewQuestions": [{"question": "Q?", "answer": "A"}],
        "examQuestions": [{"question": "Q?", "answer": "A"}],
        "flashcards": [{"front": "Front of card", "back": "Back of card"}],
        "revisionTips": ["Tip 1", "Tip 2"]
      }
    `;
    userPrompt = `Subject: ${promptData.subject}\nTitle: ${promptData.title}\nContent:\n${promptData.text}`;
  } 
  else if (mode === "studyplan") {
    systemInstruction = `
      You are AURA Study Planner. Build a study timetable.
      Return ONLY a JSON array of day objects. Do not write markdown, code blocks, or text.
      JSON Schema:
      [
        {
          "date": "Day 1",
          "subject": "Subject Name",
          "task": "Study target description",
          "duration": 120,
          "isBreak": false
        }
      ]
    `;
    userPrompt = `Subjects: ${promptData.subjects}\nExam Date: ${promptData.examDate}\nHours/Day: ${promptData.hours}\nDifficulty: ${promptData.difficulty}\nConfidence: ${promptData.confidence}\nWeak Topics: ${promptData.weakTopics}`;
  }
  else if (mode === "chat") {
    systemInstruction = "You are AURA Academic Coach, powered by Llama 3.3. Act as a supportive, smart tutor. Answer queries in brief, structured layout.";
    userPrompt = promptData.text;
  }
  else {
    // Fallback/General AI support
    systemInstruction = "You are AURA Study assistant. Return clean, helpful outputs.";
    userPrompt = JSON.stringify(promptData);
  }

  return callGroq(apiKey, systemInstruction, userPrompt);
}

function callGroq(apiKey, systemInstruction, userPrompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const payload = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 2000
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    throw new Error("Groq API Call failed: " + responseCode + " - " + responseBody);
  }

  const json = JSON.parse(responseBody);
  if (json.choices && json.choices[0].message.content) {
    return json.choices[0].message.content;
  }
  throw new Error("Invalid output received from Groq.");
}

// -------------------------------------------------------------
// SPREADSHEET SERVICES
// -------------------------------------------------------------

function getSchedule() {
  const sheet = getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < values.length; i++) {
    data.push({ id: values[i][0], subject: values[i][1], date: values[i][2], time: values[i][3], faculty: values[i][4], room: values[i][5], createdAt: values[i][6] });
  }
  return data;
}

function addSchedule(data) {
  const sheet = getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  const id = "SCH-" + Date.now();
  const createdAt = new Date().toISOString();
  sheet.appendRow([id, data.subject, data.date, data.time, data.faculty || "", data.room || "", createdAt]);
  return { id: id, subject: data.subject, date: data.date, time: data.time };
}

function deleteSchedule(id) {
  const sheet = getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return "Deleted.";
    }
  }
  throw new Error("Not found.");
}

function getAssignments() {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < values.length; i++) {
    data.push({ id: values[i][0], subject: values[i][1], title: values[i][2], dueDate: values[i][3], priority: values[i][4], status: values[i][5], createdAt: values[i][6] });
  }
  return data;
}

function addAssignment(data) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const id = "ASG-" + Date.now();
  const createdAt = new Date().toISOString();
  sheet.appendRow([id, data.subject, data.title, data.dueDate, data.priority, data.status || "To Do", createdAt]);
  return { id: id, title: data.title, status: data.status || "To Do" };
}

function updateAssignment(id, status) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 6).setValue(status);
      return "Updated.";
    }
  }
  throw new Error("Not found.");
}

function deleteAssignment(id) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return "Deleted.";
    }
  }
  throw new Error("Not found.");
}

function getNotes() {
  const sheet = getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < values.length; i++) {
    data.push({ id: values[i][0], subject: values[i][1], title: values[i][2], originalText: values[i][3], aiSummary: values[i][4], createdAt: values[i][5] });
  }
  return data;
}

function saveNotes(data) {
  const sheet = getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  const id = "NTE-" + Date.now();
  const createdAt = new Date().toISOString();
  sheet.appendRow([id, data.subject, data.title, data.originalText, data.aiSummary, createdAt]);
  return { id: id, title: data.title };
}

function getStudyPlans() {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  const values = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < values.length; i++) {
    data.push({ id: values[i][0], date: values[i][1], subject: values[i][2], task: values[i][3], duration: values[i][4], completed: values[i][5] === true || values[i][5] === "true" });
  }
  return data;
}

function saveStudyPlan(planList) {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  sheet.clearContents();
  sheet.appendRow(["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  sheet.getRange(1, 1, 1, 6).setFontWeight("bold");

  planList.forEach((plan, idx) => {
    const id = "PLN-" + Date.now() + "-" + idx;
    sheet.appendRow([id, plan.date, plan.subject, plan.task, plan.duration || 60, false]);
  });
  return "Saved.";
}

function updateStudyPlan(id, completed) {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 6).setValue(completed);
      return "Updated.";
    }
  }
  throw new Error("Not found.");
}

function getProgress() {
  const sheet = getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
  const values = sheet.getDataRange().getValues();
  const data = [];
  for (let i = 1; i < values.length; i++) {
    data.push({ id: values[i][0], subject: values[i][1], hoursStudied: Number(values[i][2]), topicsCompleted: Number(values[i][3]), updatedAt: values[i][4] });
  }
  return data;
}

function updateProgress(data) {
  const sheet = getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
  const values = sheet.getDataRange().getValues();
  const updatedAt = new Date().toISOString();

  for (let i = 1; i < values.length; i++) {
    if (values[i][1].toLowerCase() === data.subject.toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(Number(data.hoursStudied));
      sheet.getRange(i + 1, 4).setValue(Number(data.topicsCompleted));
      sheet.getRange(i + 1, 5).setValue(updatedAt);
      return "Updated.";
    }
  }

  const id = "PRG-" + Date.now();
  sheet.appendRow([id, data.subject, Number(data.hoursStudied), Number(data.topicsCompleted), updatedAt]);
  return "Added.";
}

function getDashboard() {
  const schedule = getSchedule();
  const assignments = getAssignments();
  const notes = getNotes();
  const progressList = getProgress();
  const studyPlans = getStudyPlans();

  const totalClasses = schedule.length;
  const pendingAssignments = assignments.filter(a => a.status !== "Completed").length;
  const completedAssignments = assignments.filter(a => a.status === "Completed").length;
  const totalNotes = notes.length;
  
  let totalHoursStudied = 0;
  progressList.forEach(p => totalHoursStudied += p.hoursStudied);

  const upcomingClasses = schedule.slice(0, 3);
  const criticalAssignments = assignments
    .filter(a => a.status !== "Completed")
    .sort((a, b) => {
      const priorMap = { "High": 3, "Medium": 2, "Low": 1 };
      return priorMap[b.priority] - priorMap[a.priority];
    })
    .slice(0, 3);

  const recentNotes = notes.slice(-3).reverse();

  return {
    classesCount: totalClasses,
    pendingAssignments: pendingAssignments,
    completedAssignments: completedAssignments,
    notesCount: totalNotes,
    hoursStudied: totalHoursStudied,
    upcomingClasses: upcomingClasses,
    criticalAssignments: criticalAssignments,
    studyPlans: studyPlans,
    recentNotes: recentNotes,
    progressSummary: progressList
  };
}
