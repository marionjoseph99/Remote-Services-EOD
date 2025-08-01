let selectedDate = new Date().toISOString().split('T')[0];
const datePickerEl = document.getElementById('date-picker');

// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsWm4xczbTsovHHq-pTNYu3XAkqXUBQQA",
  authDomain: "eod-login.firebaseapp.com",
  projectId: "eod-login"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
const getUserKey = () => currentUser ? `dailyReports_${currentUser.uid}` : 'dailyReports';

let reports = [];
let highlights = '';
let modalCallback = null;
let historyStack = [];
let redoStack = [];
const MAX_HISTORY_DEPTH = 10;

const currentDateEl = document.getElementById('current-date');
const todayPerformanceEl = document.getElementById('today-performance-cards');
const overallPerformanceEl = document.getElementById('overall-performance-cards');
const newTaskActivityEl = document.getElementById('new-task-activity');
const newTaskStatusEl = document.getElementById('new-task-status');
const addTaskButton = document.getElementById('add-task-button');
const highlightsTextarea = document.getElementById('highlights-textarea');
const reportsContainerEl = document.getElementById('reports-container');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const confirmationModal = document.getElementById('confirmation-modal');
const modalMessageEl = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

const loadFromLocalStorage = () => {
  const stored = localStorage.getItem(getUserKey());
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const map = new Map();
      for (const report of parsed) {
        map.set(report.date, report);
      }
      reports = Array.from(map.values());
    } catch (e) {
      console.error("Failed to parse local storage data:", e);
      reports = [];
    }
  }

  const todayReport = reports.find(r => r.date === selectedDate);
  highlights = todayReport?.highlights || '';
  highlightsTextarea.value = highlights;
  reports.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const saveToLocalStorage = () => {
  localStorage.setItem(getUserKey(), JSON.stringify(reports));
};

const pushToHistory = () => {
  const snapshot = { reports: JSON.parse(JSON.stringify(reports)) };
  if (historyStack.length > 0 &&
      JSON.stringify(historyStack[historyStack.length - 1]) === JSON.stringify(snapshot)) return;

  historyStack.push(snapshot);
  if (historyStack.length > MAX_HISTORY_DEPTH) historyStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
};

const handleUndo = () => {
  if (historyStack.length === 0) return;
  redoStack.push({ reports: JSON.parse(JSON.stringify(reports)) });
  reports = historyStack.pop().reports;
  saveToLocalStorage();
  renderApp();
  updateUndoRedoButtons();
};

const handleRedo = () => {
  if (redoStack.length === 0) return;
  historyStack.push({ reports: JSON.parse(JSON.stringify(reports)) });
  reports = redoStack.pop().reports;
  saveToLocalStorage();
  renderApp();
  updateUndoRedoButtons();
};

const updateUndoRedoButtons = () => {
  undoButton.disabled = historyStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
};

const showConfirmationModal = (message, callback) => {
  modalMessageEl.textContent = message;
  modalCallback = callback;
  confirmationModal.classList.remove('hidden');
};

const hideConfirmationModal = () => {
  confirmationModal.classList.add('hidden');
  modalCallback = null;
};

const renderApp = () => {
  renderReports();
  renderPerformanceCards();
};

const renderReports = () => {
  reportsContainerEl.innerHTML = '';

  const selectedReport = reports.find(r => r.date === selectedDate);
  if (!selectedReport) {
    reportsContainerEl.innerHTML = `<p class="text-gray-500 text-center">No report found for ${selectedDate}.</p>`;
    return;
  }

  const tasksHTML = selectedReport.tasks.map((task, i) => `
    <tr data-report-id="${selectedReport.id}" data-task-index="${i}" class="border-t">
      <td class="px-6 py-3 truncate">${task.activity}</td>
      <td class="px-6 py-3">
        <div class="flex items-center">
          <select class="status-select p-1 rounded-md ${getStatusColorClass(task.status)}">
            ${["Not Yet Started", "Work in Progress", "Pending Approval", "Done"].map(status =>
              `<option value="${status}" ${status === task.status ? 'selected' : ''}>${status}</option>`
            ).join('')}
          </select>
          <button class="delete-task-btn ml-2 text-red-400 hover:text-red-600" data-task-index="${i}">✕</button>
        </div>
      </td>
    </tr>
  `).join('');

  const highlightsHTML = selectedReport.highlights
    ? `<p class="mb-4"><strong>Highlights:</strong> ${selectedReport.highlights}</p>`
    : '';

  reportsContainerEl.innerHTML = `
    <div class="bg-gray-50 p-6 rounded-lg shadow-md">
      <div class="flex justify-between mb-4">
        <h4 class="font-bold">${selectedReport.date}</h4>
        <button class="delete-report-btn text-red-500" data-report-id="${selectedReport.id}">Delete Report</button>
      </div>
      ${highlightsHTML}
      <table class="min-w-full table-fixed">
        <colgroup>
          <col class="w-3/4" />
          <col class="w-1/4" />
        </colgroup>
        <thead class="text-left border-b">
          <tr><th class="px-6 py-3 font-semibold">Activity</th><th class="px-6 py-3 font-semibold">Status</th></tr>
        </thead>
        <tbody>${tasksHTML}</tbody>
      </table>
    </div>
  `;
};

