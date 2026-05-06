"use strict";

const STORAGE_KEY = "weeklyHoursTracker:v1";
const DEFAULT_THRESHOLD = 40;
const VALID_TABS = ["today", "week", "people", "settings"];
const VALID_DAILY_FILTERS = ["all", "missing", "entered"];
const DEFAULT_NOTE_TEMPLATES = ["Rain delay", "Left early"];

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
let activeTab = normalizeTab(state.lastTab);
let selectedDailyDayKey = isDayKey(state.lastDailyDayKey) ? state.lastDailyDayKey : getDefaultDailyDayKey();
let expandedEmployeeId = state.lastExpandedEmployeeId || null;
let expandedDailyEmployeeId = state.lastExpandedDailyEmployeeId || null;
let dailyRosterFilter = normalizeDailyFilter(state.lastDailyFilter);
let dailySearchQuery = "";
let saveTimer = null;
let noticeTimer = null;
let focusPersonId = null;
const collapsedGroupKeys = new Set();

const openNotes = new Set();
const quickFill = {
  employeeId: "",
  preset: "full",
  customHours: "",
  days: new Set(DAY_GROUPS.weekdays)
};
const bulkFill = {
  applyAll: true,
  employeeIds: new Set(),
  preset: "full",
  customHours: "",
  days: new Set(getDefaultBulkDays())
};
const dailyPeopleFill = {
  applyAll: false,
  employeeIds: new Set()
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  renderApp();
  registerServiceWorker();
}

function registerServiceWorker() {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (!isHttp) return;

  if (!document.querySelector("link[rel='manifest']")) {
    const manifest = document.createElement("link");
    manifest.rel = "manifest";
    manifest.href = "manifest.webmanifest";
    document.head.appendChild(manifest);
  }

  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    // The app remains usable if offline caching is unavailable.
  });
}

function cacheElements() {
  els.saveStatus = document.getElementById("saveStatus");
  els.navTabs = Array.from(document.querySelectorAll("[data-tab]"));
  els.views = Array.from(document.querySelectorAll("[data-view]"));
  els.weekRanges = [
    document.getElementById("weekRangeLog"),
    document.getElementById("weekRangeSummary")
  ];
  els.quickEmployee = document.getElementById("quickEmployee");
  els.dailyDateLabel = document.getElementById("dailyDateLabel");
  els.dailyDayButtons = document.getElementById("dailyDayButtons");
  els.dailyProgress = document.getElementById("dailyProgress");
  els.dailyReviewStatus = document.getElementById("dailyReviewStatus");
  els.dailySignOff = document.getElementById("dailySignOff");
  els.dailyAllCustom = document.getElementById("dailyAllCustom");
  els.dailyApplyCustom = document.getElementById("dailyApplyCustom");
  els.dailyCopyYesterday = document.getElementById("dailyCopyYesterday");
  els.dailyPeopleActions = document.getElementById("dailyPeopleActions");
  els.dailyPeopleList = document.getElementById("dailyPeopleList");
  els.dailySelectedCustom = document.getElementById("dailySelectedCustom");
  els.dailyApplySelected = document.getElementById("dailyApplySelected");
  els.dailySearch = document.getElementById("dailySearch");
  els.dailyFilterButtons = document.getElementById("dailyFilterButtons");
  els.dailyFilterMeta = document.getElementById("dailyFilterMeta");
  els.dailyJumpMissing = document.getElementById("dailyJumpMissing");
  els.dailyRoster = document.getElementById("dailyRoster");
  els.dailyNotice = document.getElementById("dailyNotice");
  els.quickPresetButtons = document.getElementById("quickPresetButtons");
  els.quickCustomWrap = document.getElementById("quickCustomWrap");
  els.quickCustomHours = document.getElementById("quickCustomHours");
  els.quickDayButtons = document.getElementById("quickDayButtons");
  els.quickApply = document.getElementById("quickApply");
  els.quickFillNotice = document.getElementById("quickFillNotice");
  els.bulkPeopleActions = document.getElementById("bulkPeopleActions");
  els.bulkPeopleList = document.getElementById("bulkPeopleList");
  els.bulkPresetButtons = document.getElementById("bulkPresetButtons");
  els.bulkCustomWrap = document.getElementById("bulkCustomWrap");
  els.bulkCustomHours = document.getElementById("bulkCustomHours");
  els.bulkDayButtons = document.getElementById("bulkDayButtons");
  els.bulkApply = document.getElementById("bulkApply");
  els.bulkFillNotice = document.getElementById("bulkFillNotice");
  els.logEmployeeList = document.getElementById("logEmployeeList");
  els.summaryMetrics = document.getElementById("summaryMetrics");
  els.dayTotals = document.getElementById("dayTotals");
  els.dayTotalsMeta = document.getElementById("dayTotalsMeta");
  els.employeeTotals = document.getElementById("employeeTotals");
  els.employeeTotalsMeta = document.getElementById("employeeTotalsMeta");
  els.warningSummary = document.getElementById("warningSummary");
  els.warningsMeta = document.getElementById("warningsMeta");
  els.overtimeMeta = document.getElementById("overtimeMeta");
  els.overtimeReview = document.getElementById("overtimeReview");
  els.addEmployeeForm = document.getElementById("addEmployeeForm");
  els.employeeName = document.getElementById("employeeName");
  els.employeeGroup = document.getElementById("employeeGroup");
  els.employeeGroupOptions = document.getElementById("employeeGroupOptions");
  els.employeeGroupChoices = document.getElementById("employeeGroupChoices");
  els.employeeRole = document.getElementById("employeeRole");
  els.employeeDialog = document.getElementById("employeeDialog");
  els.employeeDialogForm = document.getElementById("employeeDialogForm");
  els.modalEmployeeName = document.getElementById("modalEmployeeName");
  els.modalEmployeeGroup = document.getElementById("modalEmployeeGroup");
  els.modalEmployeeGroupChoices = document.getElementById("modalEmployeeGroupChoices");
  els.modalEmployeeRole = document.getElementById("modalEmployeeRole");
  els.employeeDialogClose = document.getElementById("employeeDialogClose");
  els.employeeDialogCancel = document.getElementById("employeeDialogCancel");
  els.peopleList = document.getElementById("peopleList");
  els.thresholdInput = document.getElementById("thresholdInput");
  els.noteTemplateInput = document.getElementById("noteTemplateInput");
  els.addNoteTemplate = document.getElementById("addNoteTemplate");
  els.noteTemplateList = document.getElementById("noteTemplateList");
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

  document.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-daily-day-action]");
    if (!dayButton) return;
    changeDailyDay(dayButton.dataset.dailyDayAction);
  });

  document.addEventListener("click", (event) => {
    const dailyAllButton = event.target.closest("[data-daily-all]");
    if (!dailyAllButton) return;
    applyDailyHoursToEveryone(Number(dailyAllButton.dataset.dailyAll));
  });

  document.addEventListener("click", handleGroupChoiceClick);

  els.dailyDayButtons.addEventListener("click", handleDailyDayClick);
  els.dailySignOff.addEventListener("click", toggleDailySignOff);
  els.dailyAllCustom.addEventListener("keydown", blockInvalidNumberKeys);
  els.dailyAllCustom.addEventListener("input", () => {
    if (els.dailyAllCustom.value.startsWith("-")) {
      els.dailyAllCustom.value = "";
    }
  });
  els.dailyApplyCustom.addEventListener("click", applyDailyCustomToEveryone);
  els.dailyCopyYesterday.addEventListener("click", copyYesterdayToSelectedDay);
  els.dailyPeopleActions.addEventListener("click", handleDailyPeopleAction);
  els.dailyPeopleList.addEventListener("change", handleDailyPersonChange);
  els.dailySelectedCustom.addEventListener("keydown", blockInvalidNumberKeys);
  els.dailySelectedCustom.addEventListener("input", () => {
    if (els.dailySelectedCustom.value.startsWith("-")) {
      els.dailySelectedCustom.value = "";
    }
  });
  els.dailyApplySelected.addEventListener("click", applyDailyCustomToSelectedPeople);
  els.dailySearch.addEventListener("input", handleDailySearchInput);
  els.dailyFilterButtons.addEventListener("click", handleDailyFilterClick);
  els.dailyJumpMissing.addEventListener("click", jumpToMissingDailyRow);
  els.dailyRoster.addEventListener("click", handleDailyRosterClick);
  els.dailyRoster.addEventListener("input", handleDailyRosterInput);
  els.dailyRoster.addEventListener("keydown", handleDailyRosterKeydown);
  els.dailyRoster.addEventListener("toggle", handleDailyRosterToggle, true);

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

  els.bulkPeopleActions.addEventListener("click", handleBulkPeopleAction);
  els.bulkPeopleList.addEventListener("change", handleBulkPersonChange);
  els.bulkPresetButtons.addEventListener("click", handleBulkPresetClick);
  els.bulkDayButtons.addEventListener("click", handleBulkDayClick);
  els.bulkCustomHours.addEventListener("keydown", blockInvalidNumberKeys);
  els.bulkCustomHours.addEventListener("input", () => {
    if (els.bulkCustomHours.value.startsWith("-")) {
      els.bulkCustomHours.value = "";
    }
    bulkFill.customHours = els.bulkCustomHours.value;
  });
  els.bulkApply.addEventListener("click", applyBulkFill);

  els.logEmployeeList.addEventListener("click", handleLogClick);
  els.logEmployeeList.addEventListener("input", handleLogInput);
  els.logEmployeeList.addEventListener("keydown", handleLogKeydown);

  els.addEmployeeForm.addEventListener("submit", addEmployee);
  els.employeeDialogForm.addEventListener("submit", addEmployeeFromDialog);
  els.employeeDialogClose.addEventListener("click", closeEmployeeDialog);
  els.employeeDialogCancel.addEventListener("click", closeEmployeeDialog);
  els.employeeDialog.addEventListener("click", (event) => {
    if (event.target === els.employeeDialog) closeEmployeeDialog();
  });
  els.employeeDialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });
  els.peopleList.addEventListener("input", handlePeopleInput);
  els.peopleList.addEventListener("click", handlePeopleClick);
  els.peopleList.addEventListener("toggle", handlePeopleToggle, true);

  els.thresholdInput.addEventListener("keydown", blockInvalidNumberKeys);
  els.thresholdInput.addEventListener("input", handleThresholdInput);
  els.addNoteTemplate.addEventListener("click", addNoteTemplateFromSettings);
  els.noteTemplateInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addNoteTemplateFromSettings();
    }
  });
  els.noteTemplateList.addEventListener("click", handleNoteTemplateSettingsClick);

  els.clearWeek.addEventListener("click", clearSelectedWeek);
  els.clearAllData.addEventListener("click", clearAllData);
  els.exportBackup.addEventListener("click", exportBackup);
  els.importBackup.addEventListener("change", importBackup);
  els.exportCsv.addEventListener("click", exportCsv);
  els.printReport.addEventListener("click", () => {
    renderPrintReport();
    window.print();
  });
  els.fabAddEmployee.addEventListener("click", openEmployeeDialog);

  window.addEventListener("beforeprint", renderPrintReport);
}

