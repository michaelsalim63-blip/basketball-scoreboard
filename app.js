'use strict';
(() => {
  const KEY = 'basketball-scoreboard-v3';
  const $ = id => document.getElementById(id);
  const integer = (value, fallback, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  const fresh = () => ({ homeName: 'HOME', awayName: 'AWAY', homeScore: 0, awayScore: 0, homeFouls: 0, awayFouls: 0, quarterMinutes: 10, overtimeMinutes: 5, period: 1, gameMs: 600000, shotMs: 24000, shotEnabled: false, shotOpen: false, soundEnabled: true, running: false, savedAt: Date.now() });
  let state = fresh();
  let storageOK = true;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') {
      for (const team of ['home', 'away']) {
        state[team + 'Name'] = typeof saved[team + 'Name'] === 'string' ? saved[team + 'Name'].slice(0, 32) : state[team + 'Name'];
        state[team + 'Score'] = integer(saved[team + 'Score'], 0, 0, 999);
        state[team + 'Fouls'] = integer(saved[team + 'Fouls'], 0, 0, 99);
      }
      state.quarterMinutes = integer(saved.quarterMinutes, 10, 1, 60);
      state.overtimeMinutes = integer(saved.overtimeMinutes, 5, 1, 60);
      state.period = integer(saved.period, 1, 1, 103);
      state.gameMs = integer(saved.gameMs, duration(), 0, 3600000);
      state.shotMs = integer(saved.shotMs, 24000, 0, 24000);
      for (const key of ['shotEnabled', 'shotOpen', 'soundEnabled']) state[key] = typeof saved[key] === 'boolean' ? saved[key] : state[key];
      if (saved.running === true && Number.isFinite(saved.savedAt)) {
        const elapsed = Math.max(0, Date.now() - saved.savedAt);
        const consumed = Math.min(elapsed, state.gameMs, state.shotEnabled ? state.shotMs : Infinity);
        state.gameMs -= consumed;
        if (state.shotEnabled) state.shotMs -= consumed;
      }
    }
  } catch { storageOK = false; }
  let lastTick = Date.now();
  let lastSave = 0;
  let audioContext;
  function duration() { return (state.period <= 4 ? state.quarterMinutes : state.overtimeMinutes) * 60000; }
  function notice(message) { $('notice').textContent = message; }
  function save() {
    state.savedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch { storageOK = false; notice('Autosave unavailable. Keep this page open to retain the game.'); }
    lastSave = state.savedAt;
  }
  function unlockAudio() {
    if (!state.soundEnabled) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); } catch { /* Sound is optional. */ }
  }
  function buzzer() {
    if (!state.soundEnabled || !audioContext) return;
    try {
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'square'; oscillator.frequency.value = 220;
      volume.gain.setValueAtTime(0.12, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
      oscillator.connect(volume); volume.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + 0.8);
    } catch { /* The visible expiry message remains available. */ }
  }
  function tick() {
    const now = Date.now();
    const elapsed = Math.max(0, now - lastTick);
    lastTick = now;
    if (!state.running) return;
    const consumed = Math.min(elapsed, state.gameMs, state.shotEnabled ? state.shotMs : Infinity);
    state.gameMs = Math.max(0, state.gameMs - consumed);
    if (state.shotEnabled) state.shotMs = Math.max(0, state.shotMs - consumed);
    if (state.gameMs === 0 || (state.shotEnabled && state.shotMs === 0)) {
      state.running = false;
      notice(state.gameMs === 0 ? 'End of period' : 'Shot clock expired');
      buzzer(); save();
    } else if (now - lastSave >= 1000) save();
    render();
  }
  function render() {
    for (const team of ['home', 'away']) {
      $(team + 'Score').textContent = state[team + 'Score'];
      $(team + 'Fouls').textContent = state[team + 'Fouls'];
    }
    const seconds = Math.ceil(state.gameMs / 1000);
    $('clock').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    $('clock').classList.toggle('expired', state.gameMs === 0);
    $('shotClock').textContent = Math.ceil(state.shotMs / 1000);
    $('period').textContent = state.period <= 4 ? 'QUARTER ' + state.period : 'OVERTIME ' + (state.period - 4);
    $('toggle').textContent = state.running ? 'Pause' : 'Start';
    $('toggle').setAttribute('aria-pressed', String(state.running));
    $('prevPeriod').disabled = state.period === 1;
    $('nextPeriod').disabled = state.period === 103;
  }
  function change(action) { tick(); action(); render(); save(); }
  for (const team of ['home', 'away']) {
    $(team + 'Name').value = state[team + 'Name'];
    $(team + 'Name').addEventListener('input', event => change(() => { state[team + 'Name'] = event.target.value; }));
    $(team + 'Name').addEventListener('blur', () => {
      if (!$(team + 'Name').value.trim()) change(() => { state[team + 'Name'] = team.toUpperCase(); $(team + 'Name').value = state[team + 'Name']; });
    });
  }
  document.querySelectorAll('[data-score]').forEach(button => button.addEventListener('click', () => change(() => {
    const [team, delta] = button.dataset.score.split(',');
    state[team + 'Score'] = Math.max(0, Math.min(999, state[team + 'Score'] + Number(delta)));
  })));
  document.querySelectorAll('[data-foul]').forEach(button => button.addEventListener('click', () => change(() => {
    const [team, delta] = button.dataset.foul.split(',');
    state[team + 'Fouls'] = Math.max(0, Math.min(99, state[team + 'Fouls'] + Number(delta)));
  })));
  $('toggle').addEventListener('click', () => {
    unlockAudio();
    change(() => {
      if (!state.running && (state.gameMs === 0 || (state.shotEnabled && state.shotMs === 0))) { notice('Reset the expired clock before starting.'); return; }
      state.running = !state.running; lastTick = Date.now(); notice('');
    });
  });
  $('resetClock').addEventListener('click', () => change(() => {
    state.running = false; state.gameMs = duration(); state.shotMs = 24000; notice('Clocks reset');
  }));
  function setPeriod(delta) {
    change(() => {
      state.period = Math.max(1, Math.min(103, state.period + delta));
      state.running = false; state.gameMs = duration(); state.shotMs = 24000;
      state.homeFouls = 0; state.awayFouls = 0; notice('New period · clocks and fouls reset');
    });
  }
  $('prevPeriod').addEventListener('click', () => setPeriod(-1));
  $('nextPeriod').addEventListener('click', () => setPeriod(1));
  $('quarterMinutes').value = state.quarterMinutes;
  $('overtimeMinutes').value = state.overtimeMinutes;
  $('applyDuration').addEventListener('click', () => {
    const quarter = Number($('quarterMinutes').value), overtime = Number($('overtimeMinutes').value);
    if (![quarter, overtime].every(value => Number.isInteger(value) && value >= 1 && value <= 60)) { notice('Enter whole minutes from 1 to 60.'); return; }
    change(() => {
      state.quarterMinutes = quarter; state.overtimeMinutes = overtime; state.running = false;
      state.gameMs = duration(); state.shotMs = 24000; notice('Durations applied · clocks reset');
    });
  });
  $('shotEnabled').checked = state.shotEnabled;
  $('shotEnabled').addEventListener('change', event => change(() => {
    state.shotEnabled = event.target.checked;
    if (state.shotEnabled && state.shotMs === 0) state.shotMs = 24000;
  }));
  $('shotPanel').open = state.shotOpen;
  $('shotPanel').addEventListener('toggle', () => change(() => { state.shotOpen = $('shotPanel').open; }));
  document.querySelectorAll('[data-shot]').forEach(button => button.addEventListener('click', () => change(() => { state.shotMs = Number(button.dataset.shot) * 1000; notice('Shot clock reset'); })));
  $('soundEnabled').checked = state.soundEnabled;
  $('soundEnabled').addEventListener('change', event => change(() => { state.soundEnabled = event.target.checked; unlockAudio(); }));
  $('newGame').addEventListener('click', () => {
    tick();
    if (!window.confirm('Start a new game? Scores, fouls and periods will be cleared.')) return;
    change(() => {
      state.homeScore = state.awayScore = state.homeFouls = state.awayFouls = 0;
      state.period = 1; state.running = false; state.gameMs = duration(); state.shotMs = 24000;
      notice('New game ready');
    });
  });
  document.addEventListener('visibilitychange', () => { tick(); save(); });
  window.addEventListener('pagehide', () => { tick(); save(); });
  render();
  if (!storageOK) notice('Saved game unavailable. A fresh game is ready.');
  save();
  window.setInterval(tick, 100);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => notice('Offline setup failed. Reconnect and reload to try again.'));
  }
})();
