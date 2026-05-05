"use strict";

const STORAGE_KEY = "weeklyHoursTracker:v1";
const DEFAULT_THRESHOLD = 40;
const VALID_TABS = ["log", "summary", "people", "settings"];

const DAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" }
];

const DAY_GROUPS = {
  weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  weekend: ["saturday", "sunday"],
  all: DAYS.map((day) => day.key)
};

const QUICK_PRESETS = [
  { key: "off", label: "Off 0h", hours: 0 },
  { key: "half", label: "Half day 5h", hours: 5 },
  { key: "full", label: "Full day 10h", hours: 10 },
  { key: "custom", label: "Custom", hours: null }
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const els = {};
let state = loadState();
let selectedWeekStart = parseDateKey(state.selectedWeekStart) || startOfWeek(new Date());
let activeTab = VALID_TABS.includes(state.lastTab) ? state.lastTab : "log";
let expandedEmployeeId = state.lastExpandedEmployeeId || null;
let saveTimer = null;
let noticeTimer = null;
let focusPersonId = null;

const openNotes = new Set();
const quickFill = {
  employeeId: "",
  preset: "full",
  customHours: "",
  days: new Set(DAY_GROUPS.weekdays)
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  renderApp();
}

function cacheElements() {
  els.saveStatus = document.getElementById("saveStatus");
  els.navTabs = Array.from(document.querySelectorAll("[data-tab]"));
  els.views = Array.from(document.querySelectorAll("[data-view]"));
  els.weekRanges = [
    document.getElementById("weekRangeLog"),
    document.getElementById("weekRangeSummary")
  ];
  els.miniTotal = document.getElementById("miniTotal");
  els.miniActive = document.getElementById("miniActive");
  els.miniWarnings = document.getElementById("miniWarnings");
  els.quickEmployee = document.getElementById("quickEmployee");
  els.quickPresetButtons = document.getElementById("quickPresetButtons");
  els.quickCustomWrap = document.getElementById("quickCustomWrap");
  els.quickCustomHours = document.getElementById("quickCustomHours");
  els.quickDayButtons = document.getElementById("quickDayButtons");
  els.quickApply = document.getElementById("quickApply");
  els.quickFillNotice = document.getElementById("quickFillNotice");
  els.logEmployeeList = document.getElementById("logEmployeeList");
  els.summaryMetrics = document.getElementById("summaryMetrics");
  els.dayTotals = document.getElementById("dayTotals");
  els.employeeTotals = document.getElementById("employeeTotals");
  els.warningSummary = document.getElementById("warningSummary");
  els.addEmployeeForm = document.getElementById("addEmployeeForm");
  els.employeeName = document.getElementById("employeeName");
  els.employeeRole = document.getElementById("employeeRole");
  els.peopleList = document.getElementById("peopleList");
  els.thresholdInput = document.getElementById("thresholdInput");
  els.clearWeek = document.getElementById("clearWeek");
  els.clearAllData = document.getElementById("clearAllData");
  els.exportBackup = document.getElementById("exportBackup");
  els.importBackup = document.getElementById("importBackup");
  els.dataNotice = document.getElementById("dataNotice");
  els.exportCsv = document.getElementById("exportCsv");
  els.printReport = document.getElementById("printReport");
  els.printArea = document.getElementById("printArea");
  els.fabAddEmployee = document.getElementById("fabAddEmployee");
}

function bindEvents() {
  els.navTabs.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const weekButton = event.target.closest("[data-week-action]");
    if (!weekButton) return;
    changeWeek(weekButton.dataset.weekAction);
  });

  els.quickPresetButtons.addEventListener("click", handleQuickPresetClick);
  els.quickDayButtons.addEventListener("click", handleQuickDayClick);
  els.quickCustomHours.addEventListener("keydown", blockInvalidNumberKeys);
  els.quickCustomHours.addEventListener("input", () => {
    if (els.quickCustomHours.value.startsWith("-")) {
      els.quickCustomHours.value = "";
    }
    quickFill.customHours = els.quickCustomHours.value;
  });
  els.quickEmployee.addEventListener("change", () => {
    quickFill.employeeId = els.quickEmployee.value;
  });
  els.quickApply.addEventListener("click", applyQuickFill);

  els.logEmployeeList.addEventListener("click", handleLogClick);
  els.logEmployeeList.addEventListener("input", handleLogInput);
  els.logEmployeeList.addEventListener("keydown", handleLogKeydown);

  els.addEmployeeForm.addEventListener("submit", addEmployee);
  els.peopleList.addEventListener("input", handlePeopleInput);
  els.peopleList.addEventListener("click", handlePeopleClick);

  els.thresholdInput.addEventListener("keydown", blockInvalidNumberKeys);
  els.thresholdInput.addEventListener("input", handleThresholdInput);

  els.clearWeek.addEventListener("click", clearSelectedWeek);
  els.clearAllData.addEventListener("click", clearAllData);
  els.exportBackup.addEventListener("click", exportBackup);
  els.importBackup.addEventListener("change", importBackup);
  els.exportCsv.addEventListener("click", exportCsv);
  els.printReport.addEventListener("click", () => {
    renderPrintReport();
    window.print();
  });
  els.fabAddEmployee.addEventListener("click", () => {
    setActiveTab("people");
    requestAnimationFrame(() => els.employeeName.focus());
  });

  window.addEventListener("beforeprint", renderPrintReport);
}

function renderApp() {
  ensureCurrentWeekEntries();
  keepUiStateValid();
  updateActiveView();
  updateWeekLabels();
  renderMiniSummary();
  renderQuickFill();
  renderLogEmployeeList();
  renderSummaryView();
  renderPeopleView();
  renderSettingsView();
  renderPrintReport();
}