function renderApp() {
  ensureCurrentWeekEntries();
  keepUiStateValid();
  updateActiveView();
  updateWeekLabels();
  renderGroupOptions();
  renderDailyLog();
  renderQuickFill();
  renderBulkFill();
  renderLogEmployeeList();
  renderSummaryView();
  renderPeopleView();
  renderSettingsView();
  renderPrintReport();
}

function keepUiStateValid() {
  const activeEmployees = getActiveEmployees();
  if (!activeEmployees.some((employee) => employee.id === expandedEmployeeId)) {
    expandedEmployeeId = null;
  }
  if (!activeEmployees.some((employee) => employee.id === expandedDailyEmployeeId)) {
    expandedDailyEmployeeId = null;
  }
  if (!isDayKey(selectedDailyDayKey)) {
    selectedDailyDayKey = getDefaultDailyDayKey();
  }
  if (!quickFill.employeeId || !activeEmployees.some((employee) => employee.id === quickFill.employeeId)) {
    quickFill.employeeId = activeEmployees[0]?.id || "";
  }
  dailyPeopleFill.employeeIds = new Set(
    Array.from(dailyPeopleFill.employeeIds).filter((employeeId) => activeEmployees.some((employee) => employee.id === employeeId))
  );
  bulkFill.employeeIds = new Set(
    Array.from(bulkFill.employeeIds).filter((employeeId) => activeEmployees.some((employee) => employee.id === employeeId))
  );
  if (!bulkFill.days.size) {
    bulkFill.days = new Set(getDefaultBulkDays());
  }
  dailyRosterFilter = normalizeDailyFilter(dailyRosterFilter);
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

  els.fabAddEmployee.classList.remove("is-hidden");
}

function normalizeTab(tab) {
  if (tab === "log") return "today";
  if (tab === "summary") return "week";
  return VALID_TABS.includes(tab) ? tab : "today";
}

function normalizeDailyFilter(filter) {
  return VALID_DAILY_FILTERS.includes(filter) ? filter : "all";
}

function updateWeekLabels() {
  const label = getWeekRangeLabel();
  els.weekRanges.forEach((node) => {
    if (node) node.textContent = label;
  });
}

function setActiveTab(tab, personToFocus = null) {
  const nextTab = normalizeTab(tab);
  if (!VALID_TABS.includes(nextTab)) return;
  activeTab = nextTab;
  focusPersonId = personToFocus;
  saveState();
  renderApp();

  if (focusPersonId) {
    requestAnimationFrame(() => {
      const input = document.querySelector(`[data-person-name][data-employee-id="${cssEscape(focusPersonId)}"]`);
      if (input) {
        const details = input.closest("details");
        if (details) details.open = true;
        input.focus();
      }
      focusPersonId = null;
    });
  }
}

function changeWeek(action) {
  if (action === "previous") selectedWeekStart = addDays(selectedWeekStart, -7);
  if (action === "current") selectedWeekStart = startOfWeek(new Date());
  if (action === "next") selectedWeekStart = addDays(selectedWeekStart, 7);
  if (action === "current") selectedDailyDayKey = getDefaultDailyDayKey();
  saveState();
  renderApp();
}

function renderDailyLog() {
  const day = dayByKey(selectedDailyDayKey) || DAYS[0];
  const date = getSelectedDailyDate();
  els.dailyDateLabel.textContent = `${day.label} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  renderDailyDayButtons();
  renderDailyProgress();
  renderDailyReview();
  renderDailyPeoplePicker();
  renderDailyRosterTools();

  if (!getActiveEmployees().length) {
    els.dailyRoster.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    els.dailyApplyCustom.disabled = true;
    els.dailyApplySelected.disabled = true;
    els.dailyCopyYesterday.disabled = true;
    els.dailySignOff.disabled = true;
    return;
  }

  els.dailyApplyCustom.disabled = false;
  els.dailyApplySelected.disabled = false;
  els.dailySignOff.disabled = false;
  els.dailyCopyYesterday.disabled = !hasYesterdayData();
  const employees = getFilteredDailyEmployees();
  if (!employees.length) {
    els.dailyRoster.innerHTML = `<div class="empty-state">No people match this roster view.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  groupEmployees(employees).forEach((group) => {
    const section = document.createElement("details");
    section.className = "daily-group group-details";
    section.dataset.groupLabel = group.label;
    section.open = isGroupOpen(group.label);
    section.innerHTML = `
      <summary class="daily-group-heading">
        <strong>${escapeHtml(group.label)}</strong>
        <span>${group.employees.length} ${group.employees.length === 1 ? "person" : "people"}</span>
        <span class="group-quick-actions" aria-label="Set ${escapeAttr(group.label)} hours">
          <button type="button" class="button tiny secondary" data-daily-group-hours="0" data-group-label="${escapeAttr(group.label)}">Off</button>
          <button type="button" class="button tiny secondary" data-daily-group-hours="5" data-group-label="${escapeAttr(group.label)}">5h</button>
          <button type="button" class="button tiny secondary" data-daily-group-hours="10" data-group-label="${escapeAttr(group.label)}">10h</button>
        </span>
      </summary>
      <div class="group-body"></div>
    `;
    const groupBody = section.querySelector(".group-body");
    group.employees.forEach((employee) => {
      groupBody.appendChild(createDailyRow(employee));
    });
    fragment.appendChild(section);
  });
  els.dailyRoster.replaceChildren(fragment);
}

function renderDailyDayButtons() {
  const nodes = DAYS.map((day, index) => {
    const date = addDays(selectedWeekStart, index);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.dailyDay = day.key;
    button.setAttribute("aria-pressed", String(day.key === selectedDailyDayKey));
    button.textContent = `${day.short} ${date.getDate()}`;
    return button;
  });
  els.dailyDayButtons.replaceChildren(...nodes);
}

function renderDailyProgress() {
  const stats = calculateDailyStats(selectedDailyDayKey);
  els.dailyProgress.textContent = `${stats.filledCount}/${stats.employeeCount} entered - ${formatNumber(stats.total)}h total`;
}

function renderDailyReview() {
  const review = getDayReview(selectedDailyDayKey);
  const signed = Boolean(review.signed);
  els.dailyReviewStatus.textContent = signed ? `Signed off ${formatSignedTime(review.signedAt)}` : "Not signed off";
  els.dailyReviewStatus.classList.toggle("is-signed", signed);
  els.dailySignOff.textContent = signed ? "Undo sign-off" : "Sign off day";
  els.dailySignOff.classList.toggle("primary", !signed);
  els.dailySignOff.classList.toggle("secondary", signed);
}

function renderDailyRosterTools() {
  const employees = getFilteredDailyEmployees();
  els.dailySearch.value = dailySearchQuery;
  els.dailyFilterButtons.querySelectorAll("[data-daily-filter]").forEach((button) => {
    const selected = button.dataset.dailyFilter === dailyRosterFilter;
    button.setAttribute("aria-pressed", String(selected));
  });

  const label = dailyRosterFilter === "missing" ? "Needs entry" : dailyRosterFilter === "entered" ? "Entered" : "All";
  els.dailyFilterMeta.textContent = `${label} - ${employees.length}/${getActiveEmployees().length}`;
  els.dailyJumpMissing.disabled = !findFirstMissingDailyEmployee();
}

