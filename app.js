"use strict";

const STORAGE_KEY = "weeklyHoursTracker:v1";
const DEFAULT_THRESHOLD = 40;

const DAYS = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" }
];

const WEEKDAY_NAMES = DAYS.map((day) => day.label);
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
let selectedWeekStart = startOfWeek(new Date());
let saveTimer = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  renderAll();
}

function cacheElements() {
  els.saveStatus = document.getElementById("saveStatus");
  els.weekRange = document.getElementById("weekRange");
  els.previousWeek = document.getElementById("previousWeek");
  els.currentWeek = document.getElementById("currentWeek");
  els.nextWeek = document.getElementById("nextWeek");
  els.thresholdInput = document.getElementById("thresholdInput");
  els.summaryMetrics = document.getElementById("summaryMetrics");
  els.employeeTotals = document.getElementById("employeeTotals");
  els.dayTotals = document.getElementById("dayTotals");
  els.warningSummary = document.getElementById("warningSummary");
  els.addEmployeeForm = document.getElementById("addEmployeeForm");
  els.employeeName = document.getElementById("employeeName");
  els.employeeRole = document.getElementById("employeeRole");
  els.employeeList = document.getElementById("employeeList");
  els.exportCsv = document.getElementById("exportCsv");
  els.printReport = document.getElementById("printReport");
  els.clearWeek = document.getElementById("clearWeek");
  els.clearAllData = document.getElementById("clearAllData");
  els.exportBackup = document.getElementById("exportBackup");
  els.importBackup = document.getElementById("importBackup");
  els.dataNotice = document.getElementById("dataNotice");
  els.printArea = document.getElementById("printArea");
}

function bindEvents() {
  els.previousWeek.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, -7);
    renderAll();
  });

  els.currentWeek.addEventListener("click", () => {
    selectedWeekStart = startOfWeek(new Date());
    renderAll();
  });

  els.nextWeek.addEventListener("click", () => {
    selectedWeekStart = addDays(selectedWeekStart, 7);
    renderAll();
  });

  els.thresholdInput.addEventListener("keydown", blockInvalidNumberKeys);
  els.thresholdInput.addEventListener("input", () => {
    const parsed = parseHours(els.thresholdInput.value);
    if (els.thresholdInput.value !== "" && !parsed.valid) {
      els.thresholdInput.classList.add("is-invalid");
      return;
    }

    els.thresholdInput.classList.remove("is-invalid");
    state.threshold = els.thresholdInput.value === "" ? DEFAULT_THRESHOLD : parsed.value;
    saveState();
    renderSummary();
    refreshAllEmployeeComputed();
  });

  els.addEmployeeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = els.employeeName.value.trim();
    const role = els.employeeRole.value.trim();

    if (!name) {
      els.employeeName.focus();
      return;
    }

    state.employees.push({
      id: createId(),
      name,
      role
    });
    saveState();
    els.addEmployeeForm.reset();
    renderAll();
  });

  els.employeeList.addEventListener("keydown", (event) => {
    if (event.target.matches("[data-day-hours]")) {
      blockInvalidNumberKeys(event);
    }
  });

  els.employeeList.addEventListener("input", handleEmployeeInput);
  els.employeeList.addEventListener("click", handleEmployeeClick);

  els.exportCsv.addEventListener("click", exportCsv);
  els.printReport.addEventListener("click", () => {
    renderPrintReport();
    window.print();
  });

  window.addEventListener("beforeprint", renderPrintReport);

  els.clearWeek.addEventListener("click", clearSelectedWeek);
  els.clearAllData.addEventListener("click", clearAllData);
  els.exportBackup.addEventListener("click", exportBackup);
  els.importBackup.addEventListener("change", importBackup);
}

function handleEmployeeInput(event) {
  const target = event.target;
  const employeeId = target.closest("[data-employee-id]")?.dataset.employeeId;
  if (!employeeId) return;

  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  if (target.matches("[data-employee-name]")) {
    employee.name = target.value;
    saveState();
    renderSummary();
    refreshEmployeeComputed(employeeId);
    return;
  }

  if (target.matches("[data-employee-role]")) {
    employee.role = target.value;
    saveState();
    renderSummary();
    return;
  }

  if (target.matches("[data-day-hours]")) {
    const dayKey = target.dataset.dayHours;
    if (target.value.startsWith("-")) {
      target.value = "";
    }
    const entry = getEmployeeEntry(employeeId);
    entry.days[dayKey].hours = target.value;
    saveState();
    renderSummary();
    refreshEmployeeComputed(employeeId);
    refreshDayCardState(target.closest(".day-card"), employeeId, dayKey);
    return;
  }

  if (target.matches("[data-day-note]")) {
    const dayKey = target.dataset.dayNote;
    const entry = getEmployeeEntry(employeeId);
    entry.days[dayKey].note = target.value;
    saveState();
    renderSummary();
    refreshEmployeeComputed(employeeId);
  }
}