function keepUiStateValid() {
  if (!state.employees.some((employee) => employee.id === expandedEmployeeId)) {
    expandedEmployeeId = null;
  }
  if (!quickFill.employeeId || !state.employees.some((employee) => employee.id === quickFill.employeeId)) {
    quickFill.employeeId = state.employees[0]?.id || "";
  }
}

function updateActiveView() {
  els.navTabs.forEach((button) => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  els.views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === activeTab);
  });

  els.fabAddEmployee.classList.toggle("is-hidden", activeTab === "people");
}

function updateWeekLabels() {
  const label = getWeekRangeLabel();
  els.weekRanges.forEach((node) => {
    if (node) node.textContent = label;
  });
}

function setActiveTab(tab, personToFocus = null) {
  if (!VALID_TABS.includes(tab)) return;
  activeTab = tab;
  focusPersonId = personToFocus;
  saveState();
  renderApp();

  if (focusPersonId) {
    requestAnimationFrame(() => {
      const input = document.querySelector(`[data-person-name][data-employee-id="${cssEscape(focusPersonId)}"]`);
      if (input) input.focus();
      focusPersonId = null;
    });
  }
}

function changeWeek(action) {
  if (action === "previous") selectedWeekStart = addDays(selectedWeekStart, -7);
  if (action === "current") selectedWeekStart = startOfWeek(new Date());
  if (action === "next") selectedWeekStart = addDays(selectedWeekStart, 7);
  saveState();
  renderApp();
}

function renderMiniSummary() {
  const summary = calculateWeekSummary();
  els.miniTotal.textContent = `${formatNumber(summary.combinedTotal)}h`;
  els.miniActive.textContent = String(summary.activeCount);
  els.miniWarnings.textContent = String(summary.warningCount);
}

function renderQuickFill() {
  const options = state.employees.map((employee) => {
    const selected = employee.id === quickFill.employeeId ? " selected" : "";
    return `<option value="${escapeAttr(employee.id)}"${selected}>${escapeHtml(displayEmployeeName(employee))}</option>`;
  });

  els.quickEmployee.innerHTML = options.length ? options.join("") : `<option value="">No employees yet</option>`;
  els.quickEmployee.disabled = !state.employees.length;
  els.quickApply.disabled = !state.employees.length;

  els.quickPresetButtons.replaceChildren(...QUICK_PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.quickPreset = preset.key;
    button.setAttribute("aria-pressed", String(quickFill.preset === preset.key));
    button.textContent = preset.label;
    return button;
  }));

  els.quickCustomWrap.classList.toggle("is-hidden", quickFill.preset !== "custom");
  els.quickCustomHours.value = quickFill.customHours;

  const dayButtons = [
    ...DAYS.map((day) => ({ key: day.key, label: day.short, days: [day.key] })),
    { key: "weekdays", label: "Weekdays", days: DAY_GROUPS.weekdays },
    { key: "weekend", label: "Weekend", days: DAY_GROUPS.weekend },
    { key: "all", label: "All week", days: DAY_GROUPS.all }
  ];

  els.quickDayButtons.replaceChildren(...dayButtons.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.quickDay = item.key;
    button.setAttribute("aria-pressed", String(isQuickDaySelected(item.key, item.days)));
    button.textContent = item.label;
    return button;
  }));
}

function isQuickDaySelected(key, days) {
  if (DAY_GROUPS[key]) {
    return setEquals(quickFill.days, new Set(days));
  }
  return quickFill.days.has(key);
}

function handleQuickPresetClick(event) {
  const button = event.target.closest("[data-quick-preset]");
  if (!button) return;
  quickFill.preset = button.dataset.quickPreset;
  renderQuickFill();
}

function handleQuickDayClick(event) {
  const button = event.target.closest("[data-quick-day]");
  if (!button) return;
  const key = button.dataset.quickDay;

  if (DAY_GROUPS[key]) {
    quickFill.days = new Set(DAY_GROUPS[key]);
  } else if (quickFill.days.has(key)) {
    quickFill.days.delete(key);
  } else {
    quickFill.days.add(key);
  }

  renderQuickFill();
}

function applyQuickFill() {
  const employeeId = els.quickEmployee.value;
  if (!employeeId) {
    showQuickNotice("Add an employee before using Quick Fill.");
    return;
  }

  const hours = getQuickPresetHours();
  if (!hours.valid) {
    els.quickCustomHours.classList.add("is-invalid");
    showQuickNotice("Enter a valid custom hour value.");
    return;
  }
  els.quickCustomHours.classList.remove("is-invalid");

  const days = Array.from(quickFill.days);
  if (!days.length) {
    showQuickNotice("Choose at least one day.");
    return;
  }

  setEmployeeDays(employeeId, days, hours.value);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
  showQuickNotice("Quick Fill applied.");
}

function getQuickPresetHours() {
  const preset = QUICK_PRESETS.find((item) => item.key === quickFill.preset);
  if (!preset) return { valid: false, value: 0 };
  if (preset.key !== "custom") return { valid: true, value: preset.hours };
  return parseHours(els.quickCustomHours.value);
}

