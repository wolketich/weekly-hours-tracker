# Weekly Hours Tracker

A static, fully client-side weekly hours tracker. It uses plain HTML, CSS, and JavaScript with no backend, no framework, and no build step.

## How to use

1. Open `index.html` in a browser.
2. Add employees with a name and optional role or note.
3. Select the week with Previous week, Current week, and Next week.
4. Enter total hours for each day from Monday to Sunday.
5. Add daily notes when needed.
6. Adjust the weekly threshold if 40 hours is not the right limit.

Weeks always run Monday to Sunday. Employees stay in the tracker across weeks, while hours and daily notes are saved separately for each week.

## Local browser storage

Data is stored in `localStorage` under the `weeklyHoursTracker:v1` key. It stays on the same device and browser profile after refreshes and week changes. There is no login and no server call.

If stored data is empty or unreadable, the app starts with a clean tracker instead of crashing.

## GitHub Pages hosting

1. Create a repository.
2. Add `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Commit and push the files.
4. In the repository settings, open Pages.
5. Choose the branch and root folder that contain `index.html`.
6. Save the Pages settings and open the published URL after GitHub finishes deploying.

No build command is required.

## CSV export

Use Export CSV to download the selected week only. The CSV includes the week start and end dates, employee details, daily hours, daily notes, weekly total, threshold, and warning status.

CSV values are escaped for commas, quotes, and new lines. The filename includes the selected week start date, such as `weekly-hours-2026-05-04.csv`.

## PDF export

Use Export PDF / Print to open the browser print dialog. The print layout includes the weekly report title, selected week range, threshold, summary totals, employee table, daily notes, weekly totals, and warning status.

Choose Save as PDF in the browser print dialog to create a PDF.

## Backup and restore

Use Export data backup to download a JSON backup of the tracker data.

Use Import data backup to restore a JSON backup. The app validates the basic structure before replacing the current tracker data. Importing a backup replaces the existing employees, weeks, hours, notes, and threshold in this browser.