const renderPerformanceCards = () => {
  const todayReport = reports.find(r => r.date === selectedDate);
  const todayStats = { Done: 0, "Work in Progress": 0, "Pending Approval": 0, "Not Yet Started": 0 };
  const allStats = { ...todayStats };

  if (todayReport) {
    todayReport.tasks.forEach(t => todayStats[t.status]++);
  }

  reports.flatMap(r => r.tasks).forEach(t => allStats[t.status]++);

  todayPerformanceEl.innerHTML = Object.entries(todayStats).map(([status, count]) =>
    createCard(`${status} Today`, count, getStatusColorClass(status))
  ).join('');

  overallPerformanceEl.innerHTML = Object.entries(allStats).map(([status, count]) =>
    createCard(`Total ${status}`, count, getStatusColorClass(status))
  ).join('');
};

const createCard = (title, value, colorClass) => `
  <div class="summary-card p-4 rounded-lg shadow-sm ${colorClass}">
    <p class="text-sm font-semibold">${title}</p>
    <p class="text-3xl font-bold mt-2">${value}</p>
  </div>
`;

const getStatusColorClass = (status) => {
  switch (status) {
    case 'Done': return 'bg-green-100 text-green-800';
    case 'Pending Approval': return 'bg-orange-100 text-orange-800';
    case 'Work in Progress': return 'bg-yellow-100 text-yellow-800';
    case 'Not Yet Started': return 'bg-blue-100 text-blue-800';
    default: return '';
  }
};

const addTask = (activity, status) => {
  if (!activity) return;
  pushToHistory();
  let report = reports.find(r => r.date === selectedDate);
  if (!report) {
    report = { id: `report-${Date.now()}`, date: selectedDate, highlights: '', tasks: [] };
    reports.unshift(report);
  }
  report.tasks.push({ activity, status });
  saveToLocalStorage();
  renderApp();
  newTaskActivityEl.value = '';
  newTaskStatusEl.value = 'Not Yet Started';
};

const updateTaskStatus = (reportId, index, status) => {
  pushToHistory();
  const report = reports.find(r => r.id === reportId);
  if (report?.tasks[index]) {
    report.tasks[index].status = status;
    saveToLocalStorage();
    renderApp();
  }
};

const deleteTask = (reportId, index) => {
  pushToHistory();
  const report = reports.find(r => r.id === reportId);
  if (report) {
    report.tasks.splice(index, 1);
    saveToLocalStorage();
    renderApp();
  }
};

const deleteReport = (reportId) => {
  pushToHistory();
  reports = reports.filter(r => r.id !== reportId);
  saveToLocalStorage();
  renderApp();
};

const updateHighlights = (text) => {
  pushToHistory();
  const report = reports.find(r => r.date === selectedDate);
  if (report) {
    report.highlights = text;
  } else if (text.trim()) {
    reports.unshift({ id: `report-${Date.now()}`, date: selectedDate, tasks: [], highlights: text });
  }
  saveToLocalStorage();
};

datePickerEl.addEventListener('change', (e) => {
  selectedDate = e.target.value;
  loadFromLocalStorage();
  renderApp();
});

const setupEventListeners = () => {
  addTaskButton.addEventListener('click', () => {
    const activity = newTaskActivityEl.value.trim();
    const status = newTaskStatusEl.value;
    if (!activity) return showConfirmationModal("Activity can't be empty.", hideConfirmationModal);
    addTask(activity, status);
  });

  reportsContainerEl.addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
      const row = e.target.closest('tr');
      updateTaskStatus(row.dataset.reportId, parseInt(row.dataset.taskIndex), e.target.value);
    }
  });

  reportsContainerEl.addEventListener('click', (e) => {
    const deleteReportBtn = e.target.closest('.delete-report-btn');
    const deleteTaskBtn = e.target.closest('.delete-task-btn');

    if (deleteReportBtn) {
      const id = deleteReportBtn.dataset.reportId;
      showConfirmationModal("Delete this report?", () => { deleteReport(id); hideConfirmationModal(); });
    }

    if (deleteTaskBtn) {
      const row = deleteTaskBtn.closest('tr');
      const id = row.dataset.reportId;
      const index = parseInt(deleteTaskBtn.dataset.taskIndex);
      showConfirmationModal("Delete this task?", () => { deleteTask(id, index); hideConfirmationModal(); });
    }
  });

  let debounceTimer;
  highlightsTextarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateHighlights(highlightsTextarea.value), 400);
  });

  undoButton.addEventListener('click', handleUndo);
  redoButton.addEventListener('click', handleRedo);
  modalConfirmBtn.addEventListener('click', () => modalCallback?.());
  modalCancelBtn.addEventListener('click', hideConfirmationModal);

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'auth.html';
    });
  });
};

const initializeAppLogic = () => {
  datePickerEl.value = selectedDate;
  setupEventListeners();
  loadFromLocalStorage();
  loadProfile(currentUser.uid);
  renderApp();
  pushToHistory();
};

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "auth.html";
  } else {
    currentUser = user;
    initializeAppLogic();
  }
});

const profileNameEl = document.getElementById('profile-name');
const profileClientEl = document.getElementById('profile-client');
const profilePositionEl = document.getElementById('profile-position');

const loadProfile = (uid) => {
  const data = JSON.parse(localStorage.getItem(`profile-${uid}`)) || {};
  profileNameEl.textContent = data.name || '—';
  profileClientEl.textContent = data.client || '—';
  profilePositionEl.textContent = data.position || '—';
};
