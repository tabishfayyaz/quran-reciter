'use strict';

// One reusable HTMLAudioElement improves iPhone background playback compatibility.
// iOS/browser policies can still prevent advancing between files while locked.
const audio = document.querySelector('#audio');
const el = (selector) => document.querySelector(selector);
const list = el('#surah-list');
const search = el('#search');
const seek = el('#seek');
const playButton = el('#play');
const shuffleButton = el('#shuffle');
const repeatButton = el('#repeat');

let tracks = [];
let currentIndex = -1;
let mode = 'repeat'; // 'sequential' | 'shuffle' | 'repeat'
let playRequestId = 0;
let seeking = false;
audio.loop = true;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const n = Math.floor(seconds);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = String(n % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};
const currentTrack = () => tracks[currentIndex] || null;
const showMessage = (message = '') => { el('#status').textContent = message; };
function updatePlayButton(isPlaying = !audio.paused) {
  playButton.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  playButton.setAttribute('title', isPlaying ? 'Pause' : 'Play');
  playButton.setAttribute('aria-pressed', String(isPlaying));
  playButton.innerHTML = isPlaying
    ? '<svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/></svg>'
    : '<svg class="play-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5z"/></svg>';
}
function updateSeekProgress() {
  const duration = audio.duration;
  const played = Number.isFinite(duration) && duration > 0
    ? Math.min(100, seeking ? Number(seek.value) / 10 : audio.currentTime / duration * 100) : 0;
  let buffered = 0;
  if (Number.isFinite(duration) && duration > 0) {
    for (let i = 0; i < audio.buffered.length; i++) {
      buffered = Math.max(buffered, audio.buffered.end(i) / duration * 100);
    }
  }
  seek.style.setProperty('--progress', `${played}%`);
  seek.style.setProperty('--buffered-progress', `${Math.min(100, buffered)}%`);
}

function renderList() {
  const query = search.value.trim().toLowerCase();
  const filtered = tracks.filter(track =>
    String(track.number).includes(query) || track.name.toLowerCase().includes(query) || track.arabic.includes(query)
  );
  if (!filtered.length) {
    list.innerHTML = `<p class="empty">${tracks.length ? 'No Surahs match your search.' : 'No recordings found. Add MP3 files to audio/ and regenerate audio-files.json.'}</p>`;
    return;
  }
  list.innerHTML = filtered.map(track => {
    const active = currentTrack()?.number === track.number;
    const playing = active && !audio.paused;
    return `<button type="button" class="surah-row${active ? ' active' : ''}" data-number="${track.number}" aria-label="${playing ? 'Pause' : 'Play'} ${escapeHtml(track.name)}" ${active ? 'aria-current="true"' : ''}>
      <span class="surah-index">${String(track.number).padStart(3, '0')}</span>
      <span class="surah-name"><strong>${escapeHtml(track.name)}</strong><span class="arabic-name" lang="ar" dir="rtl">${escapeHtml(track.arabic)}</span></span>
      <span class="row-play" aria-hidden="true">
        ${playing ? '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5a1 1 0 0 1 1.5-.86l10 7a1 1 0 0 1 0 1.72l-10 7A1 1 0 0 1 8 19z"/></svg>'}
      </span>
    </button>`;
  }).join('');
  list.querySelectorAll('.surah-row[data-number]').forEach(row => {
    row.addEventListener('click', () => {
      const index = tracks.findIndex(track => track.number === Number(row.dataset.number));
      if (search.value) {
        search.value = '';
        renderList();
      }
      if (index === currentIndex) {
        if (audio.paused) void safelyPlay(); else audio.pause();
      } else chooseTrack(index);
    });
  });
}

