# Weekly Hours Tracker

A static, fully client-side weekly hours tracker. It uses plain HTML, CSS, and JavaScript with no backend, no framework, and no build step.

## Daily mobile workflow

Open `index.html` in a browser. The app starts on Today because the fastest workflow is:

1. Pick the date.
2. Use All Off, All 5h, or All 10h when everyone worked the same pattern.
3. Use the group Off, 5h, or 10h buttons when one crew has the same day.
4. Adjust individual workers with Off, 5h, 10h, +1, or -1.
5. Open notes only for rows that need them.
6. Tap Sign / Close Day and sign workers one at a time.

The Today screen shows the selected date, daily progress, sign-off progress, and a compact collapsible roster. It avoids the large all-week table so a supervisor can fill the day with minimal scrolling.

## Sign-off workflow

The sign-off flow is per worker, per day:

1. Tap Sign / Close Day.
2. Review the worker, group, credential details, saved hours, and saved note.
3. Enter or adjust the hours in the sign-off sheet.
4. Add or adjust the note if needed.
5. Take or choose a fresh ID-card photo when hours are above `0`.
6. Tap Sign worker.

Blank hours cannot be signed. An explicit `0` can be signed as absent: no photo is required, but a note is required. After a worker is signed, that worker's hours and note for the selected day are locked in the normal entry screens. The Sign worker button stays visible even when the row still needs hours, a note, or a photo, so the app can explain what is missing.

Use Prev and Next, or swipe left and right on the sign-off sheet, to review workers without closing the modal. The top of the sheet shows the current position, such as `1/10`.

To edit a signed row, use Reopen sign-off. The old signed snapshot is kept in history as voided, and the worker must be signed again after edits.

This is offline recordkeeping evidence, not legal identity verification. The app does not use face recognition, OCR, a backend, or external services.

## Add workers

On a phone, tap `+ Person` to open the add worker sheet. Enter a name or a credential ID. A name is optional when the credential ID is known.

Optional worker fields:

- Group
- Note
- Credential type: Safety Pass, Manual Handling, or Other
- Credential ID
- Credential expiry date
- Reference ID-card photo

After a group exists, the add forms show tappable existing-group chips so the same group can be selected instead of typed again.

## Fast daily entry

Today includes frequent supervisor shortcuts:

- All Off: sets everyone on the selected date to 0 hours.
- All 5h: sets everyone on the selected date to 5 hours.
- All 10h: sets everyone on the selected date to 10 hours.
- Group Off, 5h, and 10h: sets only that collapsible group section for the selected date.
- Custom or selected people: apply one custom value to everyone or only chosen people.
- Copy yesterday: copies the previous day's hours and notes into the selected date when previous-day data exists.
- Roster tools: search by name, group, note, or credential, filter to All, Needs entry, or Entered, and jump to the first missing or invalid row.

Each worker row includes manual decimal input, Off, 5h, 10h, +1, -1, collapsed notes, note templates, and compact status badges.

## Weekly tools

Open Week to review core metrics. Daily totals, worker totals, warnings, overtime review, exports, and Week tools are collapsed so the screen stays short on mobile.

Expand Week tools for less common weekly actions:

- Quick Fill: select one worker, choose a preset or custom hours, choose days, and apply.
- Bulk Fill: apply the same hours to all people or selected people across selected days.
- Worker week panels: open one worker at a time for full-week edits.

Signed rows are skipped by fill tools until their sign-off is reopened.

## Reports

Week report:

- Go to Week.
- Expand Export report.
- Tap PDF / Print.
- The browser print dialog opens a clean weekly hours table.

Daily sign-off sheet:

- Go to Today.
- Select the date.
- Tap Print Sign-Off.
- The print view includes Worker, Group, Credential, Hours, Note, Signed at, ID photo, and Status.

Use the browser print dialog to save either report as PDF.

## CSV export

Go to Week, expand Export report, and tap CSV. The export includes the selected week only, with week start and end dates, worker details, group, daily hours, daily notes, weekly total, threshold, warning status, and per-day sign-off metadata.

CSV values are escaped for commas, quotes, and line breaks. The filename uses `weekly-hours-YYYY-MM-DD.csv`.

## Backup and restore

Go to Settings, then expand Backup and clear data.

- Export JSON backup downloads tracker data plus stored image records.
- Import JSON backup validates the basic structure, replaces the current tracker data, and restores image records.
- Clear selected week removes that week's hours, notes, and sign-off metadata.
- Clear all data removes employees, hours, notes, sign-offs, photos, threshold, and saved view settings.

Hours, notes, employees, sign-off metadata, and settings are stored in `localStorage` under `weeklyHoursTracker:v1`. ID-card images are stored in IndexedDB under `weeklyHoursTrackerImages:v1` because photos are too large for localStorage.

Data is stored only in the browser on this device.

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
