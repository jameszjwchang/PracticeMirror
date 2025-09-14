let mediaRecorder;
let recordedChunks = [];
let currentBlob = null;
let micStream = null; // Reuse mic stream to avoid repeated prompts
const audio = document.getElementById('player');
const playerContainer = document.getElementById('playerContainer');
const speedControl = document.getElementById('speedControl');
let state = 'idle'; // idle, recording, stopped, playing

const recordButton = document.getElementById('recordButton');
const saveButton = document.getElementById('saveButton');
const downloadButton = document.getElementById('downloadButton');
const recordingTimer = document.getElementById('recordingTimer');
const folderList = document.getElementById('folderList');
const inboxContainer = document.getElementById('inboxContainer');
const newFolderName = document.getElementById('newFolderName');
const addFolder = document.getElementById('addFolder');

let data = loadData();
renderInbox();
renderFolders();

speedControl.addEventListener('change', () => {
  audio.playbackRate = parseFloat(speedControl.value);
});

recordButton.addEventListener('click', () => {
  switch (state) {
    case 'idle':
      startRecording();
      break;
    case 'recording':
      stopRecording();
      break;
    case 'stopped':
      playRecording();
      break;
    case 'playing':
      stopPlayback();
      break;
  }
});

saveButton.addEventListener('click', saveRecording);
downloadButton.addEventListener('click', downloadCurrentRecording);

addFolder.addEventListener('click', () => {
  const name = newFolderName.value.trim();
  if (!name) return;
  if (!data.folders[name]) {
    data.folders[name] = [];
    saveData();
    renderFolders();
  }
  newFolderName.value = '';
});

audio.addEventListener('ended', () => {
  state = 'idle';
  recordButton.textContent = 'Record';
  audio.currentTime = 0;
});

async function startRecording() {
  playerContainer.classList.add('hidden');
  audio.pause();
  audio.currentTime = 0;
  recordingTimer.classList.remove('hidden');
  startTimer();
  const stream = await getMicStream();
  enableMic(true);
  mediaRecorder = new MediaRecorder(stream);
  recordedChunks = [];
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    currentBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    audio.src = URL.createObjectURL(currentBlob);
    playerContainer.classList.remove('hidden');
    saveButton.classList.remove('hidden');
    downloadButton.classList.remove('hidden');
    enableMic(false);
    stopTimer();
  };
  mediaRecorder.start();
  state = 'recording';
  recordButton.textContent = 'Stop';
  saveButton.classList.add('hidden');
  downloadButton.classList.add('hidden');
}

function stopRecording() {
  mediaRecorder.stop();
  state = 'stopped';
  recordButton.textContent = 'Play';
  saveButton.classList.remove('hidden');
  downloadButton.classList.remove('hidden');
}

function playRecording() {
  if (!currentBlob) return;
  playerContainer.classList.remove('hidden');
  audio.play();
  state = 'playing';
  recordButton.textContent = 'Stop';
  saveButton.classList.remove('hidden');
  downloadButton.classList.remove('hidden');
}

function stopPlayback() {
  audio.pause();
  audio.currentTime = 0;
  state = 'idle';
  recordButton.textContent = 'Record';
}

async function saveRecording() {
  if (!currentBlob) return;
  const now = new Date();
  const name = formatDateTime(now); // Auto-name down to seconds
  const id = Date.now().toString();
  const base64 = await blobToBase64(currentBlob);
  const durationMs = lastRecordingDurationMs || 0;
  data.inbox.push({ id, name, data: base64, date: now.toISOString(), duration: durationMs });
  saveData();
  renderInbox();
  renderFolders();
  resetState();
}