function getFilteredDailyEmployees() {
  const query = dailySearchQuery.trim().toLowerCase();
  return getActiveEmployees().filter((employee) => {
    const status = getDailyEntryStatus(employee.id);
    const matchesFilter =
      dailyRosterFilter === "all" ||
      (dailyRosterFilter === "missing" && (status === "missing" || status === "invalid")) ||
      (dailyRosterFilter === "entered" && status === "entered");
    if (!matchesFilter) return false;
    if (!query) return true;
    return getEmployeeSearchText(employee).includes(query);
  });
}

function handleDailySearchInput() {
  dailySearchQuery = els.dailySearch.value;
  renderDailyLog();
}

function handleDailyFilterClick(event) {
  const button = event.target.closest("[data-daily-filter]");
  if (!button) return;
  dailyRosterFilter = normalizeDailyFilter(button.dataset.dailyFilter);
  saveState();
  renderDailyLog();
}

function jumpToMissingDailyRow() {
  const employee = findFirstMissingDailyEmployee();
  if (!employee) {
    showDailyNotice("No missing or invalid rows for this date.");
    return;
  }

  dailyRosterFilter = "missing";
  saveState();
  renderDailyLog();
  requestAnimationFrame(() => {
    const row = els.dailyRoster.querySelector(`[data-employee-id="${cssEscape(employee.id)}"]`);
    if (row) {
      const group = row.closest(".group-details");
      if (group) {
        group.open = true;
        rememberGroupToggle(group);
      }
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.add("is-targeted");
      window.setTimeout(() => row.classList.remove("is-targeted"), 1400);
    }
  });
}

function findFirstMissingDailyEmployee() {
  return getActiveEmployees().find((employee) => {
    const status = getDailyEntryStatus(employee.id);
    if (status !== "missing" && status !== "invalid") return false;
    if (!dailySearchQuery.trim()) return true;
    return getEmployeeSearchText(employee).includes(dailySearchQuery.trim().toLowerCase());
  });
}

function getEmployeeSearchText(employee) {
  return `${displayEmployeeName(employee)} ${displayEmployeeGroup(employee)} ${employee.role || ""}`.toLowerCase();
}

function getDailyEntryStatus(employeeId) {
  const parsed = parseHours(getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours);
  if (!parsed.valid) return "invalid";
  if (parsed.empty) return "missing";
  return "entered";
}

function renderDailyPeoplePicker() {
  els.dailyPeopleActions.replaceChildren(
    createDailyPeopleButton("all", "All people", dailyPeopleFill.applyAll),
    createDailyPeopleButton("choose", "Choose", !dailyPeopleFill.applyAll),
    createDailyPeopleButton("clear", "Clear", false)
  );

  const activeEmployees = getActiveEmployees();
  if (!activeEmployees.length) {
    els.dailyPeopleList.innerHTML = `<div class="empty-state">No employees yet.</div>`;
    return;
  }

  const nodes = activeEmployees.map((employee) => {
    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML = `
      <input type="checkbox" data-daily-person value="${escapeAttr(employee.id)}">
      <span></span>
    `;
    const checkbox = label.querySelector("input");
    checkbox.checked = dailyPeopleFill.applyAll || dailyPeopleFill.employeeIds.has(employee.id);
    label.querySelector("span").textContent = displayEmployeeOptionLabel(employee);
    return label;
  });
  els.dailyPeopleList.replaceChildren(...nodes);
}

function createDailyPeopleButton(action, label, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "segment-button";
  button.dataset.dailyPeopleAction = action;
  button.setAttribute("aria-pressed", String(selected));
  button.textContent = label;
  return button;
}

function createDailyRow(employee) {
  const dayEntry = getEmployeeEntry(employee.id).days[selectedDailyDayKey];
  const parsed = parseHours(dayEntry.hours);
  const status = getDailyEntryStatus(employee.id);
  const noteKey = getNoteKey(employee.id, selectedDailyDayKey);
  const noteOpen = openNotes.has(noteKey);
  const row = document.createElement("details");
  row.className = `daily-row daily-details${status === "missing" ? " has-missing" : ""}${status === "invalid" ? " has-invalid" : ""}`;
  row.dataset.employeeId = employee.id;
  row.dataset.dailyStatus = status;
  row.open = expandedDailyEmployeeId === employee.id || noteOpen;
  row.innerHTML = `
    <summary class="daily-summary">
      <div>
        <strong>${escapeHtml(displayEmployeeName(employee))}</strong>
        <span>${escapeHtml(displayEmployeeGroup(employee))}${employee.role ? ` - ${escapeHtml(employee.role)}` : ""}</span>
        <div class="warning-badges">${renderDailyEntryBadge(parsed)}</div>
      </div>
      <div class="daily-summary-hours">
        <strong>${escapeHtml(dayEntry.hours === "" ? "0" : dayEntry.hours)}h</strong>
        <span>Hours</span>
      </div>
    </summary>
    <div class="daily-entry-controls">
      <div class="daily-hours">
        <label>
          Hours
          <input type="number" min="0" step="0.25" inputmode="decimal" value="${escapeAttr(dayEntry.hours)}" data-daily-hours data-employee-id="${escapeAttr(employee.id)}">
        </label>
      </div>
      <div class="daily-row-actions">
        <button type="button" class="button tiny secondary" data-daily-action="preset" data-hours="0" data-employee-id="${escapeAttr(employee.id)}">Off</button>
        <button type="button" class="button tiny secondary" data-daily-action="preset" data-hours="5" data-employee-id="${escapeAttr(employee.id)}">5h</button>
        <button type="button" class="button tiny secondary" data-daily-action="preset" data-hours="10" data-employee-id="${escapeAttr(employee.id)}">10h</button>
        <button type="button" class="button tiny secondary" data-daily-action="step" data-step="1" data-employee-id="${escapeAttr(employee.id)}">+1</button>
        <button type="button" class="button tiny secondary" data-daily-action="step" data-step="-1" data-employee-id="${escapeAttr(employee.id)}">-1</button>
      </div>
      <button type="button" class="button tiny secondary" data-daily-action="toggle-note" data-employee-id="${escapeAttr(employee.id)}">
        ${noteOpen ? "Hide note" : dayEntry.note ? "Edit note" : "Add note"}
      </button>
      <div class="note-wrap${noteOpen ? " is-open" : ""}">
        ${renderNoteTemplateButtons(employee.id, selectedDailyDayKey, "daily")}
        <label>
          Note
          <textarea rows="2" data-daily-note data-employee-id="${escapeAttr(employee.id)}">${escapeHtml(dayEntry.note)}</textarea>
        </label>
        <button type="button" class="button tiny secondary" data-daily-action="save-note-template" data-employee-id="${escapeAttr(employee.id)}">Save note as template</button>
      </div>
    </div>
  `;
  return row;
}

function renderDailyEntryBadge(parsed) {
  if (!parsed.valid) return `<span class="badge danger">Invalid</span>`;
  if (parsed.empty) return `<span class="badge warning">Missing</span>`;
  return `<span class="badge ok">Entered</span>`;
}

function changeDailyDay(action) {
  if (action === "today") {
    selectedWeekStart = startOfWeek(new Date());
    selectedDailyDayKey = getDefaultDailyDayKey();
  }

  if (action === "previous" || action === "next") {
    const index = DAYS.findIndex((day) => day.key === selectedDailyDayKey);
    const nextIndex = action === "previous" ? index - 1 : index + 1;
    if (nextIndex < 0) {
      selectedWeekStart = addDays(selectedWeekStart, -7);
      selectedDailyDayKey = "sunday";
    } else if (nextIndex >= DAYS.length) {
      selectedWeekStart = addDays(selectedWeekStart, 7);
      selectedDailyDayKey = "monday";
    } else {
      selectedDailyDayKey = DAYS[nextIndex].key;
    }
  }

  saveState();
  renderApp();
}

function handleDailyDayClick(event) {
  const button = event.target.closest("[data-daily-day]");
  if (!button) return;
  selectedDailyDayKey = button.dataset.dailyDay;
  saveState();
  renderApp();
}

function toggleDailySignOff() {
  const review = getDayReview(selectedDailyDayKey);
  if (review.signed) {
    review.signed = false;
    review.signedAt = "";
    showDailyNotice(`${dayByKey(selectedDailyDayKey).short} sign-off removed.`);
  } else {
    review.signed = true;
    review.signedAt = new Date().toISOString();
    showDailyNotice(`${dayByKey(selectedDailyDayKey).short} signed off.`);
  }
  saveState();
  renderApp();
}

