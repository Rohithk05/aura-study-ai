import { fetchFromAppsScript, callAI } from './api.js';

let currentSummaryText = "";
let currentSubject = "General";
let currentTitle = "Note Summary";

export async function loadNotesView() {
  const container = document.getElementById('recent-notes-container');
  if (!container) return;

  container.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading notes repository...</div>`;

  try {
    const result = await fetchFromAppsScript('getNotes', 'GET');
    if (!result.success) {
      container.innerHTML = `<div style="color: var(--color-danger);">${result.message}</div>`;
      return;
    }

    const notes = result.data;
    container.innerHTML = '';

    if (notes.length === 0) {
      container.innerHTML = `<div class="empty-state-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 15px;">No saved summaries. Generate one below!</div>`;
      return;
    }

    notes.reverse().forEach(note => {
      container.innerHTML += `
        <div class="assign-item-mini" style="cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-bottom: 10px;" onclick="window.viewNotesDetail('${encodeURIComponent(note.title)}', '${encodeURIComponent(note.subject)}', '${encodeURIComponent(note.aiSummary)}')">
          <span style="font-weight: 600; color: var(--text-white); font-size: 0.9rem;">${note.title}</span>
          <span style="font-size: 0.75rem; color: var(--color-accent); font-weight: 650;">Subject: ${note.subject}</span>
        </div>
      `;
    });
  } catch (err) {
    console.error("Notes load failed:", err);
  }
}

export async function generateNoteSummary() {
  const originalText = document.getElementById('summarizer-text').value.trim();
  const subjectInput = document.getElementById('summarizer-subject') ? document.getElementById('summarizer-subject').value.trim() : 'General';
  const titleInput = document.getElementById('summarizer-title') ? document.getElementById('summarizer-title').value.trim() : 'Lecture Notes';
  const focusStyle = document.getElementById('summarizer-focus').value;

  if (!originalText) {
    alert("Please paste your lecture notes or text content first!");
    return;
  }

  const outputBox = document.getElementById('summarizer-output-box');
  const emptyEl = document.getElementById('summarizer-empty');

  emptyEl.style.display = 'none';
  outputBox.style.display = 'block';
  outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Llama 3.3 70B is analyzing and structuring notes...</span></div>`;

  const systemInstruction = `
    You are AURA Study AI, a high-yield academic note summarizer. 
    Analyze the raw lecture text and format the output into clean, structured HTML blocks without code blocks.
    Structure the response precisely as:
    <h2>[Main Lecture Subject/Topic Name]</h2>
    <div class="summary-section">
      <div class="summary-subheading">MAIN SUMMARY POINTS</div>
      <ul class="summary-bullets">
        <li>Bullet point summarizing core details.</li>
      </ul>
    </div>
    <div class="summary-section">
      <div class="summary-subheading">IMPORTANT DEFINITIONS & FORMULAS</div>
      <ul class="summary-bullets">
        <li><b>Term Name:</b> Clear operational explanation.</li>
      </ul>
    </div>
    <div class="summary-section">
      <div class="summary-subheading">EXAM CRITICAL REVISION INDEX</div>
      <ul class="summary-bullets">
        <li>Topics/calculations highly likely to appear on test papers.</li>
      </ul>
    </div>
  `;

  const prompt = `Focus Mode: ${focusStyle}\nSubject: ${subjectInput}\nTitle: ${titleInput}\nText:\n${originalText}`;
  const response = await callAI(prompt, systemInstruction);

  if (response) {
    currentSummaryText = response;
    currentSubject = subjectInput;
    currentTitle = titleInput;

    outputBox.innerHTML = `
      <div class="notes-action-bar" style="margin-bottom: 15px; display: flex; gap: 8px;">
        <button class="secondary-btn" id="btn-gen-flashcards" style="padding: 6px 12px; font-size: 0.75rem;">Generate Flashcards</button>
        <button class="secondary-btn" id="btn-gen-quiz" style="padding: 6px 12px; font-size: 0.75rem;">Generate Quiz</button>
        <button class="secondary-btn" id="btn-gen-revision" style="padding: 6px 12px; font-size: 0.75rem;">Revision strategy</button>
      </div>
      <div class="summary-content">${response}</div>
    `;

    // Bind dynamic support triggers
    document.getElementById('btn-gen-flashcards').addEventListener('click', () => generateStudySupport('flashcards'));
    document.getElementById('btn-gen-quiz').addEventListener('click', () => generateStudySupport('quiz'));
    document.getElementById('btn-gen-revision').addEventListener('click', () => generateStudySupport('revision'));

    // Save summary asynchronously to Sheets database
    await fetchFromAppsScript('saveNotes', 'POST', {
      subject: subjectInput,
      title: titleInput,
      originalText: originalText.substring(0, 1000), // Avoid sheets cell limits
      aiSummary: response
    });
    
    // Refresh notes directory list
    await loadNotesView();
  } else {
    outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-danger);">AI summary generation failed. Check API configurations.</div>`;
  }
}

