import { fetchFromAppsScript } from '../api.js';

let activeSummaryJSON = null;

export async function loadNotesView() {
  const container = document.getElementById('recent-notes-container');
  if (!container) return;

  container.innerHTML = `<div style="padding: 10px; color: var(--color-primary);">Loading notes directory...</div>`;

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
        <div class="assign-item-mini" style="cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-bottom: 10px;" 
             onclick="window.viewNotesDetail('${encodeURIComponent(note.title)}', '${encodeURIComponent(note.subject)}', '${encodeURIComponent(note.aiSummary)}')">
          <span style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${note.title}</span>
          <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: 650;">Subject: ${note.subject}</span>
        </div>
      `;
    });
  } catch (err) {
    console.error("Notes load failed:", err);
  }
}

export async function generateNoteSummary() {
  const text = document.getElementById('summarizer-text').value.trim();
  const subject = document.getElementById('summarizer-subject').value.trim();
  const title = document.getElementById('summarizer-title').value.trim();
  const focus = document.getElementById('summarizer-focus').value;

  if (!text || !subject || !title) {
    alert("Please enter subject, title, and paste note contents!");
    return;
  }

  const outputBox = document.getElementById('summarizer-output-box');
  const emptyEl = document.getElementById('summarizer-empty');

  emptyEl.style.display = 'none';
  outputBox.style.display = 'block';
  outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-primary); font-family: var(--font-mono);"><span style="animation: pulseLight 1s infinite alternate;">Google Apps Script & Llama 3.3 are parsing note structures...</span></div>`;

  try {
    const payload = {
      mode: 'summarize',
      promptData: {
        subject,
        title,
        text,
        focus
      }
    };

    const result = await fetchFromAppsScript('ai', 'POST', payload);
    if (!result.success) {
      outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-danger);">AI Routing Failed: ${result.message}</div>`;
      return;
    }

    // Parse the JSON string from Llama response
    let rawText = result.data;
    // Clean JSON ticks if present
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    activeSummaryJSON = JSON.parse(rawText);

    // Save summary directly to Google Sheets notes archive
    await fetchFromAppsScript('saveNotes', 'POST', {
      subject,
      title,
      originalText: text.substring(0, 1000), // Avoid Sheets cell character length caps
      aiSummary: rawText
    });

    renderTabbedAIOutput(subject, title);
    await loadNotesView();

  } catch (err) {
    console.error("AI summarization failed:", err);
    outputBox.innerHTML = `<div class="empty-state-text" style="color: var(--color-danger);">JSON Parse Error. Make sure your Apps Script project has authorized Groq calls.</div>`;
  }
}