function applyDailyHoursToEveryone(hours) {
  const activeEmployees = getActiveEmployees();
  if (!activeEmployees.length) {
    showDailyNotice("Add employees before filling a day.");
    return;
  }

  activeEmployees.forEach((employee) => {
    getEmployeeEntry(employee.id).days[selectedDailyDayKey].hours = formatNumber(Math.max(0, Number(hours) || 0));
  });
  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
  showDailyNotice(`${activeEmployees.length} ${activeEmployees.length === 1 ? "person" : "people"} updated for ${dayByKey(selectedDailyDayKey).short}.`);
}

function applyDailyHoursToGroup(groupLabel, hours) {
  const employees = getActiveEmployees().filter((employee) => displayEmployeeGroup(employee) === groupLabel);
  if (!employees.length) {
    showDailyNotice("No active people in that group.");
    return;
  }

  employees.forEach((employee) => {
    getEmployeeEntry(employee.id).days[selectedDailyDayKey].hours = formatNumber(Math.max(0, Number(hours) || 0));
  });
  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
  showDailyNotice(`${groupLabel}: ${employees.length} ${employees.length === 1 ? "person" : "people"} updated.`);
}

function applyDailyCustomToEveryone() {
  const parsed = parseHours(els.dailyAllCustom.value);
  if (!parsed.valid || parsed.empty) {
    els.dailyAllCustom.classList.add("is-invalid");
    showDailyNotice("Enter a valid custom hour value.");
    return;
  }

  els.dailyAllCustom.classList.remove("is-invalid");
  applyDailyHoursToEveryone(parsed.value);
}

function copyYesterdayToSelectedDay() {
  const previous = getAdjacentDayRef(-1);
  let copiedCount = 0;

  getActiveEmployees().forEach((employee) => {
    const source = state.weeks[previous.weekKey]?.entries?.[employee.id]?.days?.[previous.dayKey];
    if (!source) return;
    getEmployeeEntry(employee.id).days[selectedDailyDayKey] = {
      hours: source.hours === undefined || source.hours === null ? "" : String(source.hours),
      note: typeof source.note === "string" ? source.note : ""
    };
    copiedCount += 1;
  });

  if (!copiedCount) {
    showDailyNotice("No yesterday data to copy.");
    return;
  }

  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
  showDailyNotice(`Copied yesterday for ${copiedCount} ${copiedCount === 1 ? "person" : "people"}.`);
}

function hasYesterdayData() {
  const previous = getAdjacentDayRef(-1);
  return getActiveEmployees().some((employee) => {
    const source = state.weeks[previous.weekKey]?.entries?.[employee.id]?.days?.[previous.dayKey];
    if (!source) return false;
    return String(source.hours ?? "").trim() !== "" || String(source.note ?? "").trim() !== "";
  });
}

function handleDailyPeopleAction(event) {
  const button = event.target.closest("[data-daily-people-action]");
  if (!button) return;

  if (button.dataset.dailyPeopleAction === "all") {
    dailyPeopleFill.applyAll = true;
    dailyPeopleFill.employeeIds.clear();
  }
  if (button.dataset.dailyPeopleAction === "choose") {
    dailyPeopleFill.applyAll = false;
  }
  if (button.dataset.dailyPeopleAction === "clear") {
    dailyPeopleFill.applyAll = false;
    dailyPeopleFill.employeeIds.clear();
  }

  renderDailyPeoplePicker();
}

function handleDailyPersonChange(event) {
  const checkbox = event.target.closest("[data-daily-person]");
  if (!checkbox) return;

  dailyPeopleFill.applyAll = false;
  if (checkbox.checked) {
    dailyPeopleFill.employeeIds.add(checkbox.value);
  } else {
    dailyPeopleFill.employeeIds.delete(checkbox.value);
  }
  renderDailyPeoplePicker();
}

function applyDailyCustomToSelectedPeople() {
  const parsed = parseHours(els.dailySelectedCustom.value);
  if (!parsed.valid || parsed.empty) {
    els.dailySelectedCustom.classList.add("is-invalid");
    showDailyNotice("Enter a valid selected-people hour value.");
    return;
  }
  els.dailySelectedCustom.classList.remove("is-invalid");

  const employeeIds = getDailySelectedEmployeeIds();
  if (!employeeIds.length) {
    showDailyNotice("Choose at least one person.");
    return;
  }

  employeeIds.forEach((employeeId) => {
    getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours = formatNumber(parsed.value);
  });
  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
  showDailyNotice(`${employeeIds.length} ${employeeIds.length === 1 ? "person" : "people"} updated.`);
}

function getDailySelectedEmployeeIds() {
  if (dailyPeopleFill.applyAll) {
    return getActiveEmployees().map((employee) => employee.id);
  }
  return Array.from(dailyPeopleFill.employeeIds).filter((employeeId) =>
    getActiveEmployees().some((employee) => employee.id === employeeId)
  );
}

function handleDailyRosterClick(event) {
  const groupButton = event.target.closest("[data-daily-group-hours]");
  if (groupButton) {
    event.preventDefault();
    event.stopPropagation();
    applyDailyHoursToGroup(groupButton.dataset.groupLabel, Number(groupButton.dataset.dailyGroupHours));
    return;
  }

  const templateButton = event.target.closest("[data-note-template]");
  if (templateButton) {
    applyNoteTemplate(templateButton.dataset.employeeId, selectedDailyDayKey, templateButton.dataset.noteTemplate);
    return;
  }

  const button = event.target.closest("[data-daily-action]");
  if (!button) return;

  const employeeId = button.dataset.employeeId;
  if (button.dataset.dailyAction === "preset") {
    expandedDailyEmployeeId = employeeId;
    setDailyEmployeeHours(employeeId, Number(button.dataset.hours));
  }
  if (button.dataset.dailyAction === "step") {
    expandedDailyEmployeeId = employeeId;
    stepDailyEmployeeHours(employeeId, Number(button.dataset.step));
  }
  if (button.dataset.dailyAction === "toggle-note") {
    const noteKey = getNoteKey(employeeId, selectedDailyDayKey);
    if (openNotes.has(noteKey)) openNotes.delete(noteKey);
    else openNotes.add(noteKey);
    expandedDailyEmployeeId = employeeId;
    renderDailyLog();
  }
  if (button.dataset.dailyAction === "save-note-template") {
    addNoteTemplate(getEmployeeEntry(employeeId).days[selectedDailyDayKey].note);
  }
}

function handleDailyRosterToggle(event) {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement)) return;

  if (details.classList.contains("group-details")) {
    rememberGroupToggle(details);
    return;
  }

  if (!details.classList.contains("daily-row")) return;
  const row = details;

  if (row.open) {
    expandedDailyEmployeeId = row.dataset.employeeId;
    els.dailyRoster.querySelectorAll(".daily-row[open]").forEach((otherRow) => {
      if (otherRow !== row) otherRow.open = false;
    });
  } else if (expandedDailyEmployeeId === row.dataset.employeeId) {
    expandedDailyEmployeeId = null;
  }
  saveState();
}

function handleDailyRosterInput(event) {
  const target = event.target;
  const employeeId = target.dataset.employeeId;
  if (!employeeId) return;

  if (target.matches("[data-daily-hours]")) {
    if (target.value.startsWith("-")) target.value = "";
    getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours = target.value;
    expandedDailyEmployeeId = employeeId;
    clearDayReview(selectedDailyDayKey);
    saveState();
    updateDailyRow(target.closest(".daily-row"), employeeId);
    renderDailyProgress();
    renderDailyReview();
    renderSummaryView();
    renderLogEmployeeList();
    renderPrintReport();
    return;
  }

  if (target.matches("[data-daily-note]")) {
    getEmployeeEntry(employeeId).days[selectedDailyDayKey].note = target.value;
    expandedDailyEmployeeId = employeeId;
    clearDayReview(selectedDailyDayKey);
    saveState();
    renderDailyReview();
    renderSummaryView();
    renderPrintReport();
  }
}

function handleDailyRosterKeydown(event) {
  if (event.target.matches("input[type='number']")) {
    blockInvalidNumberKeys(event);
  }
}

function setDailyEmployeeHours(employeeId, hours) {
  getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours = formatNumber(Math.max(0, Number(hours) || 0));
  expandedDailyEmployeeId = employeeId;
  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
}

function stepDailyEmployeeHours(employeeId, step) {
  const dayEntry = getEmployeeEntry(employeeId).days[selectedDailyDayKey];
  const parsed = parseHours(dayEntry.hours);
  const current = parsed.valid ? parsed.value : 0;
  dayEntry.hours = formatNumber(Math.max(0, current + step));
  expandedDailyEmployeeId = employeeId;
  clearDayReview(selectedDailyDayKey);
  saveState();
  renderApp();
}

function updateDailyRow(row, employeeId) {
  if (!row) return;
  const parsed = parseHours(getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours);
  const status = getDailyEntryStatus(employeeId);
  const badges = row.querySelector(".warning-badges");
  const summaryHours = row.querySelector(".daily-summary-hours strong");
  row.dataset.dailyStatus = status;
  row.classList.toggle("has-missing", status === "missing");
  row.classList.toggle("has-invalid", status === "invalid");
  if (badges) {
    badges.innerHTML = renderDailyEntryBadge(parsed);
  }
  if (summaryHours) {
    const hours = getEmployeeEntry(employeeId).days[selectedDailyDayKey].hours;
    summaryHours.textContent = `${hours === "" ? "0" : hours}h`;
  }
  renderDailyRosterTools();
}

