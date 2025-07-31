document.addEventListener('DOMContentLoaded', () => {
  // everything else inside here
});

// --- FIREBASE INITIALIZATION ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAsWm4xczbTsovHHq-pTNYu3XAkqXUBQQA",
  authDomain: "eod-login.firebaseapp.com",
  projectId: "eod-login"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Redirect to auth.html if not signed in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "auth.html";
  }
});

// Logout button logic
document.getElementById('logout-btn')?.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = 'auth.html';
  });
});


// --- GLOBAL VARIABLES ---
let reports = [];
let highlights = '';
let modalCallback = null;
const REPORTS_STORAGE_KEY = 'dailyReports';
let historyStack = [];
let redoStack = [];
const MAX_HISTORY_DEPTH = 10;

// --- ELEMENT REFERENCES ---
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


// --- STORAGE HANDLING ---
const loadFromLocalStorage = () => {
  const stored = localStorage.getItem(REPORTS_STORAGE_KEY);
  if (stored) {
    try {
      reports = JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse local storage data:", e);
      reports = [];
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const todayReport = reports.find(r => r.date === today);
  highlights = todayReport?.highlights || '';
  highlightsTextarea.value = highlights;
  reports.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const saveToLocalStorage = () => {
  localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
};


// --- HISTORY (UNDO / REDO) ---
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


// --- MODAL CONFIRMATION ---
const showConfirmationModal = (message, callback) => {
  modalMessageEl.textContent = message;
  modalCallback = callback;
  confirmationModal.classList.remove('hidden');
};

const hideConfirmationModal = () => {
  confirmationModal.classList.add('hidden');
  modalCallback = null;
};


// --- UI RENDERING ---
const renderApp = () => {
  renderReports();
  renderPerformanceCards();
};

const renderReports = () => {
  reportsContainerEl.innerHTML = '';
  if (reports.length === 0) {
    reportsContainerEl.innerHTML = `<p class="text-gray-500 text-center">No reports found.</p>`;
    return;
  }

  reports.forEach(report => {
    const tasksHTML = report.tasks.map((task, i) => `
      <tr data-report-id="${report.id}" data-task-index="${i}">
        <td class="px-6 py-4">${task.activity}</td>
        <td class="px-6 py-4">
          <select class="status-select p-1 rounded-md ${getStatusColorClass(task.status)}">
            ${["Not Yet Started", "Work in Progress", "Pending Approval", "Done"].map(status =>
              `<option value="${status}" ${status === task.status ? 'selected' : ''}>${status}</option>`
            ).join('')}
          </select>
          <button class="delete-task-btn ml-2 text-red-400 hover:text-red-600" data-task-index="${i}">✕</button>
        </td>
      </tr>
    `).join('');

    const highlightsHTML = report.highlights ? `<p class="mb-4"><strong>Highlights:</strong> ${report.highlights}</p>` : '';

    reportsContainerEl.innerHTML += `
      <div class="bg-gray-50 p-6 rounded-lg shadow-md">
        <div class="flex justify-between mb-4">
          <h4 class="font-bold">${report.date}</h4>
          <button class="delete-report-btn text-red-500" data-report-id="${report.id}">Delete Report</button>
        </div>
        ${highlightsHTML}
        <table class="min-w-full">
          <thead><tr><th>Activity</th><th>Status</th></tr></thead>
          <tbody>${tasksHTML}</tbody>
        </table>
      </div>
    `;
  });
};

const renderPerformanceCards = () => {
  const today = new Date().toISOString().split('T')[0];
  const todayReport = reports.find(r => r.date === today);
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


// --- TASK MANAGEMENT ---
const addTask = (activity, status) => {
  if (!activity) return;
  pushToHistory();
  const today = new Date().toISOString().split('T')[0];
  let report = reports.find(r => r.date === today);
  if (!report) {
    report = { id: `report-${Date.now()}`, date: today, highlights: '', tasks: [] };
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
  const today = new Date().toISOString().split('T')[0];
  const report = reports.find(r => r.date === today);
  if (report) {
    report.highlights = text;
  } else if (text.trim()) {
    reports.unshift({ id: `report-${Date.now()}`, date: today, tasks: [], highlights: text });
  }
  saveToLocalStorage();
};


// --- EVENT LISTENERS ---
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
};


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  currentDateEl.textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  setupEventListeners();
  loadFromLocalStorage();
  renderApp();
  pushToHistory();
});
