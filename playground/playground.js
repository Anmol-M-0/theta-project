/**
 * @file playground.js
 * @description Theta Engine v0.5 Interactive Studio & Reactive Workbench.
 */

import {
  createThetaEngine,
  MemoryStorageAdapter,
  createStoreAdapter,
  createCommandHistory,
  generateTypeScript,
  canonicalize
} from "./theta.js";

import {
  conveyanceDeedSchema,
  notice138Schema,
  minimalBranchingSchema
} from "./schemas.js";

// Global Workbench State
let engine = null;
let adapter = null;
let history = null;
let currentSchema = conveyanceDeedSchema;
let transactionHistory = [];
let invalidationMessage = null;
let showingTsTypes = false;

const schemasMap = {
  conveyance: conveyanceDeedSchema,
  notice138: notice138Schema,
  branching: minimalBranchingSchema
};

/**
 * Initializes Theta Engine instance with selected schema and framework adapter.
 */
function initEngine(schema) {
  if (adapter) {
    try { adapter.destroy(); } catch (_) {}
  }

  currentSchema = schema;
  transactionHistory = [];
  invalidationMessage = null;
  showingTsTypes = false;

  engine = createThetaEngine({
    schema: currentSchema,
    storage: new MemoryStorageAdapter()
  });

  // Wrap with v0.5 Universal Store Adapter
  adapter = createStoreAdapter(engine);

  // Initialize v0.5 Time-Travel Command History
  history = createCommandHistory(engine);

  // Subscribe reactively through StoreAdapter
  adapter.subscribe(() => {
    updateUI();
  });

  // Track invalidated events
  engine.subscribe((state, event) => {
    if (event?.invalidatedPaths && event.invalidatedPaths.length > 0) {
      invalidationMessage = `Atomic Branch Invalidation: Purged stale paths [${event.invalidatedPaths.join(", ")}] in single tick`;
      transactionHistory.unshift({
        time: new Date().toLocaleTimeString(),
        type: "BRANCH_PURGED",
        path: event.invalidatedPaths.join(", "),
        isInvalidation: true
      });
    }
  });

  updateUI();
}

/**
 * Global UI Update Orchestrator
 */
function updateUI() {
  renderQuestionPanel();
  renderFactsPanel();
  renderReviewPanel();
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById("btnUndo");
  const btnRedo = document.getElementById("btnRedo");
  if (btnUndo && history) {
    btnUndo.disabled = !history.canUndo();
    btnUndo.style.opacity = history.canUndo() ? "1" : "0.45";
  }
  if (btnRedo && history) {
    btnRedo.disabled = !history.canRedo();
    btnRedo.style.opacity = history.canRedo() ? "1" : "0.45";
  }
}

/**
 * Renders Column 1: Active Question Card Projection
 */