function syncPlayer() {
  const track = currentTrack();
  el('#now-number').textContent = track ? `SURAH ${String(track.number).padStart(3, '0')}` : 'NO SURAH SELECTED';
  el('#now-title').textContent = track?.name || 'Choose a recitation';
  el('#now-subtitle').textContent = track ? track.arabic : 'Select a Surah from the list below';
  el('#now-subtitle').lang = track ? 'ar' : 'en';
  el('#now-subtitle').dir = track ? 'rtl' : 'ltr';
  const enabled = Boolean(track);
  playButton.disabled = !enabled;
  el('#back').disabled = !enabled || !Number.isFinite(audio.duration);
  el('#forward').disabled = !enabled || !Number.isFinite(audio.duration);
  seek.disabled = !enabled || !Number.isFinite(audio.duration) || audio.duration <= 0;
  updatePlayButton();
  el('#current-time').textContent = formatTime(audio.currentTime);
  el('#duration').textContent = formatTime(audio.duration);
  if (!seeking) {
    seek.value = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
  }
  updateSeekProgress();
  renderList();
  updateMediaPosition();
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const track = currentTrack();
  if (!track) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${track.number}. ${track.name} — ${track.arabic}`,
      artist: 'Quran Recitation',
      album: 'Quran Reciter'
    });
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  } catch (error) { console.debug('Media Session metadata unavailable:', error); }
}

function updateMediaPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: Math.min(audio.currentTime, audio.duration)
    });
  } catch (_) { /* Some iOS versions do not support position updates. */ }
}

async function safelyPlay() {
  const request = ++playRequestId;
  try {
    await audio.play();
    if (request === playRequestId) showMessage('');
  } catch (error) {
    if (request !== playRequestId) return;
    // Browsers can reject play() if activation has expired or a background track switch is blocked.
    if (error.name !== 'AbortError') {
      console.warn('Playback did not start:', error);
      const track = currentTrack();
      showMessage(error.name === 'NotAllowedError'
        ? 'Playback was blocked by the browser. Tap Play again.'
        : `Could not start Surah ${track?.number}. Check audio/${String(track?.number || '').padStart(3, '0')}.mp3.`);
    }
  }
  syncPlayer();
  updateMediaSession();
}

function chooseTrack(index) {
  if (index < 0 || index >= tracks.length) return;
  seeking = false;
  currentIndex = index;
  const track = tracks[index];
  audio.src = `./audio/${String(track.number).padStart(3, '0')}.mp3`;
  audio.load();
  syncPlayer();
  updateMediaSession();
  void safelyPlay();
}

function nextIndex() {
  if (!tracks.length) return -1;
  if (mode === 'repeat') return currentIndex;
  if (mode === 'shuffle') {
    if (currentIndex < 0) return Math.floor(Math.random() * tracks.length);
    if (tracks.length === 1) return 0;
    // Uniform selection excluding the currently playing Surah.
    const r = Math.floor(Math.random() * (tracks.length - 1));
    return r >= currentIndex ? r + 1 : r;
  }
  return (currentIndex + 1) % tracks.length;
}

function nextTrack() {
  const index = nextIndex();
  if (index !== -1) chooseTrack(index);
}

function previousTrack() {
  if (!tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (mode === 'shuffle') { nextTrack(); return; }
  chooseTrack((currentIndex - 1 + tracks.length) % tracks.length);
}

function changeMode(newMode) {
  mode = mode === newMode ? 'sequential' : newMode;
  // Native repeat lets the same MP3 loop without a src change, even on the lock screen.
  audio.loop = mode === 'repeat';
  shuffleButton.setAttribute('aria-pressed', String(mode === 'shuffle'));
  repeatButton.setAttribute('aria-pressed', String(mode === 'repeat'));
  shuffleButton.setAttribute('aria-label', mode === 'shuffle' ? 'Disable shuffle' : 'Enable shuffle');
  repeatButton.setAttribute('aria-label', mode === 'repeat' ? 'Disable repeat Surah' : 'Enable repeat Surah');
  el('#mode-label').textContent = {
    sequential: 'Continuous playback · In order',
    shuffle: 'Shuffle on · Random Surahs continuously',
    repeat: 'Repeat on · Current Surah loops'
  }[mode];
  // Enabling shuffle starts with a random selection immediately.
  if (mode === 'shuffle' && tracks.length) nextTrack();
}

function seekRelative(seconds) {
  if (!currentTrack()) return;
  const next = audio.currentTime + seconds;
  audio.currentTime = Math.max(0, Number.isFinite(audio.duration) ? Math.min(next, audio.duration) : next);
  syncPlayer();
}

function setupMediaControls() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => { if (currentTrack()) void safelyPlay(); },
    pause: () => audio.pause(),
    nexttrack: nextTrack,
    previoustrack: previousTrack,
    seekbackward: () => seekRelative(-5),
    seekforward: () => seekRelative(5),
    seekto: details => { if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime; }
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try { navigator.mediaSession.setActionHandler(action, handler); }
    catch (_) { /* Not all browsers support all actions. */ }
  }
}

search.addEventListener('input', renderList);
playButton.addEventListener('click', () => {
  if (audio.paused) {
    updatePlayButton(true);
    void safelyPlay();
  } else {
    audio.pause();
    updatePlayButton(false);
  }
});
el('#back').addEventListener('click', () => seekRelative(-5));
el('#forward').addEventListener('click', () => seekRelative(5));
shuffleButton.addEventListener('click', () => changeMode('shuffle'));
repeatButton.addEventListener('click', () => changeMode('repeat'));
seek.addEventListener('input', () => {
  seeking = true;
  updateSeekProgress();
});
seek.addEventListener('change', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = audio.duration * (Number(seek.value) / 1000);
  }
  seeking = false;
  updateSeekProgress();
});
audio.addEventListener('timeupdate', () => {
  el('#current-time').textContent = formatTime(audio.currentTime);
  if (!seeking && Number.isFinite(audio.duration) && audio.duration > 0) {
    seek.value = Math.round(audio.currentTime / audio.duration * 1000);
  }
  updateSeekProgress();
  updateMediaPosition();
});
audio.addEventListener('progress', updateSeekProgress);
for (const eventName of ['loadedmetadata','durationchange','play','playing','pause']) {
  audio.addEventListener(eventName, () => { syncPlayer(); updateMediaSession(); });
}
audio.addEventListener('ended', () => {
  if (mode !== 'repeat') nextTrack();
});
audio.addEventListener('error', () => {
  const track = currentTrack();
  if (track) showMessage(`Could not load audio/${String(track.number).padStart(3, '0')}.mp3. Check its filename and file.`);
});

async function initialize() {
  setupMediaControls();
  try {
    const [surahsResponse, availableResponse] = await Promise.all([
      fetch('./surahs.json'), fetch('./audio-files.json')
    ]);
    if (!surahsResponse.ok || !availableResponse.ok) throw new Error('A JSON file could not be loaded.');
    const [surahs, available] = await Promise.all([surahsResponse.json(), availableResponse.json()]);
    if (!Array.isArray(surahs) || surahs.length !== 114 || !surahs.every((s, i) => s.number === i + 1 && typeof s.name === 'string' && typeof s.arabic === 'string') || !Array.isArray(available)) {
      throw new Error('Invalid surahs.json or audio-files.json format.');
    }
    tracks = [...new Set(available)]
      .filter(number => Number.isInteger(number) && number >= 1 && number <= 114)
      .sort((a,b) => a - b)
      .map(number => surahs[number - 1]);
    el('#library-count').textContent = `${tracks.length} ${tracks.length === 1 ? 'recording' : 'recordings'} available`;
    search.disabled = false;
    shuffleButton.disabled = tracks.length === 0;
    repeatButton.disabled = tracks.length === 0;
    renderList();
  } catch (error) {
    console.error('Could not initialize player:', error);
    el('#library-count').textContent = 'Unable to load recordings';
    list.innerHTML = '<p class="empty">Could not load the library. Start a local HTTP server and check the JSON files.</p>';
    showMessage(error.message);
  }
}

void initialize();
