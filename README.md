# Weekly Hours Tracker

A static, fully client-side weekly hours tracker. It uses plain HTML, CSS, and JavaScript with no backend, no framework, and no build step.

## Daily mobile workflow

Open `index.html` in a browser. The app starts on Today because the fastest daily workflow is:

1. Pick the date.
2. Use All Off, All 5h, or All 10h when everyone worked the same pattern.
3. Adjust individual people with Off, 5h, 10h, +1, or -1.
4. Open notes only for the rows that need them.

The Today screen shows the selected date, daily progress, and a compact roster. It avoids the large all-week table so a supervisor can fill the day with minimal scrolling.

## Sections

- Today: daily entry for the selected date.
- Week: weekly totals, warnings, CSV export, PDF/print export, and collapsed weekly tools.
- People: add, edit, and delete employees.
- Settings: threshold, backup, restore, and clear tools.

On phones, use the sticky bottom navigation. On desktop, the same sections appear in a compact top navigation.

## Add employees

On a phone, tap `+ Person` to open the add employee sheet. Enter a name, optionally add a role or note, and tap Add person. The same add form is also available in People inside the collapsed Add employee section.

Employees stay available every week. Their hours and daily notes are stored separately for each Monday to Sunday week.

## Fast daily entry

Today includes frequent supervisor shortcuts:

- All Off: sets everyone on the selected date to 0 hours.
- All 5h: sets everyone on the selected date to 5 hours.
- All 10h: sets everyone on the selected date to 10 hours.
- Custom or selected people: apply one custom value to everyone or only chosen people.
- Copy yesterday: copies the previous day's hours and notes into the selected date when previous-day data exists.
- Roster tools: search by name or role, filter to All, Needs entry, or Entered, and jump to the first missing or invalid row.

Each employee row includes:

- Manual decimal hour input.
- Off, 5h, and 10h buttons.
- +1 and -1 buttons. Hours never go below 0.
- Collapsed note field opened with Add note or Edit note.
- Compact status badges: Missing, Entered, or Invalid.

## Weekly tools

Open Week to review the core metrics. Daily totals, employee totals, warnings, exports, and Week tools are collapsed so the screen stays short on mobile.

Expand Week tools for less common weekly actions:

- Quick Fill: select one employee, choose a preset or custom hours, choose days, and apply.
- Bulk Fill: apply the same hours to all people or selected people across selected days.
- Employee week panels: open one employee at a time for full-week edits.

Employee week panels include Full Week 10h, Half Week 5h, Clear Week, Copy Previous Week, and Apply Same Hours.

## Week-to-week memory

The selected week, selected day, active section, roster filter, expanded employee, employees, threshold, hours, and notes are saved in `localStorage` under `weeklyHoursTracker:v1`. Data persists after refreshes on the same browser and device.

If browser storage is empty or unreadable, the app starts with a clean tracker instead of crashing.

## CSV export

Go to Week, expand Export report, and tap CSV. The export includes the selected week only, with week start and end dates, employee details, daily hours, daily notes, weekly total, threshold, and warning status.

CSV values are escaped for commas, quotes, and line breaks. The filename uses `weekly-hours-YYYY-MM-DD.csv`.

## PDF export

Go to Week, expand Export report, and tap PDF / Print. The app uses the browser print dialog with a clean weekly report layout. Choose Save as PDF in the print dialog to create a PDF.

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
