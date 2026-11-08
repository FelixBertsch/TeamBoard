/* Settings. Change a value, commit, reload. */
const CFG = {
  // File in the private data repository. Repository and branch are chosen per device during setup.
  githubPath: 'teamboard-data.enc.json',

  // How often to look for changes from other devices, in seconds (minimum 10).
  syncIntervalSeconds: 30,
  // Wait after the last change before committing, in milliseconds.
  saveDelayMs: 1500,

  // Optional backup folder (desktop Chrome/Edge only): plain copy of the data plus daily backups.
  backupFileName: 'teamboard-daten.json',
  backupFolder: 'Backups',
  backupKeepDays: 30, // 0 = keep forever

  // Days after its end that a "Krank" absence still shows as such; then it becomes "Abwesend" (no sick-day history).
  sickVisibleDays: 7,

  // Extra days off on top of the legal holidays of the chosen state (src/core/holidays.js): 'MM-DD' every year, 'YYYY-MM-DD' once.
  // Example: { '12-24': 'Heiligabend', '12-31': 'Silvester' }. Leave empty for the legal holidays only.
  extraHolidays: {},

  defaultView: 'week', // 'week', 'two' or 'six'
  undoSteps: 40,
};