function resetState() {
  state = 'idle';
  recordButton.textContent = 'Record';
  saveButton.classList.add('hidden');
  downloadButton.classList.add('hidden');
  currentBlob = null;
  recordingTimer.classList.add('hidden');
  recordingTimer.textContent = '00:00';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function loadData() {
  const stored = localStorage.getItem('practiceMirror');
  if (stored) return JSON.parse(stored);
  return { inbox: [], folders: { Default: [] } };
}

function saveData() {
  localStorage.setItem('practiceMirror', JSON.stringify(data));
}

function ensureDataShape() {
  if (!data.inbox) data.inbox = [];
  if (!data.folders) data.folders = { Default: [] };
}

function renderInbox() {
  ensureDataShape();
  inboxContainer.innerHTML = '';
  const inboxDiv = document.createElement('div');
  inboxDiv.className = 'folder';

  const header = document.createElement('div');
  header.className = 'folder-header';
  const title = document.createElement('div');
  title.className = 'folder-title';
  const icon = document.createElement('div');
  icon.className = 'icon';
  const titleText = document.createElement('span');
  titleText.textContent = 'Inbox';
  const count = document.createElement('span');
  count.className = 'folder-count';
  count.textContent = `(${data.inbox.length})`;
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = '▾';
  title.appendChild(icon);
  title.appendChild(titleText);
  title.appendChild(count);
  header.appendChild(title);
  header.appendChild(caret);
  inboxDiv.appendChild(header);

  const body = document.createElement('div');
  body.className = 'folder-body';
  const list = document.createElement('ul');
  data.inbox.forEach((rec) => {
    list.appendChild(makeRecordingItem(rec, 'inbox'));
  });
  body.appendChild(list);
  inboxDiv.appendChild(body);

  header.addEventListener('click', () => toggleBody(inboxDiv, body));
  setupDropZone(inboxDiv, { type: 'inbox' });
  inboxContainer.appendChild(inboxDiv);
}

function renderFolders() {
  ensureDataShape();
  folderList.innerHTML = '';
  Object.keys(data.folders).forEach(folderName => {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';

    const header = document.createElement('div');
    header.className = 'folder-header';
    const title = document.createElement('div');
    title.className = 'folder-title';
    const icon = document.createElement('div');
    icon.className = 'icon';
    const titleText = document.createElement('span');
    titleText.textContent = folderName;
    const count = document.createElement('span');
    count.className = 'folder-count';
    count.textContent = `(${data.folders[folderName].length})`;
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▾';
    title.appendChild(icon);
    title.appendChild(titleText);
    title.appendChild(count);
    header.appendChild(title);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hasRecs = (data.folders[folderName] || []).length;
      const msg = hasRecs
        ? `Folder "${folderName}" contains ${hasRecs} recording(s). Delete the folder and all recordings?`
        : `Delete empty folder "${folderName}"?`;
      if (!confirm(msg)) return;
      delete data.folders[folderName];
      saveData();
      renderInbox();
      renderFolders();
    });
    header.appendChild(deleteBtn);
    header.appendChild(caret);
    folderDiv.appendChild(header);

    const body = document.createElement('div');
    body.className = 'folder-body';

    const controlsRow = document.createElement('div');
    const sortSelect = document.createElement('select');
    sortSelect.innerHTML = '<option value="date">Date</option><option value="name">Name</option>';
    sortSelect.addEventListener('change', () => {
      const arr = data.folders[folderName];
      if (sortSelect.value === 'name') {
        arr.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        arr.sort((a, b) => new Date(a.date) - new Date(b.date));
      }
      saveData();
      renderInbox();
      renderFolders();
    });
    controlsRow.appendChild(sortSelect);
    body.appendChild(controlsRow);

    const list = document.createElement('ul');
    data.folders[folderName].forEach((rec, index) => {
      const li = makeRecordingItem(rec, { type: 'folder', name: folderName });
      const actions = li.lastElementChild; // actions container

      const upBtn = document.createElement('button');
      upBtn.textContent = '↑';
      upBtn.addEventListener('click', () => {
        const arr = data.folders[folderName];
        if (index > 0) {
          [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
          saveData();
          renderInbox();
          renderFolders();
        }
      });
      actions.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.textContent = '↓';
      downBtn.addEventListener('click', () => {
        const arr = data.folders[folderName];
        if (index < arr.length - 1) {
          [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
          saveData();
          renderInbox();
          renderFolders();
        }
      });
      actions.appendChild(downBtn);

      list.appendChild(li);
    });
    body.appendChild(list);
    folderDiv.appendChild(body);

    header.addEventListener('click', () => toggleBody(folderDiv, body));
    setupDropZone(folderDiv, { type: 'folder', name: folderName });

    folderList.appendChild(folderDiv);
  });
}

function toggleBody(container, body) {
  const isHidden = body.classList.toggle('hidden-body');
  container.classList.toggle('collapsed', isHidden);
}

function makeRecordingItem(rec, source) {
  const li = document.createElement('li');
  li.setAttribute('draggable', 'true');
  li.addEventListener('dragstart', (e) => {
    const payload = { id: rec.id, from: source };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  });

  const title = document.createElement('span');
  const dur = rec.duration ? ` (${formatDuration(rec.duration)})` : '';
  title.textContent = rec.name + dur;
  li.appendChild(title);

  const actions = document.createElement('div');

  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.addEventListener('click', () => {
    audio.src = rec.data;
    playerContainer.classList.remove('hidden');
    audio.playbackRate = parseFloat(speedControl.value);
    audio.play();
  });
  actions.appendChild(playBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Download';
  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = rec.data;
    const safeName = rec.name.replace(/[^a-z0-9_-]+/gi, '_');
    a.download = `${safeName || 'recording'}.webm`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 0);
  });
  actions.appendChild(downloadBtn);

  const renameBtn = document.createElement('button');
  renameBtn.textContent = 'Rename';
  renameBtn.addEventListener('click', () => {
    const newName = prompt('New name', rec.name);
    if (newName) {
      rec.name = newName;
      saveData();
      renderInbox();
      renderFolders();
    }
  });
  actions.appendChild(renameBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    const arr = (source === 'inbox' || (source && source.type === 'inbox'))
      ? data.inbox
      : data.folders[source.name];
    const idx = arr.findIndex(r => r.id === rec.id);
    if (idx !== -1) {
      arr.splice(idx, 1);
      saveData();
      renderInbox();
      renderFolders();
    }
  });
  actions.appendChild(deleteBtn);

  li.appendChild(actions);
  return li;
}

