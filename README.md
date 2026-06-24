# Aura Study AI - AI Academic Planner & Study Assistant

Aura Study AI is a production-grade, AI-powered Academic Planner designed to help students manage schedules, track assignments via a 4-column Kanban board, log study progress, generate study plans, and compile high-yield note summaries using Groq's **Llama 3.3 70B** model. 

The application utilizes a **Google Sheets database** via a **Google Apps Script Web App** backend. It runs completely serverless without requiring Node.js or Express in production, communicating securely from the browser directly to Google Apps Script.

---

## 🔒 Security Architecture (Zero-Leak Design)
To prevent exposing sensitive keys, **no API keys are stored in the frontend source code**. 
- The client calls the Google Apps Script backend at `action=ai` via `POST` requests.
- The Google Apps Script backend retrieves the `GROQ_API_KEY` securely from the Google Apps Script **Script Properties** settings.
- The backend communicates with the Groq API using Google's secure `UrlFetchApp` and returns the formatted response back to the client.

---

## 📂 Project Structure

```text
├── index.html                  # Single Page Application structured HTML
├── package.json                # Node dev dependencies for local server (Vite)
├── package-lock.json           # Node lock file
├── README.md                   # Setup & deployment manual
└── assets                      # Frontend and Backend Assets
    ├── backend
    │   └── Code.gs             # Backend database & AI router script for Google Apps Script
    ├── css
    │   └── styles.css          # Glassmorphism design system & light/dark mode stylesheet
    └── js
        ├── api.js              # Central integration client (fetch web app / offline mock engine)
        ├── app.js              # Main application router and view controller
        ├── config.js           # Public environment configuration (Google Web App URL)
        ├── components
        │   ├── modal.js        # Dialog & modal controllers
        │   ├── sidebar.js      # Navigation menu updates
        │   └── toast.js        # User notices and toast prompts
        ├── modules
        │   ├── assignment.js   # 4-column Kanban board with Drag & Drop
        │   ├── dashboard.js    # Statistics aggregator & SVG widgets
        │   ├── notes.js        # AI Note Summarizer (JSON response parser)
        │   ├── planner.js      # Timetable Scheduler and AI Study Planner
        │   ├── progress.js     # Study hours database logger & SVG progress charts
        │   └── schedule.js     # Class timetables listing & modifications
        └── utils
            └── helpers.js      # Date formatters, HTML element creators, & cleaners
```

---

## 🚀 Deployment Guide

### Phase 1: Setup Google Sheets Database
1. Go to [Google Sheets](https://sheets.google.com/) and create a new blank spreadsheet.
2. Title the spreadsheet **`Aura Study AI Database`** (or any title you prefer).
3. Copy the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`.
4. Leave the spreadsheet empty! The Apps Script backend has an automatic database initializer (`initializeDatabase()`) that will create the following worksheets with their headers automatically on the first request:
   - **`Schedule`**
   - **`Assignments`**
   - **`Notes`**
   - **`StudyPlans`**
   - **`Progress`**

---

### Phase 2: Deploy Google Apps Script Web App
1. Inside your Google Sheet, click **Extensions** → **Apps Script** in the top menu.
2. Erase any boilerplate template code in the editor.
3. Open [assets/backend/Code.gs](file:///c:/Users/ROHITH%20KARTHIKEYA/Downloads/vibecoding/assets/backend/Code.gs), copy its entire content, and paste it into the Apps Script editor. Save the project (`Ctrl + S`).
4. Set up your Groq API Key:
   - Click the gear icon on the left panel (**Project Settings**).
   - Scroll down to the **Script Properties** section.
   - Click **Add script property**.
   - Set the Property Name to: `GROQ_API_KEY`
   - Set the Value to: *your actual Groq API Key* (obtainable from [Groq Console](https://console.groq.com/)).
   - Click **Save script properties**.
5. Deploy the Web App:
   - Click the blue **Deploy** button (top right) → **New deployment**.
   - Click the gear icon next to "Select type" and select **Web app**.
   - Set the following exact configurations:
     - **Description**: `Aura Study AI Production Backend`
     - **Execute as**: **`Me (your-email@gmail.com)`**
     - **Who has access**: **`Anyone`** *(Required to accept cross-origin requests from the browser frontend)*
   - Click **Deploy**.
6. Authorize access when prompted:
   - Click **Authorize access**, choose your Google Account, click **Advanced** (bottom left), select **Go to Aura Study AI Database (unsafe)**, and click **Allow**.
7. Copy the generated **Web App URL** (which ends in `/exec`).

---

### Phase 3: Configure Frontend Variables
Open [assets/js/config.js](file:///c:/Users/ROHITH%20KARTHIKEYA/Downloads/vibecoding/assets/js/config.js) in the project directory and paste your connection URL:

```javascript
// assets/js/config.js
export const APPS_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

> [!NOTE]
> If `APPS_SCRIPT_URL` is left empty `""`, Aura Study AI will automatically start in **Offline Fallback Simulation Mode**, allowing you to preview and evaluate the entire UI using local storage.

---

### Phase 4: Run and Test Locally
1. Install any development dependencies and run the local Vite compiler:
   ```bash
   npm install
   npm run dev
   ```
2. Open the URL shown in the console (usually **`http://localhost:5173/`**).
3. Try adding classes or logging study efforts. If you configure the Web App URL, it will sync with Google Sheets.
4. Try using the Note Summarizer or the study planner. The app sends raw requests to the backend, which proxies them securely to Llama 3.3 70B, preventing credentials leakage.

---

## 🛠️ Troubleshooting Checklist & Common Errors

| Error | Root Cause | Fix Action |
| :--- | :--- | :--- |
| **CORS Blocked** | "Who has access" was not set to *Anyone* in Apps Script configurations. | Deploy → Manage deployments. Edit the deployment, set Access to **Anyone**, save as **New version**, and redeploy. |
| **Permission Denied** | Google sheets access permissions have not been approved. | In the Apps Script editor, run the function `getDashboard()` manually once. This will prompt you with the authorization dialog to grant full permissions to edit sheets. |
| **Undefined / Missing Groq Key** | `GROQ_API_KEY` was not saved or named correctly in Script Properties. | Go to Apps Script Project Settings -> Script Properties. Verify that the key is exactly `GROQ_API_KEY` and the value is correct. |
| **Changes Not Showing Up** | Script code was updated but the Web App deployment version was not bumped. | Google Apps Script requires a **new version** to deploy code changes. Go to Deploy → Manage deployments. Edit, select **New version** from the version dropdown, and click **Deploy**. |
| **Database Sync Errors** | A sheet tab was deleted or modified manually. | Delete all sheet tabs in the spreadsheet except one, rename it to anything, and let the backend automatically re-initialize the sheets by calling the app. |
