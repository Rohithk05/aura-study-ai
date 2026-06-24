/**
 * Aura Study AI - Google Apps Script Backend Database Controller
 * Attach this script to your Google Sheet (Extensions -> Apps Script)
 * Enable Web App Deployment: Execute as Me, Access: Anyone
 */

// Helper to open active sheet and ensure pages exist
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    // Format headers bold
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

// Ensure all sheets are initialized properly
function initializeDatabase() {
  getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
}

// CORS & Request Routing for GET
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
        responseData = { success: false, message: "Action '" + action + "' is not supported." };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
                       .setMimeType(ContentService.MimeType.JSON);
}

// CORS & Request Routing for POST
function doPost(e) {
  initializeDatabase();
  let responseData = { success: false, message: "Invalid payload or post data." };

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
      default:
        responseData = { success: false, message: "POST action '" + action + "' is not supported." };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
                       .setMimeType(ContentService.MimeType.JSON);
}

// -------------------------------------------------------------
// CORE DATABASE OPERATIONS
// -------------------------------------------------------------

// Schedule CRUD
function getSchedule() {
  const sheet = getOrCreateSheet("Schedule", ["ID", "Subject", "Date", "Time", "Faculty", "Room", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const schedule = [];
  
  for (let i = 1; i < values.length; i++) {
    schedule.push({
      id: values[i][0],
      subject: values[i][1],
      date: values[i][2],
      time: values[i][3],
      faculty: values[i][4],
      room: values[i][5],
      createdAt: values[i][6]
    });
  }
  return schedule;
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
      return "Schedule " + id + " deleted successfully.";
    }
  }
  throw new Error("Schedule with ID " + id + " not found.");
}

// Assignments CRUD
function getAssignments() {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const assignments = [];

  for (let i = 1; i < values.length; i++) {
    assignments.push({
      id: values[i][0],
      subject: values[i][1],
      title: values[i][2],
      dueDate: values[i][3],
      priority: values[i][4],
      status: values[i][5],
      createdAt: values[i][6]
    });
  }
  return assignments;
}

function addAssignment(data) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const id = "ASG-" + Date.now();
  const createdAt = new Date().toISOString();
  sheet.appendRow([id, data.subject, data.title, data.dueDate, data.priority, data.status || "Pending", createdAt]);
  return { id: id, subject: data.subject, title: data.title, dueDate: data.dueDate, priority: data.priority, status: data.status || "Pending" };
}

function updateAssignment(id, status) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 6).setValue(status); // Column F is Status
      return "Assignment status updated.";
    }
  }
  throw new Error("Assignment with ID " + id + " not found.");
}

function deleteAssignment(id) {
  const sheet = getOrCreateSheet("Assignments", ["ID", "Subject", "Title", "DueDate", "Priority", "Status", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return "Assignment " + id + " deleted.";
    }
  }
  throw new Error("Assignment with ID " + id + " not found.");
}

// Notes CRUD
function getNotes() {
  const sheet = getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  const values = sheet.getDataRange().getValues();
  const notes = [];
  for (let i = 1; i < values.length; i++) {
    notes.push({
      id: values[i][0],
      subject: values[i][1],
      title: values[i][2],
      originalText: values[i][3],
      aiSummary: values[i][4],
      createdAt: values[i][5]
    });
  }
  return notes;
}

function saveNotes(data) {
  const sheet = getOrCreateSheet("Notes", ["ID", "Subject", "Title", "OriginalText", "AISummary", "CreatedAt"]);
  const id = "NTE-" + Date.now();
  const createdAt = new Date().toISOString();
  sheet.appendRow([id, data.subject, data.title, data.originalText, data.aiSummary, createdAt]);
  return { id: id, subject: data.subject, title: data.title, aiSummary: data.aiSummary };
}

// Study Timetable CRUD
function getStudyPlans() {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  const values = sheet.getDataRange().getValues();
  const plans = [];
  for (let i = 1; i < values.length; i++) {
    plans.push({
      id: values[i][0],
      date: values[i][1],
      subject: values[i][2],
      task: values[i][3],
      duration: values[i][4],
      completed: values[i][5] === true || values[i][5] === "true"
    });
  }
  return plans;
}

function saveStudyPlan(planList) {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  
  // Clean all previous study plans (optional, to keep it updated with current plan)
  sheet.clearContents();
  sheet.appendRow(["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  sheet.getRange(1, 1, 1, 6).setFontWeight("bold");

  planList.forEach((plan, idx) => {
    const id = "PLN-" + Date.now() + "-" + idx;
    sheet.appendRow([id, plan.date, plan.subject, plan.task, plan.duration || 60, false]);
  });
  return "Study plan saved successfully.";
}

function updateStudyPlan(id, completed) {
  const sheet = getOrCreateSheet("StudyPlans", ["ID", "Date", "Subject", "Task", "Duration", "Completed"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.getRange(i + 1, 6).setValue(completed);
      return "Study plan task status updated.";
    }
  }
  throw new Error("Study plan task not found.");
}

// Progress Metrics CRUD
function getProgress() {
  const sheet = getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
  const values = sheet.getDataRange().getValues();
  const progressList = [];
  for (let i = 1; i < values.length; i++) {
    progressList.push({
      id: values[i][0],
      subject: values[i][1],
      hoursStudied: Number(values[i][2]) || 0,
      topicsCompleted: Number(values[i][3]) || 0,
      updatedAt: values[i][4]
    });
  }
  return progressList;
}

function updateProgress(data) {
  const sheet = getOrCreateSheet("Progress", ["ID", "Subject", "HoursStudied", "TopicsCompleted", "UpdatedAt"]);
  const values = sheet.getDataRange().getValues();
  const updatedAt = new Date().toISOString();

  // Find if subject metrics already exist
  for (let i = 1; i < values.length; i++) {
    if (values[i][1].toLowerCase() === data.subject.toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(Number(data.hoursStudied));
      sheet.getRange(i + 1, 4).setValue(Number(data.topicsCompleted));
      sheet.getRange(i + 1, 5).setValue(updatedAt);
      return "Progress metrics updated for " + data.subject;
    }
  }

  // Create new if absent
  const id = "PRG-" + Date.now();
  sheet.appendRow([id, data.subject, Number(data.hoursStudied), Number(data.topicsCompleted), updatedAt]);
  return "New progress metrics created for " + data.subject;
}

// Aggregate Dashboard stats in a single network trip for optimization
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

  // Sorting utilities
  const upcomingClasses = schedule.slice(0, 3); // Return next 3 classes
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
    studyPlans: studyPlans.slice(0, 5), // Today's plans
    recentNotes: recentNotes,
    progressSummary: progressList
  };
}