function renderTabbedAIOutput(subject, title) {
  const outputBox = document.getElementById('summarizer-output-box');
  if (!outputBox || !activeSummaryJSON) return;

  outputBox.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid var(--border-glass); padding-bottom:12px; margin-bottom:15px;">
      <div>
        <h2 style="font-size:1.2rem; color:var(--text-primary); font-weight:700;">${title}</h2>
        <span style="font-size:0.75rem; color:var(--color-primary); font-weight:650;">Course: ${subject}</span>
      </div>
      <button class="secondary-btn" id="btn-export-current-pdf" style="padding:6px 12px; font-size:0.75rem;">Export PDF</button>
    </div>
    
    <!-- Tabbed navigation header -->
    <div class="ai-tabs-nav" style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border-glass); padding-bottom:10px; overflow-x:auto;">
      <button class="tab-nav-btn active" data-tab="tab-summary">Summary</button>
      <button class="tab-nav-btn" data-tab="tab-cards">Flashcards</button>
      <button class="tab-nav-btn" data-tab="tab-quiz">Quiz</button>
      <button class="tab-nav-btn" data-tab="tab-revision">Revision Strategy</button>
    </div>

    <!-- Summary Content tab -->
    <div class="tab-panel active" id="tab-summary">
      <p style="line-height:1.5; color:var(--text-primary); margin-bottom:15px;">${activeSummaryJSON.summary}</p>
      
      <h3 style="font-size:0.95rem; text-transform:uppercase; color:var(--color-accent); margin-bottom:10px;">Key Concepts</h3>
      <ul class="summary-bullets" style="margin-bottom:15px;">
        ${activeSummaryJSON.keyConcepts.map(c => `<li>${c}</li>`).join('')}
      </ul>

      <h3 style="font-size:0.95rem; text-transform:uppercase; color:var(--color-accent); margin-bottom:10px;">Important Definitions</h3>
      <ul class="summary-bullets" style="margin-bottom:15px;">
        ${activeSummaryJSON.definitions.map(d => `<li><b>${d.term}:</b> ${d.description}</li>`).join('')}
      </ul>

      ${activeSummaryJSON.formulas && activeSummaryJSON.formulas.length > 0 ? `
        <h3 style="font-size:0.95rem; text-transform:uppercase; color:var(--color-accent); margin-bottom:10px;">Important Formulae</h3>
        <ul class="summary-bullets" style="margin-bottom:15px;">
          ${activeSummaryJSON.formulas.map(f => `<li><code>${f}</code></li>`).join('')}
        </ul>
      ` : ''}
    </div>

    <!-- Flashcards tab -->
    <div class="tab-panel" id="tab-cards" style="display:none;">
      <div class="flashcards-deck" style="display:grid; grid-template-columns:1fr; gap:16px; perspective: 1000px;">
        ${activeSummaryJSON.flashcards.map((c, idx) => `
          <div class="flashcard-card" style="min-height:150px; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:var(--radius-md); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center; cursor:pointer; position:relative; transition: transform 0.6s; transform-style: preserve-3d;" onclick="this.classList.toggle('flipped')">
            <div class="card-side front" style="backface-visibility: hidden; font-weight:600;">
              ${c.front}
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:15px;">Click to Reveal Definition</div>
            </div>
            <div class="card-side back" style="position: absolute; width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:20px; backface-visibility: hidden; transform: rotateY(180deg); color:var(--color-primary); font-weight:550; background:rgba(139,92,246,0.05); border-radius:var(--radius-md);">
              ${c.back}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Quiz Tab -->
    <div class="tab-panel" id="tab-quiz" style="display:none;">
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${activeSummaryJSON.examQuestions.map((q, idx) => `
          <div style="padding:15px; background:rgba(255,255,255,0.02); border:1px solid var(--border-glass); border-radius:var(--radius-md);">
            <div style="font-weight:600; color:var(--text-primary); margin-bottom:8px;">Q${idx+1}: ${q.question}</div>
            <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">Reveal Answer</button>
            <div style="display:none; margin-top:10px; color:var(--color-success); font-weight:500;">
              Answer: ${q.answer}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Revision Strategy Tab -->
    <div class="tab-panel" id="tab-revision" style="display:none;">
      <h3 style="font-size:0.95rem; text-transform:uppercase; color:var(--color-accent); margin-bottom:10px;">Revision Tips</h3>
      <ul class="summary-bullets" style="margin-bottom:15px;">
        ${activeSummaryJSON.revisionTips.map(t => `<li>${t}</li>`).join('')}
      </ul>

      <h3 style="font-size:0.95rem; text-transform:uppercase; color:var(--color-accent); margin-bottom:10px;">Possible Interview Questions</h3>
      <ul class="summary-bullets" style="margin-bottom:15px;">
        ${activeSummaryJSON.interviewQuestions.map(q => `<li><b>Q:</b> ${q.question}<br><span style="color:var(--text-secondary);">A: ${q.answer}</span></li>`).join('')}
      </ul>
    </div>
  `;

  // Attach tabs click toggle logic
  const tabBtns = outputBox.querySelectorAll('.tab-nav-btn');
  const tabPanels = outputBox.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetId = btn.getAttribute('data-tab');
      tabPanels.forEach(p => {
        if (p.id === targetId) {
          p.style.display = 'block';
        } else {
          p.style.display = 'none';
        }
      });
    });
  });

  // Export current summary PDF triggers print
  document.getElementById('btn-export-current-pdf').addEventListener('click', () => {
    window.print();
  });
}

// Global viewer callback triggered from notes list click
window.viewNotesDetail = function(titleEnc, subjectEnc, summaryEnc) {
  const title = decodeURIComponent(titleEnc);
  const subject = decodeURIComponent(subjectEnc);
  const summaryRaw = decodeURIComponent(summaryEnc);

  const outputBox = document.getElementById('summarizer-output-box');
  const emptyEl = document.getElementById('summarizer-empty');

  emptyEl.style.display = 'none';
  outputBox.style.display = 'block';

  try {
    activeSummaryJSON = JSON.parse(summaryRaw);
    renderTabbedAIOutput(subject, title);
  } catch {
    // String fallback if parsed incorrectly
    outputBox.innerHTML = `
      <h2>${title}</h2>
      <span style="font-size:0.75rem; color:var(--color-primary); font-weight:650;">Course: ${subject}</span>
      <div class="summary-content" style="margin-top:15px; line-height:1.5;">${summaryRaw}</div>
    `;
  }
};