function renderQuestionPanel() {
  const container = document.getElementById("intakePanelBody");
  if (!container || !engine) return;

  const activeQ = engine.getActiveQuestion();
  const reviewTree = engine.getReviewTree();
  const stats = reviewTree.stats || {};

  const total = stats.totalEligible ?? stats.total ?? 0;
  const completed = stats.completed ?? stats.complete ?? 0;

  // Progress Bar
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressFill = document.getElementById("progressFill");
  const progressMetrics = document.getElementById("progressMetrics");
  if (progressFill && progressMetrics) {
    progressFill.style.width = `${progressPercent}%`;
    progressMetrics.textContent = `${completed} of ${total} Answered (${progressPercent}%)`;
  }

  // Check if intake is fully completed
  if (!activeQ) {
    container.innerHTML = `
      <div class="completion-banner">
        <div class="completion-icon">✓</div>
        <h3 class="completion-title">Draft Intake Complete!</h3>
        <p class="completion-desc">All ${total} eligible questions have been answered. The canonical facts are fully prepared for document synthesis.</p>
        <button class="btn-primary" id="btnRestartDraft">Reset & Start New Draft</button>
      </div>
    `;
    document.getElementById("btnRestartDraft")?.addEventListener("click", () => {
      initEngine(currentSchema);
    });
    return;
  }

  const qId = activeQ.questionId || activeQ.id;
  const section = currentSchema.sections.find(s => s.id === activeQ.sectionId);
  const sectionTitle = activeQ.sectionTitle || (section ? section.title : "Document Intake");

  let alertHtml = "";
  if (invalidationMessage) {
    alertHtml = `
      <div class="invalidation-alert">
        <span>⚡</span>
        <div>${invalidationMessage}</div>
      </div>
    `;
  }

  let inputHtml = "";
  const currentVal = activeQ.currentValue ?? activeQ.value;

  if (activeQ.kind === "card" && Array.isArray(activeQ.options)) {
    inputHtml = `
      <div class="options-grid">
        ${activeQ.options.map((opt, idx) => {
          const isSel = currentVal === opt.value;
          return `
            <div class="option-card ${isSel ? 'selected' : ''}" data-value="${opt.value}" data-index="${idx + 1}" role="button" tabindex="0">
              <div class="option-left">
                <span class="option-label">${opt.label}</span>
                ${opt.hint ? `<span class="option-hint">${opt.hint}</span>` : ''}
              </div>
              <span class="option-key">${idx + 1}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (activeQ.kind === "number" || activeQ.kind === "currency") {
    inputHtml = `
      <input type="number" id="activeInput" class="input-control" placeholder="Enter numeric amount..." value="${currentVal !== undefined && currentVal !== null ? currentVal : ''}" autofocus />
    `;
  } else if (activeQ.kind === "date") {
    inputHtml = `
      <input type="date" id="activeInput" class="input-control" value="${currentVal || ''}" autofocus />
    `;
  } else {
    inputHtml = `
      <input type="text" id="activeInput" class="input-control" placeholder="Enter text..." value="${currentVal || ''}" autofocus />
    `;
  }

  container.innerHTML = `
    ${alertHtml}
    <div class="section-tag">${sectionTitle}</div>
    <h2 class="question-title">${activeQ.label}</h2>
    ${activeQ.description ? `<p class="question-desc">${activeQ.description}</p>` : ''}
    
    <div id="inputWrapper">
      ${inputHtml}
    </div>

    <div class="intake-actions">
      <button class="btn-secondary" id="btnPrevQuestion">
        ← Back
      </button>
      <button class="btn-primary" id="btnNextQuestion">
        Continue <span>↵</span>
      </button>
    </div>
  `;

  // Attach card click handlers (immediate selection + commit)
  container.querySelectorAll(".option-card").forEach(card => {
    card.addEventListener("click", () => {
      const val = card.getAttribute("data-value");
      container.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      commitAnswer(activeQ, val);
    });
  });

  // Attach Next/Continue handler
  document.getElementById("btnNextQuestion")?.addEventListener("click", () => {
    if (activeQ.kind === "card") {
      const selected = container.querySelector(".option-card.selected");
      if (selected) {
        commitAnswer(activeQ, selected.getAttribute("data-value"));
      } else if (activeQ.options && activeQ.options.length > 0) {
        commitAnswer(activeQ, activeQ.options[0].value);
      }
    } else {
      const inputEl = document.getElementById("activeInput");
      if (inputEl) {
        let val = inputEl.value.trim();
        if ((activeQ.kind === "number" || activeQ.kind === "currency") && val !== "") {
          val = Number(val);
        }
        commitAnswer(activeQ, val);
      }
    }
  });

  // Enter key handler on inputs
  const activeInput = document.getElementById("activeInput");
  if (activeInput) {
    activeInput.focus();
    activeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        document.getElementById("btnNextQuestion")?.click();
      }
    });
  }

  // Back button handler
  document.getElementById("btnPrevQuestion")?.addEventListener("click", () => {
    const allQuestions = [];
    (reviewTree.sections || []).forEach(sec => {
      const children = sec.children || sec.questions || [];
      children.forEach(ch => {
        if (ch.status !== "not-applicable") allQuestions.push(ch);
      });
    });

    const currIdx = allQuestions.findIndex(q => (q.questionId || q.id) === qId);
    if (currIdx > 0) {
      const prevQ = allQuestions[currIdx - 1];
      engine.dispatch({
        type: "SET_CURSOR",
        questionId: prevQ.questionId || prevQ.id
      });
    }
  });
}

/**
 * Commits an answer through the engine transaction pipeline.
 */