function setupDropZone(container, target) {
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('droppable');
    e.dataTransfer.dropEffect = 'move';
  });
  container.addEventListener('dragleave', () => {
    container.classList.remove('droppable');
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('droppable');
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const payload = JSON.parse(raw);
    moveRecording(payload.from, target, payload.id);
  });
}

function moveRecording(from, to, id) {
  // Resolve source array
  const sourceArr = from === 'inbox' || (from && from.type === 'inbox')
    ? data.inbox
    : data.folders[from.name];
  const idx = sourceArr.findIndex(r => r.id === id);
  if (idx === -1) return;
  const [rec] = sourceArr.splice(idx, 1);

  // Resolve target array
  const targetArr = to === 'inbox' || (to && to.type === 'inbox')
    ? data.inbox
    : (data.folders[to.name] || (data.folders[to.name] = []));
  targetArr.push(rec);
  saveData();
  renderInbox();
  renderFolders();
}

async function getMicStream() {
  if (micStream) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });
  // Start disabled until recording begins
  enableMic(false);
  return micStream;
}

function enableMic(enabled) {
  if (!micStream) return;
  micStream.getAudioTracks().forEach(t => {
    t.enabled = enabled;
  });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(d) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

// Timer logic
let timerInterval = null;
let recordingStartTime = null;
let lastRecordingDurationMs = 0;

function startTimer() {
  recordingStartTime = performance.now();
  lastRecordingDurationMs = 0;
  updateTimer();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 200);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (recordingStartTime) {
    lastRecordingDurationMs = performance.now() - recordingStartTime;
  }
  updateTimer(true);
  timerInterval = null;
}

function updateTimer(final = false) {
  if (!recordingTimer) return;
  let elapsed;
  if (recordingStartTime) {
    elapsed = (final ? lastRecordingDurationMs : performance.now() - recordingStartTime);
  } else {
    elapsed = 0;
  }
  recordingTimer.textContent = formatDuration(elapsed);
}

function formatDuration(ms) {
  ms = Math.max(0, ms);
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function downloadCurrentRecording() {
  if (!currentBlob) return;
  const a = document.createElement('a');
  const now = new Date();
  const name = 'Recording ' + formatDateTime(now) + '.webm';
  a.href = URL.createObjectURL(currentBlob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// Provide a download button for saved recordings via context actions? Instead, add a button beside Play.
// Modify makeRecordingItem to include download button