function renderLogEmployeeList() {
  if (!state.employees.length) {
    els.logEmployeeList.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.employees.forEach((employee) => {
    fragment.appendChild(createLogEmployeeCard(employee));
  });
  els.logEmployeeList.replaceChildren(fragment);
}

function createLogEmployeeCard(employee) {
  const analysis = analyzeEmployee(employee.id);
  const card = document.createElement("article");
  card.className = `employee-card${expandedEmployeeId === employee.id ? " is-expanded" : ""}`;
  card.dataset.employeeId = employee.id;

  card.innerHTML = `
    <button type="button" class="employee-summary-button" data-log-action="toggle" data-employee-id="${escapeAttr(employee.id)}">
      <div class="employee-summary">
        <div class="employee-main">
          <span class="employee-name">${escapeHtml(displayEmployeeName(employee))}</span>
          <span class="employee-role">${escapeHtml(employee.role || "No role or note")}</span>
          <div class="warning-badges">${renderBadges(analysis.warningBadges)}</div>
        </div>
        <div class="employee-total">
          <strong>${formatNumber(analysis.total)}h</strong>
          <span>Total</span>
        </div>
      </div>
    </button>
    <div class="card-actions">
      <button type="button" class="button tiny secondary" data-log-action="full-week" data-employee-id="${escapeAttr(employee.id)}">Full week</button>
      <button type="button" class="button tiny secondary" data-log-action="clear-week" data-employee-id="${escapeAttr(employee.id)}">Clear</button>
      <button type="button" class="button tiny secondary" data-log-action="edit-person" data-employee-id="${escapeAttr(employee.id)}">Edit</button>
    </div>
    <div class="employee-panel">
      ${renderEmployeePanel(employee)}
    </div>
  `;

  return card;
}

function renderEmployeePanel(employee) {
  return `
    <div class="panel-actions">
      <div class="action-grid">
        <button type="button" class="button secondary" data-log-action="full-week" data-employee-id="${escapeAttr(employee.id)}">Full Week 10h</button>
        <button type="button" class="button secondary" data-log-action="half-week" data-employee-id="${escapeAttr(employee.id)}">Half Week 5h</button>
        <button type="button" class="button secondary" data-log-action="copy-previous" data-employee-id="${escapeAttr(employee.id)}">Copy Previous Week</button>
        <button type="button" class="button secondary" data-log-action="clear-week" data-employee-id="${escapeAttr(employee.id)}">Clear Week</button>
      </div>

      <div class="apply-same">
        <div class="mini-label">Apply same hours</div>
        <div class="apply-controls">
          <label>
            Hours
            <input type="number" min="0" step="0.25" inputmode="decimal" data-apply-hours>
          </label>
          <div class="field-group">
            <span>Days</span>
            <div class="segmented-grid" data-apply-scopes>
              <button type="button" class="segment-button is-selected" aria-pressed="true" data-apply-scope="weekdays">Mon to Fri</button>
              <button type="button" class="segment-button" aria-pressed="false" data-apply-scope="weekend">Sat and Sun</button>
              <button type="button" class="segment-button" aria-pressed="false" data-apply-scope="all">All week</button>
            </div>
          </div>
          <button type="button" class="button primary" data-log-action="apply-same" data-employee-id="${escapeAttr(employee.id)}">Apply</button>
        </div>
      </div>
      <p class="inline-notice" data-card-notice></p>
    </div>
    <div class="day-entry-list">
      ${DAYS.map((day, index) => renderDayEntry(employee.id, day, index)).join("")}
    </div>
  `;
}

function renderDayEntry(employeeId, day, index) {
  const entry = getEmployeeEntry(employeeId);
  const dayEntry = entry.days[day.key];
  const parsed = parseHours(dayEntry.hours);
  const noteKey = getNoteKey(employeeId, day.key);
  const noteOpen = openNotes.has(noteKey);
  const dayDate = addDays(selectedWeekStart, index);
  const classes = [
    "day-entry",
    parsed.empty ? "has-missing" : "",
    !parsed.valid ? "has-invalid" : ""
  ].filter(Boolean).join(" ");

  return `
    <section class="${classes}" data-day-entry="${day.key}">
      <div class="day-top">
        <div class="day-title">
          <strong>${day.label}</strong>
          <span>${formatShortDate(dayDate)}</span>
        </div>
        <div class="day-value">
          <label>
            Hours
            <input type="number" min="0" step="0.25" inputmode="decimal" value="${escapeAttr(dayEntry.hours)}" data-hour-input data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">
          </label>
        </div>
      </div>
      <div class="day-actions">
        <button type="button" class="button tiny secondary" data-log-action="day-preset" data-hours="0" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">Off</button>
        <button type="button" class="button tiny secondary" data-log-action="day-preset" data-hours="5" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">Half day 5h</button>
        <button type="button" class="button tiny secondary" data-log-action="day-preset" data-hours="10" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">Full day 10h</button>
      </div>
      <div class="step-actions">
        <button type="button" class="button tiny secondary" data-log-action="day-step" data-step="1" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">+1</button>
        <button type="button" class="button tiny secondary" data-log-action="day-step" data-step="-1" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">-1</button>
      </div>
      <button type="button" class="button tiny secondary" data-log-action="toggle-note" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">
        ${noteOpen ? "Hide note" : dayEntry.note ? "Edit note" : "Add note"}
      </button>
      <div class="note-wrap${noteOpen ? " is-open" : ""}">
        <label>
          Note
          <textarea rows="2" data-note-input data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">${escapeHtml(dayEntry.note)}</textarea>
        </label>
      </div>
    </section>
  `;
}

function renderSummaryView() {
  const summary = calculateWeekSummary();
  const metrics = [
    { label: "Combined hours", value: `${formatNumber(summary.combinedTotal)}h`, detail: "All employees" },
    { label: "Active employees", value: String(summary.activeCount), detail: "Any hours logged" },
    { label: "Over threshold", value: String(summary.overThreshold.length), detail: `${formatNumber(getThreshold())}h threshold` },
    { label: "Missing entries", value: String(summary.missingEntries.length), detail: "At least one blank day" },
    { label: "Empty weeks", value: String(summary.emptyWeeks.length), detail: "All days empty or 0" }
  ];

  els.summaryMetrics.replaceChildren(...metrics.map(createMetric));
  renderDayTotals(summary);
  renderEmployeeTotals(summary);
  renderWarningSummary(summary);
}

function createMetric(metric) {
  const node = document.createElement("div");
  node.className = "metric";
  node.innerHTML = `
    <span class="label"></span>
    <div class="value"></div>
    <div class="detail"></div>
  `;
  node.querySelector(".label").textContent = metric.label;
  node.querySelector(".value").textContent = metric.value;
  node.querySelector(".detail").textContent = metric.detail;
  return node;
}

function renderDayTotals(summary) {
  const nodes = DAYS.map((day, index) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = `${day.short} ${addDays(selectedWeekStart, index).getDate()}`;
    row.querySelector("span").textContent = `${formatNumber(summary.dayTotals[day.key])}h`;
    return row;
  });
  els.dayTotals.replaceChildren(...nodes);
}