function calculateDailyStats(dayKey) {
  const activeEmployees = getActiveEmployees();
  const employeeCount = activeEmployees.length;
  let filledCount = 0;
  let total = 0;
  activeEmployees.forEach((employee) => {
    const parsed = parseHours(getEmployeeEntry(employee.id).days[dayKey].hours);
    if (!parsed.empty && parsed.valid) filledCount += 1;
    total += parsed.value;
  });
  return { employeeCount, filledCount, total };
}

function renderQuickFill() {
  const activeEmployees = getActiveEmployees();
  const options = activeEmployees.map((employee) => {
    const selected = employee.id === quickFill.employeeId ? " selected" : "";
    return `<option value="${escapeAttr(employee.id)}"${selected}>${escapeHtml(displayEmployeeOptionLabel(employee))}</option>`;
  });

  els.quickEmployee.innerHTML = options.length ? options.join("") : `<option value="">No employees yet</option>`;
  els.quickEmployee.disabled = !activeEmployees.length;
  els.quickApply.disabled = !activeEmployees.length;

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
  clearDayReviews(days);
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

function renderBulkFill() {
  const activeEmployees = getActiveEmployees();
  els.bulkApply.disabled = !activeEmployees.length;
  els.bulkPeopleActions.replaceChildren(
    createBulkPeopleButton("all", "All people", bulkFill.applyAll),
    createBulkPeopleButton("choose", "Choose", !bulkFill.applyAll),
    createBulkPeopleButton("clear", "Clear", false)
  );

  if (!activeEmployees.length) {
    els.bulkPeopleList.innerHTML = `<div class="empty-state">No employees yet.</div>`;
  } else {
    const peopleNodes = activeEmployees.map((employee) => {
      const label = document.createElement("label");
      label.className = "check-row";
      label.innerHTML = `
        <input type="checkbox" data-bulk-person value="${escapeAttr(employee.id)}">
        <span></span>
      `;
      const checkbox = label.querySelector("input");
      checkbox.checked = bulkFill.applyAll || bulkFill.employeeIds.has(employee.id);
      label.querySelector("span").textContent = displayEmployeeOptionLabel(employee);
      return label;
    });
    els.bulkPeopleList.replaceChildren(...peopleNodes);
  }

  els.bulkPresetButtons.replaceChildren(...QUICK_PRESETS.map((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.bulkPreset = preset.key;
    button.setAttribute("aria-pressed", String(bulkFill.preset === preset.key));
    button.textContent = preset.label;
    return button;
  }));

  els.bulkCustomWrap.classList.toggle("is-hidden", bulkFill.preset !== "custom");
  els.bulkCustomHours.value = bulkFill.customHours;

  els.bulkDayButtons.replaceChildren(...getBulkDayOptions().map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.bulkDay = item.key;
    button.disabled = Boolean(item.disabled);
    button.setAttribute("aria-pressed", String(!item.disabled && isBulkDaySelected(item.key, item.days)));
    button.textContent = item.label;
    return button;
  }));
}

function createBulkPeopleButton(action, label, selected) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "segment-button";
  button.dataset.bulkPeopleAction = action;
  button.setAttribute("aria-pressed", String(selected));
  button.textContent = label;
  return button;
}

function handleBulkPeopleAction(event) {
  const button = event.target.closest("[data-bulk-people-action]");
  if (!button) return;

  if (button.dataset.bulkPeopleAction === "all") {
    bulkFill.applyAll = true;
    bulkFill.employeeIds.clear();
  }
  if (button.dataset.bulkPeopleAction === "choose") {
    bulkFill.applyAll = false;
  }
  if (button.dataset.bulkPeopleAction === "clear") {
    bulkFill.applyAll = false;
    bulkFill.employeeIds.clear();
  }

  renderBulkFill();
}

function handleBulkPersonChange(event) {
  const checkbox = event.target.closest("[data-bulk-person]");
  if (!checkbox) return;

  bulkFill.applyAll = false;
  if (checkbox.checked) {
    bulkFill.employeeIds.add(checkbox.value);
  } else {
    bulkFill.employeeIds.delete(checkbox.value);
  }
  renderBulkFill();
}

function handleBulkPresetClick(event) {
  const button = event.target.closest("[data-bulk-preset]");
  if (!button) return;
  bulkFill.preset = button.dataset.bulkPreset;
  renderBulkFill();
}

function handleBulkDayClick(event) {
  const button = event.target.closest("[data-bulk-day]");
  if (!button || button.disabled) return;
  const option = getBulkDayOptions().find((item) => item.key === button.dataset.bulkDay);
  if (!option || !option.days.length) return;

  if (DAY_GROUPS[option.key] || option.key === "today") {
    bulkFill.days = new Set(option.days);
  } else if (bulkFill.days.has(option.key)) {
    bulkFill.days.delete(option.key);
  } else {
    bulkFill.days.add(option.key);
  }

  renderBulkFill();
}

function applyBulkFill() {
  const employeeIds = getBulkEmployeeIds();
  if (!employeeIds.length) {
    showBulkNotice("Choose at least one person.");
    return;
  }

  const hours = getBulkPresetHours();
  if (!hours.valid) {
    els.bulkCustomHours.classList.add("is-invalid");
    showBulkNotice("Enter a valid custom hour value.");
    return;
  }
  els.bulkCustomHours.classList.remove("is-invalid");

  const days = Array.from(bulkFill.days);
  if (!days.length) {
    showBulkNotice("Choose at least one day.");
    return;
  }

  employeeIds.forEach((employeeId) => setEmployeeDays(employeeId, days, hours.value));
  clearDayReviews(days);
  expandedEmployeeId = employeeIds[0] || expandedEmployeeId;
  saveState();
  renderApp();
  showBulkNotice(`${employeeIds.length} ${employeeIds.length === 1 ? "person" : "people"} updated.`);
}

function getBulkPresetHours() {
  const preset = QUICK_PRESETS.find((item) => item.key === bulkFill.preset);
  if (!preset) return { valid: false, value: 0 };
  if (preset.key !== "custom") return { valid: true, value: preset.hours };
  return parseHours(els.bulkCustomHours.value);
}

function getBulkEmployeeIds() {
  if (bulkFill.applyAll) {
    return getActiveEmployees().map((employee) => employee.id);
  }
  return Array.from(bulkFill.employeeIds).filter((employeeId) =>
    getActiveEmployees().some((employee) => employee.id === employeeId)
  );
}

function getBulkDayOptions() {
  const todayDay = getTodayDayKeyInSelectedWeek();
  return [
    {
      key: "today",
      label: todayDay ? `Today ${dayByKey(todayDay).short}` : "Today outside week",
      days: todayDay ? [todayDay] : [],
      disabled: !todayDay
    },
    ...DAYS.map((day) => ({ key: day.key, label: day.short, days: [day.key] })),
    { key: "weekdays", label: "Weekdays", days: DAY_GROUPS.weekdays },
    { key: "weekend", label: "Weekend", days: DAY_GROUPS.weekend },
    { key: "all", label: "All week", days: DAY_GROUPS.all }
  ];
}

function isBulkDaySelected(key, days) {
  if (DAY_GROUPS[key] || key === "today") {
    return setEquals(bulkFill.days, new Set(days));
  }
  return bulkFill.days.has(key);
}

function renderLogEmployeeList() {
  const activeEmployees = getActiveEmployees();
  if (!activeEmployees.length) {
    els.logEmployeeList.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  activeEmployees.forEach((employee) => {
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
          <span class="employee-role">${escapeHtml(displayEmployeeGroup(employee))}${employee.role ? ` - ${escapeHtml(employee.role)}` : ""}</span>
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
        ${renderNoteTemplateButtons(employeeId, day.key, "week")}
        <label>
          Note
          <textarea rows="2" data-note-input data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">${escapeHtml(dayEntry.note)}</textarea>
        </label>
        <button type="button" class="button tiny secondary" data-log-action="save-note-template" data-employee-id="${escapeAttr(employeeId)}" data-day="${day.key}">Save note as template</button>
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
    { label: "Empty weeks", value: String(summary.emptyWeeks.length), detail: "All days empty or 0" },
    { label: "Signed days", value: `${summary.signedDays}/7`, detail: "Daily review" }
  ];

  els.summaryMetrics.replaceChildren(...metrics.map(createMetric));
  els.dayTotalsMeta.textContent = `${formatNumber(summary.combinedTotal)}h`;
  els.employeeTotalsMeta.textContent = `${summary.employees.length} ${summary.employees.length === 1 ? "person" : "people"}`;
  els.warningsMeta.textContent = summary.warningCount ? `${summary.warningCount} warning${summary.warningCount === 1 ? "" : "s"}` : "Clear";
  renderDayTotals(summary);
  renderEmployeeTotals(summary);
  renderWarningSummary(summary);
  renderOvertimeReview(summary);
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
    row.querySelector("span").textContent = `${formatNumber(summary.dayTotals[day.key])}h${getDayReview(day.key).signed ? " - signed" : ""}`;
    return row;
  });
  els.dayTotals.replaceChildren(...nodes);
}

