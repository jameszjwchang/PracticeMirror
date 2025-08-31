let mediaRecorder;
let audioChunks = [];
let currentAudioUrl = null;
const audioPlayer = new Audio();
let state = 'idle'; // idle, recording, stopped, playing

const mainButton = document.getElementById('mainButton');
const saveButton = document.getElementById('saveButton');
const folderSelect = document.getElementById('folderSelect');
const newFolderName = document.getElementById('newFolderName');
const addFolderBtn = document.getElementById('addFolder');
const recordingsList = document.getElementById('recordingsList');
const sortByNameBtn = document.getElementById('sortByName');
const sortByDateBtn = document.getElementById('sortByDate');

let data = loadData();
renderFolders();
renderRecordings();

mainButton.addEventListener('click', () => {
  if (state === 'idle') {
    startRecording();
  } else if (state === 'recording') {
    stopRecording();
  } else if (state === 'stopped') {
    playAudio();
  } else if (state === 'playing') {
    stopPlaying();
  }
});

saveButton.addEventListener('click', saveCurrentRecording);

addFolderBtn.addEventListener('click', () => {
  const name = newFolderName.value.trim();
  if (!name) return;
  data.folders.push({ name, recordings: [] });
  data.currentFolder = data.folders.length - 1;
  newFolderName.value = '';
  saveData();
  renderFolders();
  renderRecordings();
});

folderSelect.addEventListener('change', () => {
  data.currentFolder = parseInt(folderSelect.value, 10);
  saveData();
  renderRecordings();
});

sortByNameBtn.addEventListener('click', () => {
  const folder = data.folders[data.currentFolder];
  folder.recordings.sort((a, b) => a.name.localeCompare(b.name));
  saveData();
  renderRecordings();
});

sortByDateBtn.addEventListener('click', () => {
  const folder = data.folders[data.currentFolder];
  folder.recordings.sort((a, b) => a.date - b.date);
  saveData();
  renderRecordings();
});

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    currentAudioUrl = URL.createObjectURL(blob);
    audioPlayer.src = currentAudioUrl;
    saveButton.classList.remove('hidden');
  };
  mainButton.textContent = 'STOP';
  state = 'recording';
  saveButton.classList.add('hidden');
}

function stopRecording() {
  mediaRecorder.stop();
  mainButton.textContent = 'PLAY';
  state = 'stopped';
  saveButton.classList.remove('hidden');
}

function playAudio() {
  audioPlayer.play();
  mainButton.textContent = 'STOP';
  state = 'playing';
  saveButton.classList.remove('hidden');
  audioPlayer.onended = () => {
    mainButton.textContent = 'PLAY';
    state = 'stopped';
  };
}

function stopPlaying() {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  mainButton.textContent = 'PLAY';
  state = 'stopped';
  saveButton.classList.remove('hidden');
}

function saveCurrentRecording() {
  if (!currentAudioUrl) return;
  const name = prompt('Recording name:', `Recording ${new Date().toLocaleString()}`) || 'Untitled';
  fetch(currentAudioUrl)
    .then(r => r.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const folder = data.folders[data.currentFolder];
        folder.recordings.push({ name, date: Date.now(), dataUrl });
        saveData();
        renderRecordings();
        saveButton.classList.add('hidden');
        mainButton.textContent = 'RECORD';
        state = 'idle';
        currentAudioUrl = null;
      };
      reader.readAsDataURL(blob);
    });
}

function renderFolders() {
  folderSelect.innerHTML = '';
  data.folders.forEach((folder, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = folder.name;
    if (idx === data.currentFolder) opt.selected = true;
    folderSelect.appendChild(opt);
  });
}

function renderRecordings() {
  recordingsList.innerHTML = '';
  const folder = data.folders[data.currentFolder];
  folder.recordings.forEach((rec, idx) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = rec.name;
    li.appendChild(nameSpan);

    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = rec.dataUrl;
    li.appendChild(audioEl);

    const actions = document.createElement('span');
    actions.className = 'recording-actions';

    const renameBtn = document.createElement('button');
    renameBtn.textContent = 'Rename';
    renameBtn.onclick = () => {
      const newName = prompt('New name', rec.name);
      if (newName) {
        rec.name = newName;
        saveData();
        renderRecordings();
      }
    };
    actions.appendChild(renameBtn);

    const upBtn = document.createElement('button');
    upBtn.textContent = '↑';
    upBtn.onclick = () => {
      if (idx > 0) {
        const arr = folder.recordings;
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        saveData();
        renderRecordings();
      }
    };
    actions.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.textContent = '↓';
    downBtn.onclick = () => {
      const arr = folder.recordings;
      if (idx < arr.length - 1) {
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        saveData();
        renderRecordings();
      }
    };
    actions.appendChild(downBtn);

    li.appendChild(actions);
    recordingsList.appendChild(li);
  });
}

function loadData() {
  const raw = localStorage.getItem('practiceMirrorData');
  if (raw) return JSON.parse(raw);
  return { folders: [{ name: 'Default', recordings: [] }], currentFolder: 0 };
}

function saveData() {
  localStorage.setItem('practiceMirrorData', JSON.stringify(data));
}