function renderEmployeeTotals(summary) {
  if (!state.employees.length) {
    els.employeeTotals.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const nodes = summary.employees.map((item) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = displayEmployeeName(item.employee);
    row.querySelector("span").textContent = `${formatNumber(item.total)}h`;
    return row;
  });
  els.employeeTotals.replaceChildren(...nodes);
}

function renderWarningSummary(summary) {
  if (!state.employees.length) {
    els.warningSummary.innerHTML = `<div class="empty-state">Warnings will appear after employees are added.</div>`;
    return;
  }

  const badges = [];
  summary.employees.forEach((item) => {
    item.warningBadges.forEach((badge) => {
      badges.push(createBadge(`${displayEmployeeName(item.employee)}: ${badge.label}`, badge.type));
    });
  });

  if (!badges.length) {
    els.warningSummary.replaceChildren(createBadge("No warnings for this week", "ok"));
    return;
  }

  els.warningSummary.replaceChildren(...badges);
}

function createBadge(text, type) {
  const node = document.createElement("span");
  node.className = `badge ${type || ""}`.trim();
  node.textContent = text;
  return node;
}

function renderBadges(badges) {
  if (!badges.length) return `<span class="badge ok">Ready</span>`;
  return badges.map((badge) => `<span class="badge ${badge.type}">${escapeHtml(badge.label)}</span>`).join("");
}