function handleEmployeeClick(event) {
  const deleteButton = event.target.closest("[data-delete-employee]");
  if (!deleteButton) return;

  const employeeId = deleteButton.closest("[data-employee-id]")?.dataset.employeeId;
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) return;

  const label = displayEmployeeName(employee);
  const confirmed = window.confirm(`Delete ${label}? Saved hours for this person will be removed from every week.`);
  if (!confirmed) return;

  state.employees = state.employees.filter((item) => item.id !== employeeId);
  Object.values(state.weeks).forEach((week) => {
    if (week.entries) {
      delete week.entries[employeeId];
    }
  });

  saveState();
  renderAll();
}

function renderAll() {
  ensureCurrentWeekEntries();
  els.weekRange.textContent = getWeekRangeLabel();
  els.thresholdInput.value = formatNumber(getThreshold());
  renderSummary();
  renderEmployeeList();
  renderPrintReport();
}

function renderSummary() {
  const summary = calculateWeekSummary();

  renderMetrics(summary);
  renderEmployeeTotals(summary);
  renderDayTotals(summary);
  renderWarningSummary(summary);
}

function renderMetrics(summary) {
  const metrics = [
    {
      label: "Combined hours",
      value: formatNumber(summary.combinedTotal),
      detail: "All employees"
    },
    {
      label: "Active employees",
      value: String(summary.activeCount),
      detail: "Any logged hours"
    },
    {
      label: "Over threshold",
      value: String(summary.overThreshold.length),
      detail: `${formatNumber(getThreshold())} hour threshold`
    },
    {
      label: "Missing entries",
      value: String(summary.missingEntries.length),
      detail: "Employees with blanks"
    },
    {
      label: "No hours entered",
      value: String(summary.noHoursEntered.length),
      detail: "Employees at 0 hours"
    }
  ];

  els.summaryMetrics.replaceChildren(...metrics.map(createMetric));
}

function createMetric(metric) {
  const node = document.createElement("div");
  node.className = "metric";
  node.innerHTML = `
    <div class="label"></div>
    <div class="value"></div>
    <div class="detail"></div>
  `;
  node.querySelector(".label").textContent = metric.label;
  node.querySelector(".value").textContent = metric.value;
  node.querySelector(".detail").textContent = metric.detail;
  return node;
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
    row.querySelector("span").textContent = `${formatNumber(item.total)} hours`;
    return row;
  });

  els.employeeTotals.replaceChildren(...nodes);
}

function renderDayTotals(summary) {
  const nodes = DAYS.map((day, index) => {
    const row = document.createElement("div");
    row.className = "list-item";
    const dayDate = addDays(selectedWeekStart, index);
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = `${day.short} ${dayDate.getDate()}`;
    row.querySelector("span").textContent = `${formatNumber(summary.dayTotals[day.key])} hours`;
    return row;
  });

  els.dayTotals.replaceChildren(...nodes);
}

function renderWarningSummary(summary) {
  const warningNodes = [];

  if (!state.employees.length) {
    els.warningSummary.innerHTML = `<div class="empty-state">Warnings will appear after employees are added.</div>`;
    return;
  }

  summary.invalidValues.forEach((item) => {
    warningNodes.push(createWarningItem(displayEmployeeName(item.employee), "Invalid hours need attention.", true));
  });

  summary.overThreshold.forEach((item) => {
    warningNodes.push(createWarningItem(displayEmployeeName(item.employee), `Over ${formatNumber(getThreshold())} hours.`));
  });

  summary.missingEntries.forEach((item) => {
    warningNodes.push(createWarningItem(displayEmployeeName(item.employee), `Missing: ${item.missingLabels.join(", ")}.`));
  });

  summary.emptyRows.forEach((item) => {
    warningNodes.push(createWarningItem(displayEmployeeName(item.employee), "Empty row for this week."));
  });

  summary.noHoursEntered
    .filter((item) => !item.isEmptyRow)
    .forEach((item) => {
      warningNodes.push(createWarningItem(displayEmployeeName(item.employee), "No logged hours this week."));
    });

  if (!warningNodes.length) {
    els.warningSummary.innerHTML = `<div class="tag ok">No warnings for this week</div>`;
    return;
  }

  els.warningSummary.replaceChildren(...warningNodes);
}