function commitAnswer(question, value) {
  const qId = question.questionId || question.id;
  const qPath = question.path;

  invalidationMessage = null;

  try {
    engine.dispatch({
      type: "COMMIT_ANSWER",
      questionId: qId,
      path: qPath,
      value: value
    });

    transactionHistory.unshift({
      time: new Date().toLocaleTimeString(),
      type: "COMMIT_ANSWER",
      path: qPath,
      val: JSON.stringify(value)
    });
  } catch (err) {
    console.error("[Theta Engine Playground] Dispatch error:", err);
  }
}

/**
 * Renders Column 2: Canonical Facts JSON Inspector / TypeScript Generator
 */
function renderFactsPanel() {
  const jsonViewer = document.getElementById("factsJsonViewer");
  const revBadge = document.getElementById("revBadge");
  const factsSizeBadge = document.getElementById("factsSizeBadge");
  const logFeed = document.getElementById("logFeed");
  const factsPanelTitle = document.getElementById("factsPanelTitle");

  if (!engine) return;

  const state = engine.getState();

  if (showingTsTypes) {
    if (factsPanelTitle) factsPanelTitle.textContent = "2. Generated TypeScript Types";
    const tsCode = generateTypeScript(currentSchema);
    if (jsonViewer) jsonViewer.textContent = tsCode;
    if (revBadge) revBadge.textContent = "Type: IntakeSchema";
    if (factsSizeBadge) factsSizeBadge.textContent = `${new Blob([tsCode]).size} bytes`;
  } else {
    if (factsPanelTitle) factsPanelTitle.textContent = "2. Canonical Facts JSON";
    const factsStr = JSON.stringify(state.facts, null, 2);
    if (jsonViewer) jsonViewer.textContent = factsStr;
    if (revBadge) revBadge.textContent = `Revision: ${state.revision}`;
    if (factsSizeBadge) factsSizeBadge.textContent = `${new Blob([factsStr]).size} bytes`;
  }

  if (logFeed) {
    if (transactionHistory.length === 0) {
      logFeed.innerHTML = `<div class="log-item" style="color:var(--text-muted);">No transactions committed yet.</div>`;
    } else {
      logFeed.innerHTML = transactionHistory.slice(0, 6).map(log => `
        <div class="log-item ${log.isInvalidation ? 'invalidation' : ''}">
          <span>${log.isInvalidation ? '⚡ ' : ''}${log.type} (${log.path})</span>
          <span>${log.time}</span>
        </div>
      `).join('');
    }
  }
}

/**
 * Renders Column 3: Master Review Tree Projection
 */
