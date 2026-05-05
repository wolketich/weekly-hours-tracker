# Weekly Hours Tracker

A static, fully client-side weekly hours tracker. It uses plain HTML, CSS, and JavaScript with no backend, no framework, and no build step.

## Quick mobile workflow

Open `index.html` in a browser. The app has four sections:

- Log: choose a week, use Quick Fill, and expand one employee at a time.
- Summary: review totals, warnings, CSV export, and PDF/print export.
- People: add, edit, and delete employees.
- Settings: threshold, backup, restore, and clear data.

On phones, use the sticky bottom navigation. On desktop, the same sections appear in the top navigation.

## Add employees

Go to People, enter a name, optionally add a role or note, and tap Add. Employees stay available every week. Their hours and daily notes are stored separately for each Monday to Sunday week.

## Log hours faster

In Log, each employee appears as a compact card with their weekly total and small warning badges. Tap a card to open that employee's weekly entry panel. Only one employee is expanded at a time.

Each day has:

- Off, which sets 0 hours.
- Half day 5h, which sets 5 hours.
- Full day 10h, which sets 10 hours.
- +1 and -1 buttons.
- A numeric input for manual decimal hours.
- A collapsed note field opened with Add note or Edit note.

Use Full Week to set Monday to Friday to 10 hours and Saturday/Sunday to 0. Use Half Week to set Monday to Friday to 5 hours and Saturday/Sunday to 0. Use Copy Previous Week to copy that employee's hours and notes from the prior week.

## Apply Same Hours

Inside an expanded employee card, enter one hour value, choose Mon to Fri, Sat and Sun, or All week, then tap Apply. This updates only that employee for the selected week.

## Quick Fill

Quick Fill is at the top of Log:

1. Select an employee.
2. Choose Off 0h, Half day 5h, Full day 10h, or Custom.
3. Choose individual days, Weekdays, Weekend, or All week.
4. Tap Apply Quick Fill.

Example: select an employee, choose Full day 10h, choose Weekdays, and apply.

## Week-to-week memory

The selected week, active section, expanded employee, employees, threshold, hours, and notes are saved in `localStorage` under `weeklyHoursTracker:v1`. Data persists after refreshes on the same browser and device.

If browser storage is empty or unreadable, the app starts with a clean tracker instead of crashing.

## CSV export

Go to Summary and tap CSV. The export includes the selected week only, with week start and end dates, employee details, daily hours, daily notes, weekly total, threshold, and warning status.

CSV values are escaped for commas, quotes, and line breaks. The filename uses `weekly-hours-YYYY-MM-DD.csv`.

## PDF export

Go to Summary and tap PDF / Print. The app uses the browser print dialog with a clean weekly report layout. Choose Save as PDF in the print dialog to create a PDF.

## Backup and restore

Go to Settings. Export JSON backup downloads the tracker data. Import JSON backup validates the basic structure before replacing the current tracker data in this browser.

## GitHub Pages

1. Add `index.html`, `styles.css`, `app.js`, and `README.md` to a repository.
2. Commit and push the files.
3. Open the repository settings.
4. Enable Pages for the branch and root folder that contain `index.html`.
5. Open the published Pages URL after deployment completes.

No build command is required.