function renderEmployeeTotals(summary) {
  if (!summary.employees.length) {
    els.employeeTotals.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const nodes = summary.employees.map((item) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = displayEmployeeOptionLabel(item.employee);
    row.querySelector("span").textContent = `${formatNumber(item.total)}h`;
    return row;
  });
  els.employeeTotals.replaceChildren(...nodes);
}

function renderWarningSummary(summary) {
  if (!summary.employees.length) {
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

function renderOvertimeReview(summary) {
  if (!els.overtimeReview) return;
  const threshold = getThreshold();
  const overtimeItems = summary.overThreshold;
  els.overtimeMeta.textContent = `${overtimeItems.length} ${overtimeItems.length === 1 ? "person" : "people"}`;

  if (!overtimeItems.length) {
    els.overtimeReview.innerHTML = `<div class="empty-state">No employees are over the ${formatNumber(threshold)}h threshold this week.</div>`;
    return;
  }

  const nodes = overtimeItems.map((item) => {
    const node = document.createElement("article");
    node.className = "overtime-card";
    const daily = DAYS
      .map((day) => `<span><strong>${day.short}</strong>${formatNumber(item.dayValues[day.key])}h</span>`)
      .join("");
    node.innerHTML = `
      <div class="overtime-card-head">
        <div>
          <strong>${escapeHtml(displayEmployeeName(item.employee))}</strong>
          <span>${escapeHtml(displayEmployeeGroup(item.employee))}${item.employee.role ? ` - ${escapeHtml(item.employee.role)}` : ""}</span>
        </div>
        <div class="employee-total">
          <strong>${formatNumber(item.total)}h</strong>
          <span>${formatNumber(item.total - threshold)}h over</span>
        </div>
      </div>
      <div class="overtime-days">${daily}</div>
    `;
    return node;
  });
  els.overtimeReview.replaceChildren(...nodes);
}

function createBadge(text, type) {
  const node = document.createElement("span");
  node.className = `badge ${type || ""}`.trim();
  node.textContent = text;
  return node;
}

function getActiveEmployees() {
  return state.employees.filter((employee) => !employee.archivedAt);
}

function getArchivedEmployees() {
  return state.employees.filter((employee) => employee.archivedAt);
}

function getReportEmployees() {
  return state.employees.filter((employee) => !employee.archivedAt || employeeHasWeekData(employee.id));
}

function employeeHasWeekData(employeeId) {
  const week = getWeek();
  const entry = week.entries[employeeId];
  if (!entry) return false;
  return DAYS.some((day) => {
    const dayEntry = entry.days?.[day.key];
    if (!dayEntry) return false;
    return String(dayEntry.hours ?? "").trim() !== "" || String(dayEntry.note ?? "").trim() !== "";
  });
}

function groupEmployees(employees) {
  const groups = new Map();
  employees.forEach((employee) => {
    const label = displayEmployeeGroup(employee);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(employee);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, groupEmployeesList]) => ({
      label,
      employees: groupEmployeesList.slice().sort((left, right) => displayEmployeeName(left).localeCompare(displayEmployeeName(right)))
    }));
}

function getGroupNames() {
  return Array.from(new Set(
    state.employees
      .map((employee) => (employee.group || "").trim())
      .filter(Boolean)
  )).sort((left, right) => left.localeCompare(right));
}

function renderGroupOptions() {
  if (!els.employeeGroupOptions) return;
  const groupNames = getGroupNames();
  const options = groupNames.map((groupName) => {
    const option = document.createElement("option");
    option.value = groupName;
    return option;
  });
  els.employeeGroupOptions.replaceChildren(...options);
  renderGroupChoiceButtons(els.employeeGroupChoices, "employeeGroup", groupNames);
  renderGroupChoiceButtons(els.modalEmployeeGroupChoices, "modalEmployeeGroup", groupNames);
}

function renderGroupChoiceButtons(container, inputId, groupNames) {
  if (!container) return;
  if (!groupNames.length) {
    container.replaceChildren();
    container.classList.add("is-hidden");
    return;
  }

  const label = document.createElement("span");
  label.className = "mini-label";
  label.textContent = "Existing groups";
  const buttons = groupNames.map((groupName) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-choice-button";
    button.dataset.groupChoice = groupName;
    button.dataset.groupTarget = inputId;
    button.textContent = groupName;
    return button;
  });
  container.classList.remove("is-hidden");
  container.replaceChildren(label, ...buttons);
}

function handleGroupChoiceClick(event) {
  const button = event.target.closest("[data-group-choice]");
  if (!button) return;
  const input = document.getElementById(button.dataset.groupTarget);
  if (!input) return;
  input.value = button.dataset.groupChoice;
  input.focus();
}

function getGroupKey(label) {
  return String(label || "").trim().toLowerCase() || "no-company-or-group";
}

function isGroupOpen(label) {
  return !collapsedGroupKeys.has(getGroupKey(label));
}

function rememberGroupToggle(details) {
  const key = getGroupKey(details.dataset.groupLabel);
  if (details.open) {
    collapsedGroupKeys.delete(key);
  } else {
    collapsedGroupKeys.add(key);
  }
}

function renderBadges(badges) {
  if (!badges.length) return `<span class="badge ok">Ready</span>`;
  return badges.map((badge) => `<span class="badge ${badge.type}">${escapeHtml(badge.label)}</span>`).join("");
}

function renderPeopleView() {
  const activeEmployees = getActiveEmployees();
  const archivedEmployees = getArchivedEmployees();
  if (!state.employees.length) {
    els.peopleList.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  if (activeEmployees.length) {
    groupEmployees(activeEmployees).forEach((group) => {
      fragment.appendChild(createPeopleGroup(group, false));
    });
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No active employees. Restore an archived employee or add a new one.";
    fragment.appendChild(empty);
  }

  if (archivedEmployees.length) {
    const archived = {
      label: "Archived employees",
      employees: archivedEmployees.slice().sort((left, right) => displayEmployeeName(left).localeCompare(displayEmployeeName(right)))
    };
    fragment.appendChild(createPeopleGroup(archived, true));
  }

  els.peopleList.replaceChildren(fragment);
}

function createPeopleGroup(group, archived) {
  const section = document.createElement("details");
  section.className = `people-group group-details${archived ? " archived-group" : ""}`;
  section.dataset.groupLabel = group.label;
  section.open = !archived && (isGroupOpen(group.label) || group.employees.some((employee) => employee.id === focusPersonId));
  section.innerHTML = `
    <summary class="daily-group-heading">
      <strong>${escapeHtml(group.label)}</strong>
      <span>${group.employees.length} ${group.employees.length === 1 ? "person" : "people"}</span>
    </summary>
    <div class="group-body"></div>
  `;
  const groupBody = section.querySelector(".group-body");
  group.employees.forEach((employee) => {
    const card = document.createElement("details");
    card.className = "person-card person-details";
    card.dataset.employeeId = employee.id;
    card.innerHTML = `
        <summary>
          <span>
            <strong>${escapeHtml(displayEmployeeName(employee))}</strong>
            <small>${escapeHtml(displayEmployeeGroup(employee))}${employee.role ? ` - ${escapeHtml(employee.role)}` : ""}${archived ? " - Archived" : ""}</small>
          </span>
          <span class="summary-meta">${archived ? "Restore" : "Edit"}</span>
        </summary>
        <div class="person-fields">
          <label>
            Employee name
            <input type="text" value="${escapeAttr(employee.name)}" autocomplete="off" data-person-name data-employee-id="${escapeAttr(employee.id)}">
          </label>
          <label>
            Company or group
            <input type="text" value="${escapeAttr(employee.group || "")}" autocomplete="off" list="employeeGroupOptions" data-person-group data-employee-id="${escapeAttr(employee.id)}">
          </label>
          <label>
            Role or note
            <input type="text" value="${escapeAttr(employee.role || "")}" autocomplete="off" data-person-role data-employee-id="${escapeAttr(employee.id)}">
          </label>
        </div>
        <button type="button" class="button ${archived ? "secondary" : "danger"}" ${archived ? "data-restore-employee" : "data-archive-employee"} data-employee-id="${escapeAttr(employee.id)}">${archived ? "Restore employee" : "Archive employee"}</button>
      `;
    groupBody.appendChild(card);
  });
  return section;
}

function renderSettingsView() {
  els.thresholdInput.value = formatNumber(getThreshold());
  renderNoteTemplateSettings();
}

function handleLogClick(event) {
  const templateButton = event.target.closest("[data-note-template]");
  if (templateButton) {
    applyNoteTemplate(templateButton.dataset.employeeId, templateButton.dataset.day, templateButton.dataset.noteTemplate);
    return;
  }

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
    return;
  }

  if (action === "save-note-template") {
    addNoteTemplate(getEmployeeEntry(employeeId).days[button.dataset.day].note);
  }
}

