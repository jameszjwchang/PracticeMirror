let mediaRecorder;
let recordedChunks = [];
let currentBlob = null;
let audio = new Audio();
let state = 'idle'; // idle, recording, stopped, playing

const recordButton = document.getElementById('recordButton');
const saveButton = document.getElementById('saveButton');
const folderList = document.getElementById('folderList');
const newFolderName = document.getElementById('newFolderName');
const addFolder = document.getElementById('addFolder');

let data = loadData();
renderFolders();

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
  state = 'stopped';
  recordButton.textContent = 'Play';
});

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  recordedChunks = [];
  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    currentBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    saveButton.classList.remove('hidden');
  };
  mediaRecorder.start();
  state = 'recording';
  recordButton.textContent = 'Stop';
  saveButton.classList.add('hidden');
}

function stopRecording() {
  mediaRecorder.stop();
  state = 'stopped';
  recordButton.textContent = 'Play';
  saveButton.classList.remove('hidden');
}

function playRecording() {
  if (!currentBlob) return;
  audio.src = URL.createObjectURL(currentBlob);
  audio.play();
  state = 'playing';
  recordButton.textContent = 'Stop';
  saveButton.classList.remove('hidden');
}

function stopPlayback() {
  audio.pause();
  audio.currentTime = 0;
  state = 'stopped';
  recordButton.textContent = 'Play';
}

async function saveRecording() {
  if (!currentBlob) return;
  const name = prompt('Recording name?', 'My Recording');
  if (!name) return;
  let folder = prompt('Folder name?', 'Default');
  if (!folder) folder = 'Default';
  if (!data.folders[folder]) data.folders[folder] = [];
  const id = Date.now().toString();
  const base64 = await blobToBase64(currentBlob);
  data.folders[folder].push({ id, name, data: base64, date: new Date().toISOString() });
  saveData();
  renderFolders();
  resetState();
}

function resetState() {
  state = 'idle';
  recordButton.textContent = 'Record';
  saveButton.classList.add('hidden');
  currentBlob = null;
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
  return { folders: { Default: [] } };
}

function saveData() {
  localStorage.setItem('practiceMirror', JSON.stringify(data));
}

function renderFolders() {
  folderList.innerHTML = '';
  Object.keys(data.folders).forEach(folderName => {
    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';
    const header = document.createElement('h3');
    header.textContent = folderName;
    folderDiv.appendChild(header);

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
      renderFolders();
    });
    folderDiv.appendChild(sortSelect);

    const list = document.createElement('ul');
    data.folders[folderName].forEach((rec, index) => {
      const li = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = rec.name;
      li.appendChild(title);

      const playBtn = document.createElement('button');
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        audio.src = rec.data;
        audio.play();
      });
      li.appendChild(playBtn);

      const renameBtn = document.createElement('button');
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', () => {
        const newName = prompt('New name', rec.name);
        if (newName) {
          rec.name = newName;
          saveData();
          renderFolders();
        }
      });
      li.appendChild(renameBtn);

      const upBtn = document.createElement('button');
      upBtn.textContent = '↑';
      upBtn.addEventListener('click', () => {
        const arr = data.folders[folderName];
        if (index > 0) {
          [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
          saveData();
          renderFolders();
        }
      });
      li.appendChild(upBtn);

      const downBtn = document.createElement('button');
      downBtn.textContent = '↓';
      downBtn.addEventListener('click', () => {
        const arr = data.folders[folderName];
        if (index < arr.length - 1) {
          [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
          saveData();
          renderFolders();
        }
      });
      li.appendChild(downBtn);

      list.appendChild(li);
    });
    folderDiv.appendChild(list);
    folderList.appendChild(folderDiv);
  });
}