function createWarningItem(name, message, isError = false) {
  const row = document.createElement("div");
  row.className = `warning-item${isError ? " error" : ""}`;
  row.innerHTML = `<strong></strong><span></span>`;
  row.querySelector("strong").textContent = name;
  row.querySelector("span").textContent = message;
  return row;
}

function renderEmployeeList() {
  if (!state.employees.length) {
    els.employeeList.innerHTML = `<div class="empty-state">No employees yet. Add your first employee.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.employees.forEach((employee) => {
    fragment.appendChild(createEmployeeCard(employee));
  });

  els.employeeList.replaceChildren(fragment);
}

function createEmployeeCard(employee) {
  const card = document.createElement("article");
  card.className = "employee-card";
  card.dataset.employeeId = employee.id;

  const entry = getEmployeeEntry(employee.id);
  const analysis = analyzeEmployee(employee.id);

  card.innerHTML = `
    <div class="employee-header">
      <div class="employee-fields">
        <label>
          Employee name
          <input type="text" data-employee-name autocomplete="off">
        </label>
        <label>
          Role or note
          <input type="text" data-employee-role autocomplete="off">
        </label>
      </div>
      <div class="employee-meta">
        <div class="employee-total">
          <div class="label">Weekly total</div>
          <div class="value" data-employee-total></div>
        </div>
        <button type="button" class="button danger" data-delete-employee>Delete</button>
      </div>
    </div>
    <div class="day-grid"></div>
    <div class="employee-warnings" data-employee-warnings></div>
  `;

  card.querySelector("[data-employee-name]").value = employee.name;
  card.querySelector("[data-employee-role]").value = employee.role || "";

  const dayGrid = card.querySelector(".day-grid");
  DAYS.forEach((day, index) => {
    dayGrid.appendChild(createDayCard(employee.id, day, index, entry.days[day.key]));
  });

  updateEmployeeComputed(card, analysis);
  return card;
}

function createDayCard(employeeId, day, index, dayEntry) {
  const card = document.createElement("div");
  card.className = "day-card";
  card.dataset.dayCard = day.key;

  const dayDate = addDays(selectedWeekStart, index);
  card.innerHTML = `
    <div class="day-title">
      <strong></strong>
      <span></span>
    </div>
    <label class="day-field">
      Hours
      <input type="number" min="0" step="0.25" inputmode="decimal" data-day-hours="${day.key}">
    </label>
    <label class="day-field">
      Note
      <textarea rows="2" data-day-note="${day.key}"></textarea>
    </label>
  `;

  card.querySelector("strong").textContent = day.label;
  card.querySelector("span").textContent = formatShortDate(dayDate);
  card.querySelector("[data-day-hours]").value = dayEntry.hours ?? "";
  card.querySelector("[data-day-note]").value = dayEntry.note ?? "";
  refreshDayCardState(card, employeeId, day.key);

  return card;
}

function refreshAllEmployeeComputed() {
  document.querySelectorAll("[data-employee-id]").forEach((card) => {
    refreshEmployeeComputed(card.dataset.employeeId);
  });
}

function refreshEmployeeComputed(employeeId) {
  const card = document.querySelector(`[data-employee-id="${cssEscape(employeeId)}"]`);
  if (!card) return;
  updateEmployeeComputed(card, analyzeEmployee(employeeId));
}

function updateEmployeeComputed(card, analysis) {
  const total = card.querySelector("[data-employee-total]");
  const warningWrap = card.querySelector("[data-employee-warnings]");

  total.textContent = `${formatNumber(analysis.total)}h`;
  card.classList.toggle("is-warning", analysis.warningStatuses.length > 0);
  card.classList.toggle("is-error", analysis.invalidDays.length > 0);

  const tags = [];
  if (analysis.invalidDays.length) {
    tags.push(createTag("Invalid hours need attention", "error"));
  }
  if (analysis.isOverThreshold) {
    tags.push(createTag(`Over ${formatNumber(getThreshold())} hour threshold`));
  }
  if (analysis.isEmptyRow) {
    tags.push(createTag("Empty row for this week"));
  } else if (analysis.missingDays.length) {
    tags.push(createTag(`Missing hours: ${analysis.missingLabels.join(", ")}`));
  }
  if (!analysis.hasLoggedHours && !analysis.isEmptyRow) {
    tags.push(createTag("No logged hours this week"));
  }

  warningWrap.replaceChildren(...tags);
}

function createTag(text, type = "warning") {
  const tag = document.createElement("div");
  tag.className = `tag${type === "error" ? " error" : ""}`;
  tag.textContent = text;
  return tag;
}

function refreshDayCardState(card, employeeId, dayKey) {
  if (!card) return;
  const dayEntry = getEmployeeEntry(employeeId).days[dayKey];
  const parsed = parseHours(dayEntry.hours);

  card.classList.toggle("has-invalid", !parsed.valid);
  card.classList.toggle("has-missing", parsed.empty);
  const input = card.querySelector("[data-day-hours]");
  if (input) {
    input.classList.toggle("is-invalid", !parsed.valid);
    input.setAttribute("aria-invalid", String(!parsed.valid));
  }
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

  const combinedTotal = employees.reduce((sum, item) => sum + item.total, 0);

  return {
    employees,
    dayTotals,
    combinedTotal,
    activeCount: employees.filter((item) => item.hasLoggedHours).length,
    overThreshold: employees.filter((item) => item.isOverThreshold),
    missingEntries: employees.filter((item) => !item.isEmptyRow && item.missingDays.length > 0),
    emptyRows: employees.filter((item) => item.isEmptyRow),
    noHoursEntered: employees.filter((item) => !item.hasLoggedHours),
    invalidValues: employees.filter((item) => item.invalidDays.length > 0)
  };
}

function analyzeEmployee(employeeId) {
  const entry = getEmployeeEntry(employeeId);
  const dayValues = {};
  const missingDays = [];
  const invalidDays = [];
  let total = 0;
  let hasAnyHourValue = false;
  let hasAnyNote = false;
  let hasLoggedHours = false;

  DAYS.forEach((day) => {
    const dayEntry = entry.days[day.key];
    const parsed = parseHours(dayEntry.hours);
    dayValues[day.key] = parsed.value;
    total += parsed.value;

    if (!parsed.empty) {
      hasAnyHourValue = true;
    } else {
      missingDays.push(day.key);
    }

    if (!parsed.valid) {
      invalidDays.push(day.key);
    }

    if ((dayEntry.note || "").trim()) {
      hasAnyNote = true;
    }

    if (parsed.value > 0) {
      hasLoggedHours = true;
    }
  });

  const isEmptyRow = !hasAnyHourValue && !hasAnyNote;
  const isOverThreshold = total > getThreshold();
  const missingLabels = missingDays.map((key) => dayByKey(key).short);
  const invalidLabels = invalidDays.map((key) => dayByKey(key).short);
  const warningStatuses = [];

  if (invalidDays.length) {
    warningStatuses.push(`Invalid values: ${invalidLabels.join(", ")}`);
  }
  if (isOverThreshold) {
    warningStatuses.push(`Over threshold`);
  }
  if (isEmptyRow) {
    warningStatuses.push("Empty row");
  } else if (missingDays.length) {
    warningStatuses.push(`Missing hours: ${missingLabels.join(", ")}`);
  }

  return {
    dayValues,
    total,
    hasAnyHourValue,
    hasLoggedHours,
    isEmptyRow,
    isOverThreshold,
    missingDays,
    missingLabels,
    invalidDays,
    invalidLabels,
    warningStatuses
  };
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

    row.push(
      formatNumber(analysis.total),
      formatNumber(getThreshold()),
      analysis.warningStatuses.length ? analysis.warningStatuses.join("; ") : "No warnings"
    );

    return row;
  });

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");

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
      const hours = dayEntry.hours === "" ? "0" : dayEntry.hours;
      cells.push(`
        <td>
          <strong>${escapeHtml(hours)}</strong>
          ${dayEntry.note ? `<div class="print-note">${escapeHtml(dayEntry.note)}</div>` : ""}
        </td>
      `);
    });

    cells.push(
      `<td><strong>${formatNumber(analysis.total)}</strong></td>`,
      `<td>${escapeHtml(analysis.warningStatuses.length ? analysis.warningStatuses.join("; ") : "No warnings")}</td>`
    );

    return `<tr>${cells.join("")}</tr>`;
  }).join("");

  const daySummary = DAYS.map((day) => `${day.short}: ${formatNumber(summary.dayTotals[day.key])}`).join(" | ");
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
      <div class="print-box"><strong>Combined hours</strong>${formatNumber(summary.combinedTotal)}</div>
      <div class="print-box"><strong>Active employees</strong>${summary.activeCount}</div>
      <div class="print-box"><strong>Over threshold</strong>${summary.overThreshold.length}</div>
      <div class="print-box"><strong>Missing entries</strong>${summary.missingEntries.length}</div>
      <div class="print-box"><strong>No hours entered</strong>${summary.noHoursEntered.length}</div>
    </div>
    <div class="print-box">
      <strong>Total hours per day</strong>
      ${escapeHtml(daySummary)}
    </div>
    <div class="print-box">
      <strong>Total hours per employee</strong>
      ${employeeSummary || "No employees"}
    </div>
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
      <tbody>
        ${employeeRows || `<tr><td colspan="11">No employees</td></tr>`}
      </tbody>
    </table>
  `;
}

function clearSelectedWeek() {
  const weekKey = getWeekKey();
  const confirmed = window.confirm(`Clear all hours and notes for the week starting ${weekKey}? Employees will stay in place.`);
  if (!confirmed) return;

  delete state.weeks[weekKey];
  saveState();
  renderAll();
  showNotice("Selected week cleared.");
}

function clearAllData() {
  const phrase = window.prompt("Type CLEAR ALL to remove employees, hours, notes, threshold, and backups from this tracker.");
  if (phrase !== "CLEAR ALL") {
    showNotice("Clear all cancelled.");
    return;
  }

  state = getDefaultState();
  selectedWeekStart = startOfWeek(new Date());
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  markSaved("All data cleared.");
  showNotice("All data cleared.");
}

function exportBackup() {
  const backup = {
    schema: STORAGE_KEY,
    exportedAt: new Date().toISOString(),
    data: state
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
        showNotice("Import cancelled.");
        return;
      }

      state = normalized;
      saveState();
      renderAll();
      showNotice("Backup imported.");
    } catch (error) {
      showNotice("Import failed. The file does not match the expected backup format.");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function loadState() {
  const fallback = getDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    return normalizeState(JSON.parse(raw), false);
  } catch (error) {
    requestAnimationFrame(() => {
      if (els.dataNotice) {
        showNotice("Stored data could not be read. A clean tracker is ready.");
      }
    });
    return fallback;
  }
}

function saveState() {
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

  const employees = Array.isArray(input.employees)
    ? input.employees.map(normalizeEmployee).filter(Boolean)
    : [];

  if (strict && !Array.isArray(input.employees)) {
    throw new Error("Employees must be an array");
  }

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
  if (strict && (!Number.isFinite(threshold) || threshold < 0)) {
    throw new Error("Invalid threshold");
  }

  return {
    employees,
    weeks,
    threshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_THRESHOLD
  };
}

function normalizeEmployee(employee) {
  if (!employee || typeof employee !== "object") return null;
  const id = typeof employee.id === "string" && employee.id ? employee.id : createId();
  return {
    id,
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
    threshold: DEFAULT_THRESHOLD
  };
}

function ensureCurrentWeekEntries() {
  const week = getWeek();
  state.employees.forEach((employee) => {
    if (!week.entries[employee.id]) {
      week.entries[employee.id] = { days: createEmptyDays() };
    } else {
      week.entries[employee.id] = normalizeEntry(week.entries[employee.id], false);
    }
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
  if (!text) {
    return { value: 0, empty: true, valid: true };
  }

  const simpleDecimal = /^(?:\d+\.?\d*|\.\d+)$/;
  const number = Number(text);
  const valid = simpleDecimal.test(text) && Number.isFinite(number) && number >= 0;
  return {
    value: valid ? number : 0,
    empty: false,
    valid
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
  return `${WEEKDAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function dayByKey(key) {
  return DAYS.find((day) => day.key === key);
}

function displayEmployeeName(employee) {
  const name = (employee.name || "").trim();
  return name || "Unnamed employee";
}

function markSaved(message) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  els.saveStatus.textContent = message === "Saved" ? `Saved ${time}` : message;
  els.saveStatus.classList.remove("is-error");
  els.saveStatus.classList.add("is-saved");

  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    els.saveStatus.classList.remove("is-saved");
  }, 1800);
}

function showNotice(message) {
  els.dataNotice.textContent = message;
  window.setTimeout(() => {
    if (els.dataNotice.textContent === message) {
      els.dataNotice.textContent = "";
    }
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

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/"/g, "\\\"");
}