function renderReviewPanel() {
  const container = document.getElementById("reviewTreeContainer");
  if (!container || !engine) return;

  const reviewTree = engine.getReviewTree();

  container.innerHTML = (reviewTree.sections || []).map(section => {
    const children = section.children || section.questions || [];
    const completedCount = section.completedCount ?? children.filter(c => c.status === "complete").length;
    const eligibleCount = section.eligibleCount ?? children.filter(c => c.status !== "not-applicable").length;

    return `
      <div class="review-section">
        <div class="review-section-header">
          <span>${section.label || section.title}</span>
          <span>${completedCount}/${eligibleCount}</span>
        </div>
        <div class="review-items">
          ${children.map(q => {
            const isComplete = q.status === "complete";
            const isApplicable = q.status !== "not-applicable";
            let displayVal = q.value;

            if (displayVal === undefined || displayVal === null || displayVal === "") {
              displayVal = `<span class="review-val empty">${isApplicable ? 'unanswered' : 'not applicable'}</span>`;
            } else if (typeof displayVal === "object") {
              displayVal = JSON.stringify(displayVal);
            }
            
            const qTargetId = q.questionId || q.id;

            return `
              <div class="review-item" style="${!isApplicable ? 'opacity: 0.35;' : ''}">
                <div style="flex:1;">
                  <span class="status-badge ${isComplete ? 'complete' : 'incomplete'}"></span>
                  <span class="review-label">${q.label}</span>
                  <div class="review-val">${displayVal}</div>
                </div>
                ${isApplicable ? `
                  <button class="btn-jump" data-id="${qTargetId}">Edit ↗</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Attach jump button listeners
  container.querySelectorAll(".btn-jump").forEach(btn => {
    btn.addEventListener("click", () => {
      const qId = btn.getAttribute("data-id");
      engine.dispatch({
        type: "SET_CURSOR",
        questionId: qId,
        returnTo: "review"
      });
      invalidationMessage = null;
      updateUI();
    });
  });
}

// Global Keyboard Shortcut Listener (1, 2, 3 for card options)
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  const activeQ = engine?.getActiveQuestion();
  if (!activeQ || activeQ.kind !== "card" || !Array.isArray(activeQ.options)) return;

  const keyNum = parseInt(e.key, 10);
  if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= activeQ.options.length) {
    const opt = activeQ.options[keyNum - 1];
    if (opt) {
      commitAnswer(activeQ, opt.value);
    }
  }
});

// Setup Header Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  const schemaSelect = document.getElementById("schemaSelect");
  if (schemaSelect) {
    schemaSelect.addEventListener("change", (e) => {
      const schemaKey = e.target.value;
      if (schemasMap[schemaKey]) {
        initEngine(schemasMap[schemaKey]);
      }
    });
  }

  // Undo / Redo
  document.getElementById("btnUndo")?.addEventListener("click", () => {
    if (history?.canUndo()) {
      history.undo();
      updateUI();
    }
  });

  document.getElementById("btnRedo")?.addEventListener("click", () => {
    if (history?.canRedo()) {
      history.redo();
      updateUI();
    }
  });

  // Toggle TS Types Viewer
  document.getElementById("btnViewTs")?.addEventListener("click", () => {
    showingTsTypes = !showingTsTypes;
    const btn = document.getElementById("btnViewTs");
    if (btn) {
      btn.textContent = showingTsTypes ? "JSON Facts" : "TS Types";
    }
    renderFactsPanel();
  });

  // Populate Demo Data Button
  document.getElementById("btnFillSample")?.addEventListener("click", () => {
    if (currentSchema.id === "indian_conveyance_deed") {
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "property_type", path: "property.category", value: "apartment" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "apt_floor", path: "property.apartment.floorNumber", value: 5 });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "apt_tower", path: "property.apartment.towerBlock", value: "Tower Cedar, Wing A" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "carpet_area", path: "property.carpetAreaSqFt", value: 1250 });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "seller_type", path: "parties.primarySeller.entityType", value: "company" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "seller_co_name", path: "parties.primarySeller.company.corporateName", value: "Apex Realcon Infra Private Limited" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "seller_co_cin", path: "parties.primarySeller.company.cin", value: "U45200MH2021PTC123456" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "seller_co_director", path: "parties.primarySeller.company.authorizedDirector", value: "Vikram Malhotra" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "total_price", path: "consideration.totalAmountInr", value: 8500000 });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "payment_mode", path: "consideration.primaryPaymentMode", value: "rtgs" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "advance_paid", path: "consideration.tokenAdvancePaid", value: 1000000 });
      engine.dispatch({ type: "CLEAR_CURSOR" });
    } else if (currentSchema.id === "section_138_notice") {
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "cheque_number", path: "cheque.instrumentNumber", value: "084912" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "cheque_amount", path: "cheque.amountInr", value: 450000 });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "cheque_bank", path: "cheque.draweeBank", value: "State Bank of India, MG Road" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "memo_reason", path: "dishonour.returnReason", value: "funds_insufficient" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "memo_date", path: "dishonour.memoDate", value: "2026-08-14" });
      engine.dispatch({ type: "CLEAR_CURSOR" });
    } else {
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "user_type", path: "profile.type", value: "developer" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "github_username", path: "profile.developer.githubUsername", value: "anmol-m-0" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "dev_tier", path: "profile.developer.tier", value: "sponsor" });
      engine.dispatch({ type: "COMMIT_ANSWER", questionId: "dev_sponsor_amount", path: "profile.developer.sponsorAmount", value: 250 });
      engine.dispatch({ type: "CLEAR_CURSOR" });
    }
    updateUI();
  });

  // Reset Draft Button
  document.getElementById("btnResetState")?.addEventListener("click", () => {
    initEngine(currentSchema);
  });

  // Copy JSON Button
  document.getElementById("btnCopyJson")?.addEventListener("click", () => {
    const factsStr = JSON.stringify(engine.getState().facts, null, 2);
    navigator.clipboard.writeText(factsStr).then(() => {
      const btn = document.getElementById("btnCopyJson");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  // Initial startup
  initEngine(conveyanceDeedSchema);
});
