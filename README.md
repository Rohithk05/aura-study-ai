# Aura Study AI - AI Academic Planner & Study Assistant

Aura Study AI is a production-grade, AI-powered Academic Planner designed to help students manage schedules, track assignments via a Kanban board, log study progress, generate study plans, and compile high-yield note summaries using Groq's **Llama 3.3 70B** model. 

The application utilizes a **Google Sheets database** via a **Google Apps Script Web App** backend, running completely serverless without requiring Node.js or Express on the server.

---

## 📂 Project Structure

```text
├── index.html       # Single Page Application structured HTML
├── styles.css       # Unified design system stylesheet (Light/Dark themes)
├── config.js        # Global credential endpoint configurations
├── app.js           # Main bootstrapper & layout controller
├── api.js           # Central Integration Client (fetch calls & Groq)
├── dashboard.js     # Metrics compiler & overview renderer
├── schedule.js      # Class schedules CRUD and timetable blocks
├── assignment.js    # Assignments Kanban tracker & priority tags
├── notes.js         # AI Note Summarizer (Flashcards, Quizzes, Revision)
├── planner.js       # AI Study Planner timetable generator
├── progress.js      # Syllabus completion logging & progress metrics
├── Code.gs          # Backend database logic for Google Apps Script
├── README.md        # This setup & deployment manual
└── package.json     # Node dev dependencies for local server (Vite)
```

---

## 🚀 Deployment Guide

### Phase 1: Setup Google Sheets Database
1. Go to [Google Sheets](https://sheets.google.com/) and create a new blank spreadsheet.
2. Title the spreadsheet **`Aura Study AI Database`**.
3. Create 5 tabs in the spreadsheet and rename them exactly as:
   - **`Schedule`**: Add headers in Row 1: `ID`, `Subject`, `Date`, `Time`, `Faculty`, `Room`, `CreatedAt`
   - **`Assignments`**: Add headers in Row 1: `ID`, `Subject`, `Title`, `DueDate`, `Priority`, `Status`, `CreatedAt`
   - **`Notes`**: Add headers in Row 1: `ID`, `Subject`, `Title`, `OriginalText`, `AISummary`, `CreatedAt`
   - **`StudyPlans`**: Add headers in Row 1: `ID`, `Date`, `Subject`, `Task`, `Duration`, `Completed`
   - **`Progress`**: Add headers in Row 1: `ID`, `Subject`, `HoursStudied`, `TopicsCompleted`, `UpdatedAt`
4. Note: If you leave the tabs blank, the Apps Script backend is designed to automatically initialize these tabs with headers on first run.

---

### Phase 2: Deploy Google Apps Script Web App
1. Inside your Google Sheet, click **Extensions** → **Apps Script** in the top menu.
2. Erase the boilerplate script template.
3. Open **`Code.gs`** in this project folder, copy its contents, and paste it into the Apps Script editor. Save the project (`Ctrl + S`).
4. Click the blue **Deploy** button (top right) → **New deployment**.
5. Click the gear icon next to "Configuration" and select **Web app**.
6. Set these exact settings:
   - **Description**: `Aura Study AI Backend`
   - **Execute as**: **`Me (your-email@gmail.com)`**
   - **Who has access**: **`Anyone`** *(Required to enable external frontend CORS requests)*.
7. Click **Deploy**.
8. Click **Authorize access**, choose your Google Account, click **Advanced** (bottom left), select **Go to Aura Study AI Database (unsafe)**, and hit **Allow**.
9. Copy the generated **Web App URL** (ends in `/exec`).

---

### Phase 3: Setup Groq API Credentials
1. Go to the [Groq Console](https://console.groq.com/) and sign up or log in.
2. Navigate to **API Keys** and click **Create API Key**.
3. Name your key (e.g. `Aura Study AI`) and copy it.

---

### Phase 4: Configure Frontend Variables
Open **`config.js`** in the project directory and paste your connection URLs:

```javascript
// config.js
export const APPS_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"; 

export const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";
```

---

### Phase 5: Run and Test Locally
1. Run the local dev server in your terminal:
   ```bash
   npm run dev
   ```
2. Open the URL shown in the console (usually **`http://localhost:5173/`**).
3. Try adding a schedule or assignment and check if it inserts as a row into your Google Sheets spreadsheet instantly!
4. Try pasting lecture notes in the **Notes Summary** tab and click **Generate AI Summary** to verify the Llama 3.3 model output.

---

## 🛠️ Troubleshooting Checklist & Common Errors

| Error | Root Cause | Fix Action |
|---|---|---|
| **CORS Blocked** | "Who has access" was not set to *Anyone* in Apps Script. | Deploy → Manage deployments. Edit active deployment, set access to **Anyone**, select **New version**, and deploy. |
| **Permission Denied** | Google account permissions have not been approved. | Inside Apps Script editor, run the `getDashboard()` function manually once to trigger authorization popups. |
| **Sheet Not Found** | Tabs have typos or missing columns. | Rename spreadsheet tabs exactly to `Schedule`, `Assignments`, `Notes`, `StudyPlans`, and `Progress` (case-sensitive). |
| **Output Not Updating** | Code modified in Apps Script but not re-deployed. | Google does not publish code updates to the active Web App URL automatically. Go to Deploy → Manage deployments → Edit, select **New version**, and click Deploy. |
| **Blank AI Outputs** | `GROQ_API_KEY` is invalid or empty. | Verify your Groq Key in `config.js` or check your network status. If offline, the app defaults to localized simulation mock logs. |
