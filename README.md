# Weekly Hours Tracker

A static, fully client-side weekly hours tracker. It uses plain HTML, CSS, and JavaScript with no backend, no framework, and no build step.

## Daily mobile workflow

Open `index.html` in a browser. The app starts on Today because the fastest daily workflow is:

1. Pick the date.
2. Use All Off, All 5h, or All 10h when everyone worked the same pattern.
3. Use the group Off, 5h, or 10h buttons when one subcontractor or crew has the same day.
4. Adjust individual people with Off, 5h, 10h, +1, or -1.
5. Open notes only for the rows that need them.
6. Sign off the day when it has been reviewed.

The Today screen shows the selected date, daily progress, and a compact roster. It avoids the large all-week table so a supervisor can fill the day with minimal scrolling. Roster groups are collapsible, which helps keep subcontractor or crew lists short on a phone.

## Sections

- Today: daily entry for the selected date.
- Week: weekly totals, warnings, CSV export, PDF/print export, and collapsed weekly tools.
- People: add, edit, archive, and restore employees.
- Settings: threshold, note templates, backup, restore, and clear tools.

On phones, use the sticky bottom navigation. On desktop, the same sections appear in a compact top navigation.

## Add employees

On a phone, tap `+ Person` to open the add employee sheet. Enter a name, optionally add a company or group, optionally add a role or note, and tap Add person. After a group exists, the add forms show tappable existing-group chips and the People edit fields suggest saved groups, so the same group can be selected instead of typed again.

Employees stay available every week. Their hours and daily notes are stored separately for each Monday to Sunday week.

## Fast daily entry

Today includes frequent supervisor shortcuts:

- All Off: sets everyone on the selected date to 0 hours.
- All 5h: sets everyone on the selected date to 5 hours.
- All 10h: sets everyone on the selected date to 10 hours.
- Group Off, 5h, and 10h: sets only that collapsible company/group section for the selected date.
- Custom or selected people: apply one custom value to everyone or only chosen people.
- Copy yesterday: copies the previous day's hours and notes into the selected date when previous-day data exists.
- Sign off day: marks the selected date as reviewed. Editing hours or notes for that day removes the sign-off so it can be reviewed again.
- Roster tools: search by name, company/group, or role, filter to All, Needs entry, or Entered, and jump to the first missing or invalid row.
- Collapsible company/group headings: open only the crew or subcontractor you are filling right now.

Each employee row includes:

- A collapsed row summary with name, company/group, status, and current hours.
- Manual decimal hour input.
- Off, 5h, and 10h buttons.
- +1 and -1 buttons. Hours never go below 0.
- Collapsed note field opened with Add note or Edit note.
- Note template chips, including saved templates such as Rain delay and Left early.
- Compact status badges: Missing, Entered, or Invalid.

## Weekly tools

Open Week to review the core metrics. Daily totals, employee totals, warnings, overtime review, exports, and Week tools are collapsed so the screen stays short on mobile.

Expand Week tools for less common weekly actions:

- Quick Fill: select one employee, choose a preset or custom hours, choose days, and apply.
- Bulk Fill: apply the same hours to all people or selected people across selected days.
- Employee week panels: open one employee at a time for full-week edits.

Employee week panels include Full Week 10h, Half Week 5h, Clear Week, Copy Previous Week, and Apply Same Hours.

The Overtime review section shows only employees over the weekly threshold, with their total, hours over threshold, and day-by-day breakdown.

## Archive and restore

Use People to archive employees who should no longer appear in the daily roster. Archived employees keep their saved hours and notes, remain in backups, and still appear in reports for weeks where they have data. Open Archived employees in People to restore someone.

## Note templates

Settings includes saved note templates. Add common notes there, or open a note on a daily row and use Save note as template. Templates appear as one-tap chips whenever a note field is open.

## Week-to-week memory

The selected week, selected day, active section, roster filter, expanded employee, employees, archived employees, employee groups, threshold, daily sign-offs, note templates, hours, and notes are saved in `localStorage` under `weeklyHoursTracker:v1`. Data persists after refreshes on the same browser and device.

If browser storage is empty or unreadable, the app starts with a clean tracker instead of crashing.

## CSV export

Go to Week, expand Export report, and tap CSV. The export includes the selected week only, with week start and end dates, employee details, company/group, daily hours, daily notes, weekly total, threshold, and warning status.

CSV values are escaped for commas, quotes, and line breaks. The filename uses `weekly-hours-YYYY-MM-DD.csv`.

## PDF export

Go to Week, expand Export report, and tap PDF / Print. The app uses the browser print dialog with a clean table-only weekly report. Choose Save as PDF in the print dialog to create a PDF.

## Backup and restore

Go to Settings, then expand Backup and clear data. Export JSON backup downloads the tracker data. Import JSON backup validates the basic structure before replacing the current tracker data in this browser.

## PWA install and offline use

The app includes a web manifest and service worker, so it can be installed and cached for offline use after it is hosted on GitHub Pages or another HTTPS host.

PWA install and offline caching do not run from `file://` local testing. The app still works from `file://`, but the browser will not register the service worker there.

## GitHub Pages

1. Add `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `service-worker.js`, the `icons` folder, and `README.md` to a repository.
2. Commit and push the files.
3. Open the repository settings.
4. Enable Pages for the branch and root folder that contain `index.html`.
5. Open the published Pages URL after deployment completes.
6. Visit once online so the service worker can cache the app shell for offline use.

No build command is required.