function renderPeopleView() {
  if (!state.employees.length) {
    els.peopleList.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.employees.forEach((employee) => {
    const card = document.createElement("article");
    card.className = "person-card";
    card.dataset.employeeId = employee.id;
    card.innerHTML = `
      <div class="person-fields">
        <label>
          Employee name
          <input type="text" value="${escapeAttr(employee.name)}" autocomplete="off" data-person-name data-employee-id="${escapeAttr(employee.id)}">
        </label>
        <label>
          Role or note
          <input type="text" value="${escapeAttr(employee.role || "")}" autocomplete="off" data-person-role data-employee-id="${escapeAttr(employee.id)}">
        </label>
      </div>
      <button type="button" class="button danger" data-delete-employee data-employee-id="${escapeAttr(employee.id)}">Delete</button>
    `;
    fragment.appendChild(card);
  });
  els.peopleList.replaceChildren(fragment);
}

function renderSettingsView() {
  els.thresholdInput.value = formatNumber(getThreshold());
}

function handleLogClick(event) {
  const scopeButton = event.target.closest("[data-apply-scope]");
  if (scopeButton) {
    selectApplyScope(scopeButton);
    return;
  }

  const button = event.target.closest("[data-log-action]");
  if (!button) return;

  const employeeId = button.dataset.employeeId;
  const action = button.dataset.logAction;

  if (action === "toggle") {
    expandedEmployeeId = expandedEmployeeId === employeeId ? null : employeeId;
    saveState();
    renderLogEmployeeList();
    return;
  }

  if (action === "edit-person") {
    setActiveTab("people", employeeId);
    return;
  }

  if (action === "full-week") {
    applyWeekPattern(employeeId, 10);
    return;
  }

  if (action === "half-week") {
    applyWeekPattern(employeeId, 5);
    return;
  }

  if (action === "clear-week") {
    clearEmployeeWeek(employeeId);
    return;
  }

  if (action === "copy-previous") {
    copyPreviousWeek(employeeId, button.closest(".employee-card"));
    return;
  }

  if (action === "apply-same") {
    applySameHours(employeeId, button.closest(".employee-card"));
    return;
  }

  if (action === "day-preset") {
    setDayHours(employeeId, button.dataset.day, Number(button.dataset.hours));
    return;
  }

  if (action === "day-step") {
    stepDayHours(employeeId, button.dataset.day, Number(button.dataset.step));
    return;
  }

  if (action === "toggle-note") {
    toggleNote(employeeId, button.dataset.day);
  }
}

function handleLogInput(event) {
  const target = event.target;
  if (target.matches("[data-hour-input]")) {
    if (target.value.startsWith("-")) target.value = "";
    const employeeId = target.dataset.employeeId;
    const dayKey = target.dataset.day;
    getEmployeeEntry(employeeId).days[dayKey].hours = target.value;
    saveState();
    updateAfterEmployeeChange(employeeId, target.closest(".employee-card"));
    updateDayEntry(target.closest(".day-entry"), employeeId, dayKey);
    return;
  }

  if (target.matches("[data-note-input]")) {
    const employeeId = target.dataset.employeeId;
    const dayKey = target.dataset.day;
    getEmployeeEntry(employeeId).days[dayKey].note = target.value;
    saveState();
    updateAfterEmployeeChange(employeeId, target.closest(".employee-card"));
  }
}

function handleLogKeydown(event) {
  if (event.target.matches("input[type='number']")) {
    blockInvalidNumberKeys(event);
  }
}

function selectApplyScope(button) {
  const wrap = button.closest("[data-apply-scopes]");
  wrap.querySelectorAll("[data-apply-scope]").forEach((item) => {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
}

function applyWeekPattern(employeeId, weekdayHours) {
  setEmployeeDays(employeeId, DAY_GROUPS.weekdays, weekdayHours);
  setEmployeeDays(employeeId, DAY_GROUPS.weekend, 0);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function clearEmployeeWeek(employeeId) {
  const entry = getEmployeeEntry(employeeId);
  DAYS.forEach((day) => {
    entry.days[day.key] = { hours: "0", note: "" };
    openNotes.delete(getNoteKey(employeeId, day.key));
  });
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function copyPreviousWeek(employeeId, card) {
  const previousKey = toDateKey(addDays(selectedWeekStart, -7));
  const previousEntry = state.weeks[previousKey]?.entries?.[employeeId];
  if (!previousEntry) {
    setCardNotice(card, "No previous week data for this employee.");
    return;
  }

  getWeek().entries[employeeId] = normalizeEntry(JSON.parse(JSON.stringify(previousEntry)), false);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function applySameHours(employeeId, card) {
  const input = card.querySelector("[data-apply-hours]");
  const parsed = parseHours(input.value);
  if (!parsed.valid || parsed.empty) {
    input.classList.add("is-invalid");
    setCardNotice(card, "Enter a valid hour value.");
    return;
  }
  input.classList.remove("is-invalid");

  const selectedScope = card.querySelector("[data-apply-scope][aria-pressed='true']")?.dataset.applyScope || "weekdays";
  setEmployeeDays(employeeId, DAY_GROUPS[selectedScope] || DAY_GROUPS.weekdays, parsed.value);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function setDayHours(employeeId, dayKey, hours) {
  const value = Math.max(0, Number(hours) || 0);
  getEmployeeEntry(employeeId).days[dayKey].hours = formatNumber(value);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function stepDayHours(employeeId, dayKey, step) {
  const dayEntry = getEmployeeEntry(employeeId).days[dayKey];
  const parsed = parseHours(dayEntry.hours);
  const current = parsed.valid ? parsed.value : 0;
  const next = Math.max(0, current + step);
  dayEntry.hours = formatNumber(next);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function toggleNote(employeeId, dayKey) {
  const key = getNoteKey(employeeId, dayKey);
  if (openNotes.has(key)) {
    openNotes.delete(key);
  } else {
    openNotes.add(key);
  }
  expandedEmployeeId = employeeId;
  renderLogEmployeeList();
}

function updateAfterEmployeeChange(employeeId, card) {
  updateLogCardSummary(card, employeeId);
  renderMiniSummary();
  renderSummaryView();
  renderPrintReport();
}

function updateLogCardSummary(card, employeeId) {
  if (!card) return;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;
  const analysis = analyzeEmployee(employeeId);
  const total = card.querySelector(".employee-total strong");
  const badges = card.querySelector(".warning-badges");
  if (total) total.textContent = `${formatNumber(analysis.total)}h`;
  if (badges) badges.innerHTML = renderBadges(analysis.warningBadges);
}

function updateDayEntry(dayNode, employeeId, dayKey) {
  if (!dayNode) return;
  const parsed = parseHours(getEmployeeEntry(employeeId).days[dayKey].hours);
  const input = dayNode.querySelector("[data-hour-input]");
  dayNode.classList.toggle("has-missing", parsed.empty);
  dayNode.classList.toggle("has-invalid", !parsed.valid);
  if (input) {
    input.classList.toggle("is-invalid", !parsed.valid);
    input.setAttribute("aria-invalid", String(!parsed.valid));
  }
}

function setCardNotice(card, message) {
  const notice = card?.querySelector("[data-card-notice]");
  if (notice) notice.textContent = message;
}

function setEmployeeDays(employeeId, days, hours) {
  const value = formatNumber(Math.max(0, Number(hours) || 0));
  const entry = getEmployeeEntry(employeeId);
  days.forEach((dayKey) => {
    entry.days[dayKey].hours = value;
  });
}

function addEmployee(event) {
  event.preventDefault();
  const name = els.employeeName.value.trim();
  const role = els.employeeRole.value.trim();
  if (!name) {
    els.employeeName.focus();
    return;
  }

  const employee = {
    id: createId(),
    name,
    role
  };
  state.employees.push(employee);
  expandedEmployeeId = employee.id;
  quickFill.employeeId = employee.id;
  els.addEmployeeForm.reset();
  saveState();
  setActiveTab("log");
}

function handlePeopleInput(event) {
  const target = event.target;
  const employeeId = target.dataset.employeeId;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  if (target.matches("[data-person-name]")) {
    employee.name = target.value;
  }
  if (target.matches("[data-person-role]")) {
    employee.role = target.value;
  }

  saveState();
  renderMiniSummary();
  renderSummaryView();
  renderPrintReport();
}

function handlePeopleClick(event) {
  const button = event.target.closest("[data-delete-employee]");
  if (!button) return;

  const employeeId = button.dataset.employeeId;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  const confirmed = window.confirm(`Delete ${displayEmployeeName(employee)}? Saved hours for this person will be removed from every week.`);
  if (!confirmed) return;

  state.employees = state.employees.filter((item) => item.id !== employeeId);
  Object.values(state.weeks).forEach((week) => {
    if (week.entries) delete week.entries[employeeId];
  });
  if (expandedEmployeeId === employeeId) expandedEmployeeId = null;
  if (quickFill.employeeId === employeeId) quickFill.employeeId = state.employees[0]?.id || "";
  saveState();
  renderApp();
}

function handleThresholdInput() {
  if (els.thresholdInput.value.startsWith("-")) els.thresholdInput.value = "";
  const parsed = parseHours(els.thresholdInput.value);
  if (els.thresholdInput.value !== "" && !parsed.valid) {
    els.thresholdInput.classList.add("is-invalid");
    return;
  }

  els.thresholdInput.classList.remove("is-invalid");
  state.threshold = els.thresholdInput.value === "" ? DEFAULT_THRESHOLD : parsed.value;
  saveState();
  renderMiniSummary();
  renderLogEmployeeList();
  renderSummaryView();
  renderPrintReport();
}

function calculateWeekSummary() {
  const dayTotals = Object.fromEntries(DAYS.map((day) => [day.key, 0]));
  const employees = state.employees.map((employee) => {
    const analysis = analyzeEmployee(employee.id);
    DAYS.forEach((day) => {
      dayTotals[day.key] += analysis.dayValues[day.key] || 0;
    });
    return { employee, ...analysis };
  });

  const warningCount = employees.reduce((count, item) => count + item.warningBadges.length, 0);

  return {
    employees,
    dayTotals,
    warningCount,
    combinedTotal: employees.reduce((sum, item) => sum + item.total, 0),
    activeCount: employees.filter((item) => item.hasLoggedHours).length,
    overThreshold: employees.filter((item) => item.isOverThreshold),
    missingEntries: employees.filter((item) => item.hasMissingDays),
    emptyWeeks: employees.filter((item) => item.isEmptyWeek),
    invalidValues: employees.filter((item) => item.invalidDays.length > 0)
  };
}

function analyzeEmployee(employeeId) {
  const entry = getEmployeeEntry(employeeId);
  const dayValues = {};
  const missingDays = [];
  const invalidDays = [];
  let total = 0;
  let hasLoggedHours = false;
  let allZeroOrEmpty = true;

  DAYS.forEach((day) => {
    const dayEntry = entry.days[day.key];
    const parsed = parseHours(dayEntry.hours);
    dayValues[day.key] = parsed.value;
    total += parsed.value;

    if (parsed.empty) missingDays.push(day.key);
    if (!parsed.valid) invalidDays.push(day.key);
    if (parsed.value > 0) {
      hasLoggedHours = true;
      allZeroOrEmpty = false;
    }
  });

  const isOverThreshold = total > getThreshold();
  const isEmptyWeek = allZeroOrEmpty;
  const hasMissingDays = missingDays.length > 0 && !isEmptyWeek;
  const warningBadges = [];

  if (invalidDays.length) warningBadges.push({ label: "Invalid value", type: "danger" });
  if (isOverThreshold) warningBadges.push({ label: "Over threshold", type: "warning" });
  if (isEmptyWeek) warningBadges.push({ label: "Empty week", type: "warning" });
  if (hasMissingDays) warningBadges.push({ label: "Missing days", type: "warning" });

  return {
    dayValues,
    total,
    hasLoggedHours,
    isOverThreshold,
    isEmptyWeek,
    hasMissingDays,
    missingDays,
    invalidDays,
    warningBadges,
    warningStatus: warningBadges.length ? warningBadges.map((badge) => badge.label).join("; ") : "No warnings"
  };
}

function clearSelectedWeek() {
  const weekKey = getWeekKey();
  const confirmed = window.confirm(`Clear all hours and notes for the week starting ${weekKey}? Employees will stay in place.`);
  if (!confirmed) return;

  delete state.weeks[weekKey];
  saveState();
  renderApp();
  showDataNotice("Selected week cleared.");
}

function clearAllData() {
  const phrase = window.prompt("Type CLEAR ALL to remove employees, hours, notes, threshold, and saved view settings.");
  if (phrase !== "CLEAR ALL") {
    showDataNotice("Clear all cancelled.");
    return;
  }

  state = getDefaultState();
  selectedWeekStart = startOfWeek(new Date());
  activeTab = "log";
  expandedEmployeeId = null;
  quickFill.employeeId = "";
  localStorage.removeItem(STORAGE_KEY);
  renderApp();
  markSaved("All data cleared.");
  showDataNotice("All data cleared.");
}

function exportCsv() {
  const weekStartKey = getWeekKey();
  const weekEndKey = toDateKey(addDays(selectedWeekStart, 6));
  const headers = [
    "week start date",
    "week end date",
    "employee name",
    "role/note"
  ];

  DAYS.forEach((day) => {
    headers.push(`${day.label} hours`, `${day.label} note`);
  });

  headers.push("weekly total", "threshold", "warning status");

  const rows = state.employees.map((employee) => {
    const entry = getEmployeeEntry(employee.id);
    const analysis = analyzeEmployee(employee.id);
    const row = [
      weekStartKey,
      weekEndKey,
      displayEmployeeName(employee),
      employee.role || ""
    ];

    DAYS.forEach((day) => {
      row.push(entry.days[day.key].hours || "", entry.days[day.key].note || "");
    });

    row.push(formatNumber(analysis.total), formatNumber(getThreshold()), analysis.warningStatus);
    return row;
  });

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(csv, `weekly-hours-${weekStartKey}.csv`, "text/csv;charset=utf-8");
}

function renderPrintReport() {
  const summary = calculateWeekSummary();
  const weekStartKey = getWeekKey();
  const weekEndKey = toDateKey(addDays(selectedWeekStart, 6));

  const employeeRows = state.employees.map((employee) => {
    const entry = getEmployeeEntry(employee.id);
    const analysis = analyzeEmployee(employee.id);
    const cells = [
      `<td><strong>${escapeHtml(displayEmployeeName(employee))}</strong></td>`,
      `<td>${escapeHtml(employee.role || "")}</td>`
    ];

    DAYS.forEach((day) => {
      const dayEntry = entry.days[day.key];
      cells.push(`
        <td>
          <strong>${escapeHtml(dayEntry.hours === "" ? "0" : dayEntry.hours)}</strong>
          ${dayEntry.note ? `<div class="print-note">${escapeHtml(dayEntry.note)}</div>` : ""}
        </td>
      `);
    });

    cells.push(
      `<td><strong>${formatNumber(analysis.total)}</strong></td>`,
      `<td>${escapeHtml(analysis.warningStatus)}</td>`
    );

    return `<tr>${cells.join("")}</tr>`;
  }).join("");

  const daySummary = DAYS.map((day) => `${day.short}: ${formatNumber(summary.dayTotals[day.key])}h`).join(" | ");
  const employeeSummary = summary.employees
    .map((item) => `${escapeHtml(displayEmployeeName(item.employee))}: ${formatNumber(item.total)}h`)
    .join("<br>");

  els.printArea.innerHTML = `
    <h1>Weekly Hours Report</h1>
    <div>${escapeHtml(getWeekRangeLabel())}</div>
    <div class="print-meta">
      <div class="print-box"><strong>Week start</strong>${weekStartKey}</div>
      <div class="print-box"><strong>Week end</strong>${weekEndKey}</div>
      <div class="print-box"><strong>Threshold</strong>${formatNumber(getThreshold())} hours</div>
      <div class="print-box"><strong>Employees</strong>${state.employees.length}</div>
    </div>
    <div class="print-summary">
      <div class="print-box"><strong>Combined hours</strong>${formatNumber(summary.combinedTotal)}h</div>
      <div class="print-box"><strong>Active employees</strong>${summary.activeCount}</div>
      <div class="print-box"><strong>Over threshold</strong>${summary.overThreshold.length}</div>
      <div class="print-box"><strong>Missing entries</strong>${summary.missingEntries.length}</div>
      <div class="print-box"><strong>Empty weeks</strong>${summary.emptyWeeks.length}</div>
    </div>
    <div class="print-box"><strong>Total hours per day</strong>${escapeHtml(daySummary)}</div>
    <div class="print-box"><strong>Total hours per employee</strong>${employeeSummary || "No employees"}</div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Role/note</th>
          ${DAYS.map((day) => `<th>${day.short}<br>hours and notes</th>`).join("")}
          <th>Total</th>
          <th>Warning status</th>
        </tr>
      </thead>
      <tbody>${employeeRows || `<tr><td colspan="11">No employees</td></tr>`}</tbody>
    </table>
  `;
}

function exportBackup() {
  const backup = {
    schema: STORAGE_KEY,
    exportedAt: new Date().toISOString(),
    data: normalizeState(state, false)
  };
  downloadBlob(JSON.stringify(backup, null, 2), `weekly-hours-backup-${todayKey()}.json`, "application/json");
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const imported = parsed && parsed.data ? parsed.data : parsed;
      const normalized = normalizeState(imported, true);
      const confirmed = window.confirm("Import this backup and replace current tracker data?");
      if (!confirmed) {
        showDataNotice("Import cancelled.");
        return;
      }

      state = normalized;
      selectedWeekStart = parseDateKey(state.selectedWeekStart) || startOfWeek(new Date());
      activeTab = VALID_TABS.includes(state.lastTab) ? state.lastTab : "log";
      expandedEmployeeId = state.lastExpandedEmployeeId || null;
      quickFill.employeeId = state.employees[0]?.id || "";
      saveState();
      renderApp();
      showDataNotice("Backup imported.");
    } catch (error) {
      showDataNotice("Import failed. The file does not match the expected backup format.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return getDefaultState();
  try {
    return normalizeState(JSON.parse(raw), false);
  } catch (error) {
    return getDefaultState();
  }
}

function saveState() {
  state.selectedWeekStart = getWeekKey();
  state.lastTab = activeTab;
  state.lastExpandedEmployeeId = expandedEmployeeId;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state, false)));
    markSaved("Saved");
  } catch (error) {
    els.saveStatus.textContent = "Save failed";
    els.saveStatus.classList.remove("is-saved");
    els.saveStatus.classList.add("is-error");
  }
}

function normalizeState(input, strict) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (strict) throw new Error("Invalid state");
    return getDefaultState();
  }

  if (strict && !Array.isArray(input.employees)) {
    throw new Error("Employees must be an array");
  }

  const employees = Array.isArray(input.employees)
    ? input.employees.map(normalizeEmployee).filter(Boolean)
    : [];

  const weeks = {};
  if (input.weeks && typeof input.weeks === "object" && !Array.isArray(input.weeks)) {
    Object.entries(input.weeks).forEach(([weekKey, weekValue]) => {
      if (!isDateKey(weekKey)) {
        if (strict) throw new Error("Invalid week key");
        return;
      }
      weeks[weekKey] = normalizeWeek(weekValue, strict);
    });
  } else if (strict && input.weeks !== undefined) {
    throw new Error("Weeks must be an object");
  }

  const threshold = Number(input.threshold);
  if (strict && input.threshold !== undefined && (!Number.isFinite(threshold) || threshold < 0)) {
    throw new Error("Invalid threshold");
  }

  const selectedWeek = typeof input.selectedWeekStart === "string" && isDateKey(input.selectedWeekStart)
    ? toDateKey(startOfWeek(parseDateKey(input.selectedWeekStart)))
    : toDateKey(startOfWeek(new Date()));

  return {
    employees,
    weeks,
    threshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_THRESHOLD,
    selectedWeekStart: selectedWeek,
    lastTab: VALID_TABS.includes(input.lastTab) ? input.lastTab : "log",
    lastExpandedEmployeeId: typeof input.lastExpandedEmployeeId === "string" ? input.lastExpandedEmployeeId : null
  };
}

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== "object") return null;
  return {
    id: typeof employee.id === "string" && employee.id ? employee.id : createId(),
    name: typeof employee.name === "string" ? employee.name : "",
    role: typeof employee.role === "string" ? employee.role : ""
  };
}

function normalizeWeek(week, strict) {
  if (!week || typeof week !== "object" || Array.isArray(week)) {
    if (strict) throw new Error("Invalid week");
    return { entries: {} };
  }

  const entries = {};
  const sourceEntries = week.entries && typeof week.entries === "object" && !Array.isArray(week.entries)
    ? week.entries
    : {};

  if (strict && week.entries !== undefined && sourceEntries !== week.entries) {
    throw new Error("Invalid entries");
  }

  Object.entries(sourceEntries).forEach(([employeeId, entry]) => {
    entries[employeeId] = normalizeEntry(entry, strict);
  });

  return { entries };
}

function normalizeEntry(entry, strict) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    if (strict) throw new Error("Invalid entry");
    return { days: createEmptyDays() };
  }

  const normalized = { days: createEmptyDays() };
  const sourceDays = entry.days && typeof entry.days === "object" && !Array.isArray(entry.days)
    ? entry.days
    : {};

  if (strict && entry.days !== undefined && sourceDays !== entry.days) {
    throw new Error("Invalid days");
  }

  DAYS.forEach((day) => {
    const source = sourceDays[day.key] || {};
    if (strict && (typeof source !== "object" || Array.isArray(source))) {
      throw new Error("Invalid day entry");
    }
    normalized.days[day.key] = {
      hours: source.hours === undefined || source.hours === null ? "" : String(source.hours),
      note: typeof source.note === "string" ? source.note : ""
    };
  });

  return normalized;
}