async function generateStudySupport(type) {
  const outputBox = document.getElementById('summarizer-output-box');
  const originalSummary = outputBox.innerHTML;
  
  outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Llama 3.3 is generating ${type}...</span></div>`;

  let systemInstruction = "";
  let prompt = `Based on this note summary, build a detailed list: \n${currentSummaryText}`;

  if (type === 'flashcards') {
    systemInstruction = "You are an AI study helper. Generate detailed academic flashcards. Return clean HTML lists of concepts and definitions. FORMAT: <b>Concept:</b> Definition details.";
  } else if (type === 'quiz') {
    systemInstruction = "You are an AI study coach. Generate 5 multiple-choice quiz questions with answers clearly marked at the end. Use clean HTML structures.";
  } else {
    systemInstruction = "You are an AI planner. Create a high-yield study revision timeline based on these notes. Suggest what to focus on first, next, and right before the exam. Return clean HTML lists.";
  }

  const response = await callAI(prompt, systemInstruction);

  outputBox.innerHTML = `
    <div style="margin-bottom: 15px; display: flex; gap: 8px;">
      <button class="glow-btn" id="btn-back-to-summary" style="padding: 6px 12px; font-size: 0.75rem;">← Back to Summary</button>
    </div>
    <div class="support-content" style="animation: fadeIn 0.3s ease;">
      <h2>Generated ${type.toUpperCase()}</h2>
      <br>
      ${response}
    </div>
  `;

  document.getElementById('btn-back-to-summary').addEventListener('click', () => {
    outputBox.innerHTML = originalSummary;
    // Re-bind actions since elements were redrawn
    document.getElementById('btn-gen-flashcards').addEventListener('click', () => generateStudySupport('flashcards'));
    document.getElementById('btn-gen-quiz').addEventListener('click', () => generateStudySupport('quiz'));
    document.getElementById('btn-gen-revision').addEventListener('click', () => generateStudySupport('revision'));
  });
}

// Global viewer triggered from list click
window.viewNotesDetail = function(titleEnc, subjectEnc, summaryEnc) {
  const title = decodeURIComponent(titleEnc);
  const subject = decodeURIComponent(subjectEnc);
  const summary = decodeURIComponent(summaryEnc);

  const outputBox = document.getElementById('summarizer-output-box');
  const emptyEl = document.getElementById('summarizer-empty');

  emptyEl.style.display = 'none';
  outputBox.style.display = 'block';

  currentSummaryText = summary;
  currentSubject = subject;
  currentTitle = title;

  outputBox.innerHTML = `
    <div class="notes-action-bar" style="margin-bottom: 15px; display: flex; gap: 8px;">
      <button class="secondary-btn" id="btn-gen-flashcards" style="padding: 6px 12px; font-size: 0.75rem;">Generate Flashcards</button>
      <button class="secondary-btn" id="btn-gen-quiz" style="padding: 6px 12px; font-size: 0.75rem;">Generate Quiz</button>
      <button class="secondary-btn" id="btn-gen-revision" style="padding: 6px 12px; font-size: 0.75rem;">Revision strategy</button>
    </div>
    <h2>${title}</h2>
    <h4 style="color: var(--color-accent); margin-bottom: 10px;">Subject: ${subject}</h4>
    <div class="summary-content">${summary}</div>
  `;

  document.getElementById('btn-gen-flashcards').addEventListener('click', () => generateStudySupport('flashcards'));
  document.getElementById('btn-gen-quiz').addEventListener('click', () => generateStudySupport('quiz'));
  document.getElementById('btn-gen-revision').addEventListener('click', () => generateStudySupport('revision'));
};