function handleLogInput(event) {
  const target = event.target;
  if (target.matches("[data-hour-input]")) {
    if (target.value.startsWith("-")) target.value = "";
    const employeeId = target.dataset.employeeId;
    const dayKey = target.dataset.day;
    getEmployeeEntry(employeeId).days[dayKey].hours = target.value;
    clearDayReview(dayKey);
    saveState();
    updateAfterEmployeeChange(employeeId, target.closest(".employee-card"));
    updateDayEntry(target.closest(".day-entry"), employeeId, dayKey);
    return;
  }

  if (target.matches("[data-note-input]")) {
    const employeeId = target.dataset.employeeId;
    const dayKey = target.dataset.day;
    getEmployeeEntry(employeeId).days[dayKey].note = target.value;
    clearDayReview(dayKey);
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
  clearDayReviews(DAY_GROUPS.all);
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
  clearDayReviews(DAY_GROUPS.all);
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
  clearDayReviews(DAY_GROUPS.all);
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
  const days = DAY_GROUPS[selectedScope] || DAY_GROUPS.weekdays;
  setEmployeeDays(employeeId, days, parsed.value);
  clearDayReviews(days);
  expandedEmployeeId = employeeId;
  saveState();
  renderApp();
}

function setDayHours(employeeId, dayKey, hours) {
  const value = Math.max(0, Number(hours) || 0);
  getEmployeeEntry(employeeId).days[dayKey].hours = formatNumber(value);
  clearDayReview(dayKey);
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
  clearDayReview(dayKey);
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
  renderDailyProgress();
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

function renderNoteTemplateButtons(employeeId, dayKey) {
  if (!state.noteTemplates.length) return "";
  const buttons = state.noteTemplates.map((template) => `
    <button type="button" class="note-template-button" data-note-template="${escapeAttr(template)}" data-employee-id="${escapeAttr(employeeId)}" data-day="${escapeAttr(dayKey)}">${escapeHtml(template)}</button>
  `).join("");
  return `<div class="note-template-row"><span class="mini-label">Templates</span>${buttons}</div>`;
}

function applyNoteTemplate(employeeId, dayKey, template) {
  const cleanTemplate = String(template || "").trim();
  if (!cleanTemplate || !isDayKey(dayKey)) return;
  const dayEntry = getEmployeeEntry(employeeId).days[dayKey];
  const current = String(dayEntry.note || "").trim();
  dayEntry.note = current ? `${current}\n${cleanTemplate}` : cleanTemplate;
  openNotes.add(getNoteKey(employeeId, dayKey));
  expandedDailyEmployeeId = employeeId;
  expandedEmployeeId = employeeId;
  clearDayReview(dayKey);
  saveState();
  renderApp();
}

function addNoteTemplate(value, noticeTarget = "daily") {
  const template = String(value || "").trim();
  if (!template) {
    showTemplateNotice("Enter a note first.", noticeTarget);
    return false;
  }

  const exists = state.noteTemplates.some((item) => item.toLowerCase() === template.toLowerCase());
  if (exists) {
    showTemplateNotice("That template already exists.", noticeTarget);
    return false;
  }

  state.noteTemplates.push(template);
  state.noteTemplates.sort((left, right) => left.localeCompare(right));
  saveState();
  renderApp();
  showTemplateNotice("Template saved.", noticeTarget);
  return true;
}

function showTemplateNotice(message, target) {
  if (target === "settings") {
    showDataNotice(message);
  } else {
    showDailyNotice(message);
  }
}

function addNoteTemplateFromSettings() {
  if (addNoteTemplate(els.noteTemplateInput.value, "settings")) {
    els.noteTemplateInput.value = "";
  }
}

function renderNoteTemplateSettings() {
  if (!els.noteTemplateList) return;
  if (!state.noteTemplates.length) {
    els.noteTemplateList.innerHTML = `<div class="empty-state">No note templates yet.</div>`;
    return;
  }

  const nodes = state.noteTemplates.map((template) => {
    const row = document.createElement("div");
    row.className = "template-item";
    row.innerHTML = `
      <span>${escapeHtml(template)}</span>
      <button type="button" class="button tiny secondary" data-remove-template="${escapeAttr(template)}">Remove</button>
    `;
    return row;
  });
  els.noteTemplateList.replaceChildren(...nodes);
}

function handleNoteTemplateSettingsClick(event) {
  const button = event.target.closest("[data-remove-template]");
  if (!button) return;
  state.noteTemplates = state.noteTemplates.filter((template) => template !== button.dataset.removeTemplate);
  saveState();
  renderSettingsView();
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
  const employee = createEmployeeFromFields(els.employeeName.value, els.employeeGroup.value, els.employeeRole.value);
  if (!employee) {
    els.employeeName.focus();
    return;
  }

  els.addEmployeeForm.reset();
  setActiveTab("today");
}

function addEmployeeFromDialog(event) {
  event.preventDefault();
  const employee = createEmployeeFromFields(els.modalEmployeeName.value, els.modalEmployeeGroup.value, els.modalEmployeeRole.value);
  if (!employee) {
    els.modalEmployeeName.focus();
    return;
  }

  els.employeeDialogForm.reset();
  closeEmployeeDialog();
  setActiveTab("today");
}

function createEmployeeFromFields(name, group, role) {
  const employeeName = String(name || "").trim();
  if (!employeeName) return null;

  const employee = {
    id: createId(),
    name: employeeName,
    group: String(group || "").trim(),
    role: String(role || "").trim(),
    archivedAt: ""
  };
  state.employees.push(employee);
  expandedEmployeeId = employee.id;
  quickFill.employeeId = employee.id;
  return employee;
}

function openEmployeeDialog() {
  if (!els.employeeDialog.showModal) {
    setActiveTab("people");
    requestAnimationFrame(() => els.employeeName.focus());
    return;
  }

  if (els.employeeDialog.open) return;
  els.employeeDialogForm.reset();
  document.body.classList.add("modal-open");
  els.employeeDialog.showModal();
  requestAnimationFrame(() => els.modalEmployeeName.focus());
}

function closeEmployeeDialog() {
  if (els.employeeDialog.open) {
    els.employeeDialog.close();
  }
  document.body.classList.remove("modal-open");
}

function handlePeopleInput(event) {
  const target = event.target;
  const employeeId = target.dataset.employeeId;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  if (target.matches("[data-person-name]")) {
    employee.name = target.value;
  }
  if (target.matches("[data-person-group]")) {
    employee.group = target.value;
  }
  if (target.matches("[data-person-role]")) {
    employee.role = target.value;
  }

  saveState();
  renderGroupOptions();
  renderDailyLog();
  renderQuickFill();
  renderBulkFill();
  renderLogEmployeeList();
  renderSummaryView();
  renderPrintReport();
}

function handlePeopleToggle(event) {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.classList.contains("group-details")) return;
  rememberGroupToggle(details);
}

function handlePeopleClick(event) {
  const archiveButton = event.target.closest("[data-archive-employee]");
  const restoreButton = event.target.closest("[data-restore-employee]");
  const button = archiveButton || restoreButton;
  if (!button) return;

  const employeeId = button.dataset.employeeId;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  if (archiveButton) {
    const confirmed = window.confirm(`Archive ${displayEmployeeName(employee)}? Saved hours and notes will stay in reports and backups.`);
    if (!confirmed) return;
    employee.archivedAt = new Date().toISOString();
  }

  if (restoreButton) {
    employee.archivedAt = "";
  }

  if (expandedEmployeeId === employeeId) expandedEmployeeId = null;
  if (expandedDailyEmployeeId === employeeId) expandedDailyEmployeeId = null;
  if (quickFill.employeeId === employeeId) quickFill.employeeId = getActiveEmployees()[0]?.id || "";
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
  renderLogEmployeeList();
  renderSummaryView();
  renderPrintReport();
}

function calculateWeekSummary() {
  const dayTotals = Object.fromEntries(DAYS.map((day) => [day.key, 0]));
  const employees = getReportEmployees().map((employee) => {
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
    signedDays: DAYS.filter((day) => getDayReview(day.key).signed).length,
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
  activeTab = "today";
  selectedDailyDayKey = getDefaultDailyDayKey();
  expandedEmployeeId = null;
  expandedDailyEmployeeId = null;
  dailyRosterFilter = "all";
  dailySearchQuery = "";
  quickFill.employeeId = "";
  bulkFill.applyAll = true;
  bulkFill.employeeIds.clear();
  dailyPeopleFill.applyAll = false;
  dailyPeopleFill.employeeIds.clear();
  openNotes.clear();
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
    "company/group",
    "role/note"
  ];

  DAYS.forEach((day) => {
    headers.push(`${day.label} hours`, `${day.label} note`);
  });

  headers.push("weekly total", "threshold", "warning status");

  const rows = getReportEmployees().map((employee) => {
    const entry = getEmployeeEntry(employee.id);
    const analysis = analyzeEmployee(employee.id);
    const row = [
      weekStartKey,
      weekEndKey,
      displayEmployeeName(employee),
      employee.group || "",
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
  const employeeRows = getReportEmployees().map((employee) => {
    const entry = getEmployeeEntry(employee.id);
    const analysis = analyzeEmployee(employee.id);
    const cells = [
      `<td><strong>${escapeHtml(displayEmployeeName(employee))}</strong></td>`,
      `<td>${escapeHtml(employee.group || "")}</td>`,
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

  els.printArea.innerHTML = `
    <h1>Weekly Hours Report</h1>
    <div>${escapeHtml(getWeekRangeLabel())}</div>
    <table class="print-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Group</th>
          <th>Note</th>
          ${DAYS.map((day) => `<th>${day.label}</th>`).join("")}
          <th>Total</th>
          <th>Warning status</th>
        </tr>
      </thead>
      <tbody>${employeeRows || `<tr><td colspan="12">No employees</td></tr>`}</tbody>
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
      activeTab = normalizeTab(state.lastTab);
      selectedDailyDayKey = isDayKey(state.lastDailyDayKey) ? state.lastDailyDayKey : getDefaultDailyDayKey();
      dailyRosterFilter = normalizeDailyFilter(state.lastDailyFilter);
      dailySearchQuery = "";
      expandedEmployeeId = state.lastExpandedEmployeeId || null;
      expandedDailyEmployeeId = state.lastExpandedDailyEmployeeId || null;
      quickFill.employeeId = getActiveEmployees()[0]?.id || "";
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
  state.lastDailyDayKey = selectedDailyDayKey;
  state.lastDailyFilter = dailyRosterFilter;
  state.lastExpandedEmployeeId = expandedEmployeeId;
  state.lastExpandedDailyEmployeeId = expandedDailyEmployeeId;

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

  const noteTemplates = normalizeNoteTemplates(input.noteTemplates, strict);

  const selectedWeek = typeof input.selectedWeekStart === "string" && isDateKey(input.selectedWeekStart)
    ? toDateKey(startOfWeek(parseDateKey(input.selectedWeekStart)))
    : toDateKey(startOfWeek(new Date()));

  return {
    employees,
    weeks,
    threshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_THRESHOLD,
    noteTemplates,
    selectedWeekStart: selectedWeek,
    lastTab: normalizeTab(input.lastTab),
    lastDailyDayKey: isDayKey(input.lastDailyDayKey) ? input.lastDailyDayKey : getTodayDayKeyForWeek(parseDateKey(selectedWeek) || startOfWeek(new Date())) || "monday",
    lastDailyFilter: normalizeDailyFilter(input.lastDailyFilter),
    lastExpandedEmployeeId: typeof input.lastExpandedEmployeeId === "string" ? input.lastExpandedEmployeeId : null,
    lastExpandedDailyEmployeeId: typeof input.lastExpandedDailyEmployeeId === "string" ? input.lastExpandedDailyEmployeeId : null
  };
}

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== "object") return null;
  return {
    id: typeof employee.id === "string" && employee.id ? employee.id : createId(),
    name: typeof employee.name === "string" ? employee.name : "",
    group: typeof employee.group === "string" ? employee.group : typeof employee.company === "string" ? employee.company : "",
    role: typeof employee.role === "string" ? employee.role : "",
    archivedAt: typeof employee.archivedAt === "string" ? employee.archivedAt : employee.archived ? new Date().toISOString() : ""
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

  const dayReviews = createEmptyDayReviews();
  const sourceReviews = week.dayReviews && typeof week.dayReviews === "object" && !Array.isArray(week.dayReviews)
    ? week.dayReviews
    : {};

  if (strict && week.dayReviews !== undefined && sourceReviews !== week.dayReviews) {
    throw new Error("Invalid day reviews");
  }

  DAYS.forEach((day) => {
    const source = sourceReviews[day.key] || {};
    if (strict && sourceReviews[day.key] !== undefined && (typeof source !== "object" || Array.isArray(source))) {
      throw new Error("Invalid day review");
    }
    dayReviews[day.key] = {
      signed: Boolean(source.signed),
      signedAt: typeof source.signedAt === "string" ? source.signedAt : ""
    };
  });

  return { entries, dayReviews };
}

function normalizeNoteTemplates(value, strict) {
  if (value === undefined) return DEFAULT_NOTE_TEMPLATES.slice();
  if (!Array.isArray(value)) {
    if (strict) throw new Error("Invalid note templates");
    return DEFAULT_NOTE_TEMPLATES.slice();
  }

  const unique = [];
  value.forEach((item) => {
    if (typeof item !== "string") {
      if (strict) throw new Error("Invalid note template");
      return;
    }
    const template = item.trim();
    if (!template || unique.some((existing) => existing.toLowerCase() === template.toLowerCase())) return;
    unique.push(template);
  });
  return unique;
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
  const thisWeek = startOfWeek(new Date());
  return {
    employees: [],
    weeks: {},
    threshold: DEFAULT_THRESHOLD,
    noteTemplates: DEFAULT_NOTE_TEMPLATES.slice(),
    selectedWeekStart: toDateKey(thisWeek),
    lastTab: "today",
    lastDailyDayKey: getTodayDayKeyForWeek(thisWeek) || "monday",
    lastDailyFilter: "all",
    lastExpandedEmployeeId: null,
    lastExpandedDailyEmployeeId: null
  };
}

function ensureCurrentWeekEntries() {
  const week = getWeek();
  getActiveEmployees().forEach((employee) => {
    week.entries[employee.id] = normalizeEntry(week.entries[employee.id], false);
  });
}

function getWeek() {
  const weekKey = getWeekKey();
  if (!state.weeks[weekKey]) {
    state.weeks[weekKey] = { entries: {}, dayReviews: createEmptyDayReviews() };
  }
  state.weeks[weekKey] = normalizeWeek(state.weeks[weekKey], false);
  return state.weeks[weekKey];
}

function getEmployeeEntry(employeeId) {
  const week = getWeek();
  if (!week.entries[employeeId]) {
    week.entries[employeeId] = { days: createEmptyDays() };
  }
  return week.entries[employeeId];
}

function getDayReview(dayKey) {
  const week = getWeek();
  if (!week.dayReviews[dayKey]) {
    week.dayReviews[dayKey] = { signed: false, signedAt: "" };
  }
  return week.dayReviews[dayKey];
}

function clearDayReview(dayKey) {
  if (!isDayKey(dayKey)) return;
  const review = getDayReview(dayKey);
  if (!review.signed && !review.signedAt) return;
  review.signed = false;
  review.signedAt = "";
}

function clearDayReviews(dayKeys) {
  dayKeys.forEach(clearDayReview);
}

function createEmptyDays() {
  return Object.fromEntries(DAYS.map((day) => [day.key, { hours: "", note: "" }]));
}

function createEmptyDayReviews() {
  return Object.fromEntries(DAYS.map((day) => [day.key, { signed: false, signedAt: "" }]));
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

function isDayKey(value) {
  return DAYS.some((day) => day.key === value);
}

function getWeekRangeLabel() {
  return `Week of ${formatLongDate(selectedWeekStart)} to ${formatLongDate(addDays(selectedWeekStart, 6))}`;
}

function getSelectedDailyDate() {
  const index = DAYS.findIndex((day) => day.key === selectedDailyDayKey);
  return addDays(selectedWeekStart, index >= 0 ? index : 0);
}

function getAdjacentDayRef(offset) {
  const targetDate = addDays(getSelectedDailyDate(), offset);
  const weekStart = startOfWeek(targetDate);
  const dayKey = DAYS[(targetDate.getDay() + 6) % 7].key;
  return {
    date: targetDate,
    weekKey: toDateKey(weekStart),
    dayKey
  };
}

function getDefaultDailyDayKey() {
  return getTodayDayKeyInSelectedWeek() || "monday";
}

function getDefaultBulkDays() {
  const todayDay = getTodayDayKeyInSelectedWeek();
  return todayDay ? [todayDay] : DAY_GROUPS.weekdays;
}

function getTodayDayKeyInSelectedWeek() {
  return getTodayDayKeyForWeek(selectedWeekStart);
}

function getTodayDayKeyForWeek(weekStart) {
  const today = todayKey();
  const match = DAYS.find((day, index) => toDateKey(addDays(weekStart, index)) === today);
  return match ? match.key : "";
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

function formatSignedTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function displayEmployeeName(employee) {
  const name = (employee.name || "").trim();
  return name || "Unnamed employee";
}

function displayEmployeeGroup(employee) {
  const group = (employee.group || "").trim();
  return group || "No company or group";
}

function displayEmployeeOptionLabel(employee) {
  const group = (employee.group || "").trim();
  return group ? `${displayEmployeeName(employee)} - ${group}` : displayEmployeeName(employee);
}

function dayByKey(key) {
  return DAYS.find((day) => day.key === key);
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

function showBulkNotice(message) {
  els.bulkFillNotice.textContent = message;
  window.setTimeout(() => {
    if (els.bulkFillNotice.textContent === message) els.bulkFillNotice.textContent = "";
  }, 4200);
}

function showDailyNotice(message) {
  els.dailyNotice.textContent = message;
  window.setTimeout(() => {
    if (els.dailyNotice.textContent === message) els.dailyNotice.textContent = "";
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