function getDefaultState() {
  return {
    employees: [],
    weeks: {},
    threshold: DEFAULT_THRESHOLD,
    selectedWeekStart: toDateKey(startOfWeek(new Date())),
    lastTab: "log",
    lastExpandedEmployeeId: null
  };
}

function ensureCurrentWeekEntries() {
  const week = getWeek();
  state.employees.forEach((employee) => {
    week.entries[employee.id] = normalizeEntry(week.entries[employee.id], false);
  });
}

function getWeek() {
  const weekKey = getWeekKey();
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { entries: {} };
  }
  return state.weeks[weekKey];
}

function getEmployeeEntry(employeeId) {
  const week = getWeek();
  if (!week.entries[employeeId]) {
    week.entries[employeeId] = { days: createEmptyDays() };
  }
  return week.entries[employeeId];
}

function createEmptyDays() {
  return Object.fromEntries(DAYS.map((day) => [day.key, { hours: "", note: "" }]));
}

function getThreshold() {
  const threshold = Number(state.threshold);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_THRESHOLD;
}

function parseHours(value) {
  const text = String(value ?? "").trim();
  if (!text) return { value: 0, empty: true, valid: true };

  const simpleDecimal = /^(?:\d+\.?\d*|\.\d+)$/;
  const number = Number(text);
  return {
    value: simpleDecimal.test(text) && Number.isFinite(number) && number >= 0 ? number : 0,
    empty: false,
    valid: simpleDecimal.test(text) && Number.isFinite(number) && number >= 0
  };
}

function blockInvalidNumberKeys(event) {
  if (["e", "E", "+", "-"].includes(event.key)) {
    event.preventDefault();
  }
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `emp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDateKey(key) {
  if (!isDateKey(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (toDateKey(date) !== key) return null;
  return date;
}

function getWeekKey() {
  return toDateKey(selectedWeekStart);
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getWeekRangeLabel() {
  return `Week of ${formatLongDate(selectedWeekStart)} to ${formatLongDate(addDays(selectedWeekStart, 6))}`;
}

function formatLongDate(date) {
  return `${DAYS[(date.getDay() + 6) % 7].label} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function displayEmployeeName(employee) {
  const name = (employee.name || "").trim();
  return name || "Unnamed employee";
}

function getNoteKey(employeeId, dayKey) {
  return `${employeeId}:${dayKey}`;
}

function markSaved(message) {
  if (!els.saveStatus) return;
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  els.saveStatus.textContent = message === "Saved" ? `Saved ${time}` : message;
  els.saveStatus.classList.remove("is-error");
  els.saveStatus.classList.add("is-saved");

  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    els.saveStatus.classList.remove("is-saved");
  }, 1600);
}

function showQuickNotice(message) {
  els.quickFillNotice.textContent = message;
  window.setTimeout(() => {
    if (els.quickFillNotice.textContent === message) els.quickFillNotice.textContent = "";
  }, 4200);
}

function showDataNotice(message) {
  clearTimeout(noticeTimer);
  els.dataNotice.textContent = message;
  noticeTimer = window.setTimeout(() => {
    if (els.dataNotice.textContent === message) els.dataNotice.textContent = "";
  }, 5000);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/"/g, "\\\"");
}

function setEquals(left, right) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}
