// File: script.js
import { HighlightManager, InquiriesManager } from './highlight.js';

import {
    registerUser,
    updateUserProfile,
    loginUser,
    resetPassword,
    logoutUser,
    setupAuthChangeListener,
    saveUserDetailsToFirestore,
    getAllUserDataFromFirestore,
    addActivity,
    updateActivityStatus,
    deleteActivity,
    setupDailyActivitiesListener,
    setupOngoingTasksListener,
    updateActivityContent,
    db,
    addInquiryNote,
    updateInquiryNote,
    deleteInquiryNote,
    setupInquiryNotesListener
} from './auth.js';
import {
    collection,
    query,
    getDocs,
    where,
    doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authContainer = document.getElementById('auth-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const authTitle = document.getElementById('auth-title');
    const authForm = document.getElementById('auth-form');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const authNameInput = document.getElementById('auth-name');
    const authClientInput = document.getElementById('auth-client');
    const authPositionInput = document.getElementById('auth-position');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const showRegisterLink = document.getElementById('show-register');
    const showForgotPasswordLink = document.getElementById('show-forgot-password');
    const logoutBtn = document.getElementById('logout-btn');

    const userNameSpan = document.getElementById('user-name');
    const userClientSpan = document.getElementById('user-client');
    const userPositionSpan = document.getElementById('user-position');

    const dateDisplay = document.getElementById('date-display');
    const calendarPopup = document.getElementById('calendar-popup');
    const currentMonthYearSpan = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const calendarGrid = document.getElementById('calendar-grid');
    const todayBtn = document.getElementById('today-btn');

    const addActivityModal = document.getElementById('add-activity-modal');
    const activityInput = document.getElementById('activity-input');
    const activityDescriptionInput = document.getElementById('activity-description-input');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const plusButtons = document.querySelectorAll('.metric .plus-btn');

    const overallPerformanceValues = {
        done: document.querySelector('[data-overall="done"]'),
        wip: document.querySelector('[data-overall="wip"]'),
        'not-started': document.querySelector('[data-overall="not-started"]'),
        cancelled: document.querySelector('[data-overall="cancelled"]'),
    };
    const todayPerformanceValues = {
        done: document.getElementById('done-today'),
        wip: document.getElementById('wip-today'),
        'not-started': document.getElementById('not-started-today'),
        cancelled: document.getElementById('cancelled-today'),
    };

    const dailyActivitiesList = document.getElementById('daily-activities');
    const noReportMessage = document.querySelector('.daily-reports .no-report');
    const reportDateSpan = document.getElementById('report-date');

    const ongoingTasksContent = document.querySelector('.ongoing-tasks-content');
    const noOngoingTasksMessage = document.querySelector('.ongoing-tasks-content .no-tasks');

    const notificationContainer = document.getElementById('notification-container');

    // Highlight & Inquiries (cards) Elements
    const highlightsList = document.getElementById('highlights-list');
    const inquiriesList = document.getElementById('inquiries-list');
    const addHighlightBtn = document.getElementById('add-highlight-btn');
    const addInquiryBtn = document.getElementById('add-inquiry-btn');

    // Note Modal Elements
    const noteModal = document.getElementById('note-modal');
    const noteModalTitle = document.getElementById('note-modal-title');
    const noteModalClose = document.getElementById('note-modal-close');
    const noteTextInput = document.getElementById('note-text-input');
    const saveNoteBtn = document.getElementById('save-note-btn');

    // State Variables
    let overallPerformance = {
        done: 0,
        wip: 0,
        'not-started': 0,
        cancelled: 0,
    };
    let selectedDate = new Date();
    let currentCalendarDate = new Date();
    let currentUserId = null;
    let modalStatus;
    let highlightManager;
    let inquiriesManager;
    let unsubscribeInquiryNotes = null;

    // Note modal context
    let currentNoteContext = {
        kind: null,            // 'highlight' | 'inquiry'
        editing: false,
        noteId: null,          // for inquiry edit
        targetCard: null       // for highlight edit (DOM card)
    };

    // Unsubscribe functions for real-time listeners
    let unsubscribeDaily = null;
    let unsubscribeOngoing = null;

    // Data from listeners
    let dailyActivitiesData = [];
    let ongoingTasksData = [];
    // Guard to prevent overlapping calendar renders from duplicating days
    let calendarRenderSeq = 0;

    let authMode = 'login';
    const statusOptions = {
        'not-started': {
            text: 'Not Started',
            class: 'not-started',
            dotColor: 'var(--not-started-dp)'
        },
        'wip': {
            text: 'Work in Progress',
            class: 'wip',
            dotColor: 'var(--wip-dp)'
        },
        'done': {
            text: 'Done',
            class: 'done',
            dotColor: 'var(--done-dp)'
        },
        'cancelled': {
            text: 'Cancelled',
            class: 'cancelled',
            dotColor: 'var(--cancelled-dp)'
        }
    };

    // Helper Functions
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

// ===== Month entry indicators for calendar (completed/ongoing created within the month) =====
const monthEntriesCache = {};
function monthKeyOf(y, m) {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
async function ensureMonthEntries(userId, year, month) {
  if (!userId) return new Set();
  const mkey = monthKeyOf(year, month);
  if (monthEntriesCache[mkey]) return monthEntriesCache[mkey];

  const mm = String(month + 1).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-31`;

  const dates = new Set();

  try {
    // Completed tasks in this month
    const drCol = collection(db, `users/${userId}/dailyReports`);
    const drQ = query(drCol, where('completionDate', '>=', start), where('completionDate', '<=', end));
    const drSnap = await getDocs(drQ);
    drSnap.forEach(d => {
      const dstr = d.data().completionDate;
      if (typeof dstr === 'string' && dstr.startsWith(`${year}-${mm}-`)) dates.add(dstr);
    });

    // Ongoing tasks created in this month
    const ogCol = collection(db, `users/${userId}/ongoingTasks`);
    const ogQ = query(ogCol, where('creationDate', '>=', start), where('creationDate', '<=', end));
    const ogSnap = await getDocs(ogQ);
    ogSnap.forEach(d => {
      const cstr = d.data().creationDate;
      if (typeof cstr === 'string' && cstr.startsWith(`${year}-${mm}-`)) dates.add(cstr);
    });
  } catch (e) {
    console.warn('Failed to load month entries', e);
  }

  monthEntriesCache[mkey] = dates;
  return dates;
}
    // ===== Report Generation (PDF via html2canvas + jsPDF) =====
    function buildReportSection(title, items, cls = '') {
      const section = document.createElement('section');
      section.className = `r-section ${cls}`;
      const h3 = document.createElement('h3');
      h3.className = 'r-title';
      h3.textContent = title;
      section.appendChild(h3);

      const ul = document.createElement('ul');
      ul.className = 'r-list';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'None';
        ul.appendChild(li);
      } else {
        items.forEach((it) => {
          const li = document.createElement('li');
          li.textContent = it;
          ul.appendChild(li);
        });
      }
      section.appendChild(ul);
      return section;
    }

    function collectNotesFrom(container) {
      if (!container) return [];
      return Array.from(container.querySelectorAll('.note-text'))
        .map(n => (n.textContent || '').trim())
        .filter(Boolean);
    }

    async function generateDailyReport() {
      try {
        // Gather data
        const ongoing = (ongoingTasksData || [])
          .filter(t => t.status === 'wip' || t.status === 'not-started')
          .map(t => t.description ? `${t.text} — ${t.description}` : `${t.text}`);

        const completed = (dailyActivitiesData || [])
          .filter(a => a.status === 'done')
          .map(a => a.description ? `${a.text} — ${a.description}` : `${a.text}`);

        const highlightsNotes = collectNotesFrom(document.getElementById('highlights-list'));
        const inquiriesNotes = collectNotesFrom(document.getElementById('inquiries-list'));

        const reportRoot = document.createElement('div');
        reportRoot.id = 'report-canvas';
        reportRoot.innerHTML = `
          <style>
            .eod-report-container {
              max-width:700px;
              margin:2rem auto;
              padding:2rem;
              background:#f8fafd;
              border-radius:18px;
              box-shadow:0 6px 32px #2c347b15;
              font-family:'Lexend',Arial,sans-serif;
            }
            .eod-header {
              display:flex;
              justify-content:space-between;
              align-items:center;
            }
            .eod-header .eod-title {
              color:#2c347b;
              font-size:2rem;
              font-weight:800;
              margin:0;
            }
            .eod-header .eod-date {
              color:#7a7e9a;
              font-size:1.1rem;
              margin-bottom:.5rem;
            }
            .eod-header .eod-user {
              text-align:right;
            }
            .eod-header .eod-user div {
              color:#4956c6;
              font-weight:700;
              font-size:1.1rem;
            }
            .eod-section {
              margin-bottom:1.5rem;
            }
            .eod-section-title {
              font-weight:700;
              font-size:1.15rem;
              margin-bottom:.5rem;
            }
            .eod-section.ongoing .eod-section-title { color:#1e88e5; }
            .eod-section.completed .eod-section-title { color:#43a047; }
            .eod-section.highlight .eod-section-title { color:#3949ab; }
            .eod-section.inquiry .eod-section-title { color:#d32f2f; }
            .eod-section ul {
              margin:.5rem 0 0 1.2rem;
              padding:0;
              color:#444;
            }
            .eod-section li {
              margin-bottom:.3rem;
            }
            .eod-footer {
              text-align:right;
              color:#b0b4c3;
              font-size:.95rem;
              margin-top:2rem;
            }
          </style>
          <div class="eod-report-container">
            <div class="eod-header">
              <div>
                <img src="logo.png" alt="Company Logo" style="height:40px;margin-bottom:8px;">
                <div class="eod-title">End of the Day Report</div>
                <div class="eod-date">${formatDate(selectedDate)}</div>
              </div>
              <div class="eod-user">
                <div>${userNameSpan?.textContent || 'User'}</div>
                <div style="color:#7a7e9a;">${userClientSpan?.textContent || ''}</div>
                <div style="color:#7a7e9a;">${userPositionSpan?.textContent || ''}</div>
              </div>
            </div>
            <hr style="border:none;border-top:2px solid #e0e4f7;margin:1.5rem 0;">
            <div class="eod-section ongoing">
              <div class="eod-section-title"><i class="fas fa-tasks"></i> Ongoing Tasks</div>
              <ul>${ongoing.length ? ongoing.map(t => `<li>${t}</li>`).join('') : '<li>None</li>'}</ul>
            </div>
            <div class="eod-section completed">
              <div class="eod-section-title"><i class="fas fa-check-circle"></i> Completed Tasks</div>
              <ul>${completed.length ? completed.map(t => `<li>${t}</li>`).join('') : '<li>None</li>'}</ul>
            </div>
            <div class="eod-section highlight">
              <div class="eod-section-title"><i class="fas fa-star"></i> Today's Highlight</div>
              <ul>${highlightsNotes.length ? highlightsNotes.map(t => `<li>${t}</li>`).join('') : '<li>None</li>'}</ul>
            </div>
            <div class="eod-section inquiry">
              <div class="eod-section-title"><i class="fas fa-question-circle"></i> Inquiries / Challenges</div>
              <ul>${inquiriesNotes.length ? inquiriesNotes.map(t => `<li>${t}</li>`).join('') : '<li>None</li>'}</ul>
            </div>
            <div class="eod-footer">
              Generated on ${formatDate(new Date())}
            </div>
          </div>
        `;

        document.body.appendChild(reportRoot);

        const canvas = await window.html2canvas(reportRoot, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const imgData = canvas.toDataURL('image/png');

        // Create PDF (fit on single page)
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth - 40; // 20pt margins on both sides
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let y = 20;
        if (imgHeight > pageHeight - 40) {
          // Scale down to fit page height if too tall
          const scale = (pageHeight - 40) / imgHeight;
          const scaledWidth = imgWidth * scale;
          const scaledHeight = imgHeight * scale;
          const x = (pageWidth - scaledWidth) / 2;
          pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
        } else {
          const x = 20;
          pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        }

        const fileName = `Daily_Report_${formatDate(selectedDate)}.pdf`;
        pdf.save(fileName);

        // Cleanup
        reportRoot.remove();
        showNotification('Report generated!');
      } catch (err) {
        console.error('Failed to generate report', err);
        showNotification('Failed to generate report', 'error');
      }
    }
    function updateManagersDate(date) {
      if (highlightManager) {
        highlightManager.setDate(date);
        loadHighlightSection();
      }
      if (inquiriesManager) {
        inquiriesManager.setDate(date);
        if (unsubscribeInquiryNotes) unsubscribeInquiryNotes();
        const dateKey = formatDate(date);
        unsubscribeInquiryNotes = setupInquiryNotesListener(currentUserId, dateKey, renderInquiryNotes);
      }
    }

    // ---- Highlights section helpers (single-doc HTML per day) ----
    function highlightCardHtml(text = '', noteIdAttr = '', kind = 'highlight') {
      const typeClass = kind === 'inquiry' ? 'inquiry-note' : 'highlight-note';
      return `
        <div class="daily-report-card note-card ${typeClass}" data-kind="note" ${noteIdAttr}>
          <div class="activity-text-container">
            <div class="note-text">${text}</div>
          </div>
        </div>`;
    }
    async function serializeHighlightsAndSave() {
      const html = highlightsList ? highlightsList.innerHTML.trim() : '';
      try {
        await highlightManager.save(html);
      } catch (e) {
        showNotification('Failed to save highlights', 'error');
      }
    }
    async function loadHighlightSection() {
      if (!highlightsList || !highlightManager) return;
      const html = await highlightManager.load();
      highlightsList.innerHTML = html || '';
    }

    // Event delegation for highlight notes: open modal on card click
    if (highlightsList) {
      highlightsList.addEventListener('click', (e) => {
        const card = e.target.closest('.daily-report-card');
        if (!card) return;
        const txtEl = card.querySelector('.note-text');
        openNoteModal('highlight', txtEl ? txtEl.textContent : '', true, null, card);
      });
    }

    // ---- Inquiries section helpers (per-note docs) ----
    function renderInquiryNotes(notes) {
      if (!inquiriesList) return;
      inquiriesList.innerHTML = '';
      (notes || []).forEach(n => {
        inquiriesList.insertAdjacentHTML('beforeend', highlightCardHtml(n.content || '', `data-note-id="${n.id}"`, 'inquiry'));
      });
    }
    if (inquiriesList) {
      inquiriesList.addEventListener('click', async (e) => {
        const card = e.target.closest('.daily-report-card');
        if (!card) return;
        const noteId = card.getAttribute('data-note-id');
        const txtEl = card.querySelector('.note-text');
        openNoteModal('inquiry', txtEl ? txtEl.textContent : '', true, noteId, card);
      });
    }

    // ---- Modal logic for add/edit notes ----
    function openNoteModal(kind, initialText = '', editing = false, noteId = null, targetCard = null) {
      currentNoteContext.kind = kind;
      currentNoteContext.editing = editing;
      currentNoteContext.noteId = noteId;
      currentNoteContext.targetCard = targetCard;
      noteModalTitle.textContent = (editing ? 'Edit ' : 'Add ') + (kind === 'inquiry' ? 'Inquiry/Challenge' : 'Highlight');
      noteTextInput.value = initialText || '';
      noteModal.style.display = 'flex';
      // Toggle delete visibility in modal
      const delBtn = document.getElementById('delete-note-btn');
      if (delBtn) delBtn.style.display = editing ? 'inline-flex' : 'none';
    }
    function closeNoteModal() {
      noteModal.style.display = 'none';
      noteTextInput.value = '';
      currentNoteContext = { kind: null, editing: false, noteId: null, targetCard: null };
    }
    if (noteModalClose) noteModalClose.addEventListener('click', closeNoteModal);
    if (noteModal) {
      noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) closeNoteModal();
      });
    }
    if (saveNoteBtn) {
      saveNoteBtn.addEventListener('click', async () => {
        const text = noteTextInput.value.trim();
        if (!text) { showNotification('Please enter a note.', 'error'); return; }
        const dateKey = formatDate(selectedDate);

        try {
          if (currentNoteContext.kind === 'highlight') {
            // Add/edit card in DOM then save whole HTML string to highlight doc
            if (currentNoteContext.editing && currentNoteContext.targetCard) {
              const t = currentNoteContext.targetCard.querySelector('.note-text');
              if (t) t.textContent = text;
            } else {
              highlightsList.insertAdjacentHTML('beforeend', highlightCardHtml(text, '', 'highlight'));
            }
            await serializeHighlightsAndSave();
            showNotification('Highlight saved!');
          } else if (currentNoteContext.kind === 'inquiry') {
            if (currentNoteContext.editing && currentNoteContext.noteId) {
              await updateInquiryNote(currentUserId, dateKey, currentNoteContext.noteId, text);
              showNotification('Inquiry updated!');
            } else {
              await addInquiryNote(currentUserId, dateKey, text);
              showNotification('Inquiry added!');
            }
            // UI updates via listener
          }
        } catch (e) {
          showNotification('Failed to save note', 'error');
        } finally {
          closeNoteModal();
        }
      });
    }

    // Delete from modal
    const deleteNoteBtn = document.getElementById('delete-note-btn');
    if (deleteNoteBtn) {
      deleteNoteBtn.addEventListener('click', async () => {
        const dateKey = formatDate(selectedDate);
        try {
          if (currentNoteContext.kind === 'highlight') {
            if (currentNoteContext.editing && currentNoteContext.targetCard) {
              currentNoteContext.targetCard.remove();
              await serializeHighlightsAndSave();
              showNotification('Highlight removed');
            }
          } else if (currentNoteContext.kind === 'inquiry') {
            if (currentNoteContext.editing && currentNoteContext.noteId) {
              await deleteInquiryNote(currentUserId, dateKey, currentNoteContext.noteId);
              showNotification('Inquiry removed');
            }
          }
        } catch (err) {
          showNotification('Failed to delete note', 'error');
        } finally {
          closeNoteModal();
        }
      });
    }

    // Performance Functions
    function refreshPerformanceSummary() {
        if (!currentUserId) return;

        let doneCount = 0;
        let cancelledCount = 0;
        dailyActivitiesData.forEach(activity => {
            if (activity.status === 'done') doneCount++;
            if (activity.status === 'cancelled') cancelledCount++;
        });

        let wipCount = 0;
        let notStartedCount = 0;
        ongoingTasksData.forEach(task => {
            if (task.status === 'wip') wipCount++;
            if (task.status === 'not-started') notStartedCount++;
        });
// Calendar wiring compatible with admin.html
let calendarWired = false;
function initAdminCalendar() {
  if (calendarWired) return;

  // If elements are missing (rare), still render the grid once
  if (!dateDisplay || !calendarPopup || !currentMonthYearSpan || !prevMonthBtn || !nextMonthBtn || !calendarGrid || !todayBtn) {
    renderCalendar();
    calendarWired = true;
    return;
  }

  // Toggle popup
  dateDisplay.addEventListener('click', () => {
    calendarPopup.style.display = (calendarPopup.style.display === 'block') ? 'none' : 'block';
  });

  // Prev/Next month
  prevMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
  });
  nextMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
  });

  // Today
  todayBtn.addEventListener('click', () => {
    selectedDate = new Date();
    currentCalendarDate = new Date();
    updateUI(currentUserId, selectedDate);
    updateManagersDate(selectedDate);
    renderCalendar();
    calendarPopup.style.display = 'none';
  });

  // Close on outside click (matches admin calendar behavior)
  document.addEventListener('click', function(event) {
    if (!calendarPopup) return;
    if (
      calendarPopup.style.display === 'block' &&
      !calendarPopup.contains(event.target) &&
      (!dateDisplay || !dateDisplay.contains(event.target))
    ) {
      calendarPopup.style.display = 'none';
    }
  });

  renderCalendar();
  calendarWired = true;
}
// Expose to window to mirror admin function name
window.initAdminCalendar = initAdminCalendar;

        todayPerformanceValues.done.textContent = doneCount;
        todayPerformanceValues.wip.textContent = wipCount;
        todayPerformanceValues['not-started'].textContent = notStartedCount;
        todayPerformanceValues.cancelled.textContent = cancelledCount;
    }

    function updateOverallPerformanceUI() {
        if (!overallPerformanceValues) return;
        overallPerformanceValues.done.textContent = overallPerformance.done;
        overallPerformanceValues.wip.textContent = overallPerformance.wip;
        overallPerformanceValues['not-started'].textContent = overallPerformance['not-started'];
        overallPerformanceValues.cancelled.textContent = overallPerformance.cancelled;
    }

    // Activity Card Functions
    function createActivityCard(activity) {
        const card = document.createElement('div');
        card.className = `daily-report-card ${activity.status}`;
        card.dataset.activityId = activity.id;
        card.dataset.activity = JSON.stringify(activity);
        card.dataset.date = activity.creationDate || activity.completionDate;
        const currentStatus = statusOptions[activity.status] || statusOptions['not-started'];
        const dropdownHtml = `
            <div class="status-dropdown">
                <button class="status-dropdown-button" style="background-color: ${currentStatus.dotColor};">
                    ${currentStatus.text}
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="status-dropdown-menu">
                    ${Object.keys(statusOptions).map(status => `
                        <button data-status="${status}">
                            <span class="status-dot" style="background-color: ${statusOptions[status].dotColor};"></span>
                            ${statusOptions[status].text}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        const dateDisplay = activity.creationDate ? `Created on: ${activity.creationDate}` : `Completed on: ${activity.completionDate}`;
        card.innerHTML = `
            <div class="activity-text-container">
                <span class="activity-text">${activity.text}</span>
                <span class="activity-description">${activity.description || ''}</span>
                <span class="timestamp">${dateDisplay}</span>
            </div>
            <div class="controls">
                ${dropdownHtml}
                <div class="card-buttons">
                    <button class="edit-btn"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
        return card;
    }

    // Rendering Functions
    function renderOngoingTasks(ongoingTasks) {
        if (!currentUserId) return;

        const container = document.querySelector('.ongoing-tasks-content');
        container.innerHTML = '';

        if (ongoingTasks.length === 0) {
            container.innerHTML = '<div class="no-tasks">No ongoing tasks found</div>';
            return;
        }

        ongoingTasks.forEach(task => {
            const card = createActivityCard(task);
            container.appendChild(card);
        });
    }

    function renderDailyActivities(dailyActivities) {
        if (!currentUserId) return;

        dailyActivitiesList.innerHTML = '';
        if (dailyActivities && dailyActivities.length > 0) {
            noReportMessage.style.display = 'none';
            dailyActivitiesList.style.display = 'grid';
            const sortedActivities = dailyActivities.sort((a, b) => {
                const timeA = new Date(`2000/01/01 ${a.timestamp}`);
                const timeB = new Date(`2000/01/01 ${b.timestamp}`);
                return timeA - timeB;
            });
            sortedActivities.forEach(activity => {
                const card = createActivityCard(activity);
                dailyActivitiesList.appendChild(card);
            });
        } else {
            noReportMessage.style.display = 'block';
            dailyActivitiesList.style.display = 'none';
        }
    }

    async function renderCalendar() {
        if (!calendarGrid || !currentMonthYearSpan) return;
        const seq = ++calendarRenderSeq;
        // Clear immediately to avoid any leftover content before async work
        calendarGrid.innerHTML = '';
        currentMonthYearSpan.textContent = currentCalendarDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const startDay = firstDayOfMonth.getDay();
        const totalDays = lastDayOfMonth.getDate();
        const todayDate = formatDate(new Date());

        // Load month entries (completed and ongoing created) to show indicators
        const monthDatesWithEntries = await ensureMonthEntries(currentUserId, year, month);
        // If another render started while awaiting, abort this pass
        if (seq !== calendarRenderSeq) return;
        // Clear again (safety) before appending
        calendarGrid.innerHTML = '';

        for (let i = 0; i < startDay; i++) {
            const blankDay = document.createElement('div');
            blankDay.className = 'day other-month';
            calendarGrid.appendChild(blankDay);
        }

        for (let i = 1; i <= totalDays; i++) {
            const dayEl = document.createElement('div');
            dayEl.textContent = i;
            dayEl.className = 'day current-month';
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            dayEl.dataset.date = dateString;

            if (dateString === todayDate) {
                dayEl.classList.add('today');
            }
            if (dateString === formatDate(selectedDate)) {
                dayEl.classList.add('selected');
            }
            // Indicator if there are entries on this date
            if (monthDatesWithEntries && monthDatesWithEntries.has(dateString)) {
                dayEl.classList.add('has-entry');
            }

            dayEl.addEventListener('click', () => {
                const parts = dateString.split('-');
                selectedDate = new Date(parts[0], parts[1] - 1, parts[2], 12);
                updateUI(currentUserId, selectedDate);
                updateManagersDate(selectedDate);
                // Close popup after selecting a date
                if (calendarPopup) calendarPopup.style.display = 'none';
                // Re-render to update selected state and indicators
                renderCalendar();
            });

            calendarGrid.appendChild(dayEl);
        }
    }

    // Activity Modal Functions
    function closeActivityModal() {
        addActivityModal.style.display = 'none';
        activityInput.value = '';
        activityDescriptionInput.value = '';
    }

    async function addNewActivity() {
        const activityText = activityInput.value.trim();
        const activityDescription = activityDescriptionInput.value.trim();
        const activityStatus = modalStatus;
        const formattedDate = formatDate(selectedDate);

        if (activityText && currentUserId) {
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Chicago'
            });
            const newActivity = {
                id: Date.now(),
                text: activityText,
                description: activityDescription,
                status: activityStatus,
                timestamp: timestamp,
            };

            if (activityStatus === 'done' || activityStatus === 'cancelled') {
                newActivity.completionDate = formattedDate;
            } else {
                newActivity.creationDate = formattedDate;
            }

            const container = (activityStatus === 'done' || activityStatus === 'cancelled') ? dailyActivitiesList : ongoingTasksContent;
            const newCard = createActivityCard(newActivity);

            const currentFormattedDate = formatDate(selectedDate);
            if (formattedDate === currentFormattedDate || (activityStatus === 'wip' || activityStatus === 'not-started')) {
                container.appendChild(newCard);
            }

            const oldOverallPerformance = { ...overallPerformance };
            if (overallPerformance[activityStatus] !== undefined) {
                overallPerformance[activityStatus]++;
                updateOverallPerformanceUI();
            }

            try {
                await addActivity(currentUserId, newActivity);
                showNotification('Activity added successfully!');
            } catch (error) {
                showNotification('Failed to add activity: ' + error.message, 'error');
                newCard.remove();
                overallPerformance = oldOverallPerformance;
                updateOverallPerformanceUI();
            }
            closeActivityModal();
        } else if (!activityText) {
            showNotification('Please enter an activity.', 'error');
        }
    }

    // Main UI Functions
    async function updateUI(userId, date) {
        if (!userId) return;

        const formattedDate = formatDate(date);
        dateDisplay.textContent = formattedDate;
        reportDateSpan.textContent = formattedDate;

        if (unsubscribeDaily) unsubscribeDaily();
        unsubscribeDaily = setupDailyActivitiesListener(userId, formattedDate, (activities) => {
            dailyActivitiesData = activities;
            renderDailyActivities(activities);
            refreshPerformanceSummary();
        });

        try {
            const userData = await getAllUserDataFromFirestore(userId);
            if (userData && userData.performanceSummary) {
                overallPerformance = userData.performanceSummary;
            } else {
                overallPerformance = {
                    done: 0,
                    wip: 0,
                    'not-started': 0,
                    cancelled: 0
                };
            }
            updateOverallPerformanceUI();
        } catch (error) {
            showNotification('Failed to load user data: ' + error.message, 'error');
        }
    }

    function showAuthForm(mode) {
        authMode = mode;
        authContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        authEmailInput.value = '';
        authPasswordInput.value = '';
        authNameInput.value = '';
        authClientInput.value = '';
        authPositionInput.value = '';
        authPasswordInput.style.display = 'block';
        authNameInput.style.display = 'none';
        authClientInput.style.display = 'none';
        authPositionInput.style.display = 'none';
        showRegisterLink.style.display = 'inline';
        showForgotPasswordLink.style.display = 'inline';
        if (mode === 'login') {
            authTitle.textContent = 'Login';
            authSubmitBtn.textContent = 'Login';
        } else if (mode === 'register') {
            authTitle.textContent = 'Register';
            authSubmitBtn.textContent = 'Register';
            authNameInput.style.display = 'block';
            authClientInput.style.display = 'block';
            authPositionInput.style.display = 'block';
            showRegisterLink.style.display = 'none';
            showForgotPasswordLink.style.display = 'inline';
        } else if (mode === 'forgot-password') {
            authTitle.textContent = 'Reset Password';
            authSubmitBtn.textContent = 'Send Reset Email';
            authPasswordInput.style.display = 'none';
            showRegisterLink.style.display = 'inline';
            showForgotPasswordLink.style.display = 'none';
        }
    }

    async function showDashboard(user) {
    // Add a check to ensure the user object and its uid property are valid
    if (!user || !user.uid) {
        console.error("User object or User ID is invalid. Cannot show dashboard.");
        showNotification("Authentication error. Please try logging in again.", 'error');
        // Optionally, redirect to the login form
        showAuthForm('login');
        return;
    }

    authContainer.style.display = 'none';
    dashboardContainer.style.display = 'flex';
    currentUserId = user.uid;
    

    authContainer.style.display = 'none';
    dashboardContainer.style.display = 'flex';
    currentUserId = user.uid;
    

    // Initialize highlight / inquiries managers and load sections
    highlightManager = new HighlightManager(user.uid, selectedDate);
    inquiriesManager = new InquiriesManager(user.uid, selectedDate);
    
    try {
        await loadHighlightSection();
        // Subscribe inquiries for current date
        if (unsubscribeInquiryNotes) unsubscribeInquiryNotes();
        unsubscribeInquiryNotes = setupInquiryNotesListener(currentUserId, formatDate(selectedDate), renderInquiryNotes);

        // Rest of your dashboard setup
        if (unsubscribeOngoing) unsubscribeOngoing();
        unsubscribeOngoing = setupOngoingTasksListener(currentUserId, (tasks) => {
            ongoingTasksData = tasks;
            renderOngoingTasks(tasks);
            refreshPerformanceSummary();
        });

        const userData = await getAllUserDataFromFirestore(user.uid);
        if (userData) {
            userNameSpan.textContent = userData.name || user.displayName || 'User';
            userClientSpan.textContent = userData.client || 'N/A';
            userPositionSpan.textContent = userData.position || 'N/A';
        }

        await updateUI(user.uid, new Date());
        // Mirror admin calendar initialization (align with admin.html)
        if (window.initAdminCalendar) { window.initAdminCalendar(); } else { try { initAdminCalendar(); } catch(e) {} }
    } catch (error) {
        console.error("Dashboard initialization failed:", error);
        showNotification('Failed to initialize dashboard', 'error');
    }
}

    // Event Listeners
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        const name = authNameInput.value;
        const client = authClientInput.value;
        const position = authPositionInput.value;

        if (authMode === 'login') {
            try {
                const userCredential = await loginUser(email, password);
                console.log("Logged in user:", userCredential.user);
            } catch (error) {
                showNotification('Failed to log in: ' + error.message, 'error');
            }
        } else if (authMode === 'register') {
            if (!name || !client || !position) {
                showNotification('All fields are required for registration.', 'error');
                return;
            }
            try {
                const userCredential = await registerUser(email, password);
                await updateUserProfile(userCredential.user, name);
                await saveUserDetailsToFirestore(userCredential.user.uid, {
                    name,
                    client,
                    position
                });
                console.log("Registered and saved details for:", userCredential.user);
            } catch (error) {
                showNotification('Failed to register: ' + error.message, 'error');
            }
        } else if (authMode === 'forgot-password') {
            try {
                await resetPassword(email);
                showNotification('Password reset email sent. Check your inbox!');
            } catch (error) {
                showNotification('Failed to send reset email: ' + error.message, 'error');
            }
        }
    });

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('register');
    });

    showForgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('forgot-password');
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await logoutUser();
            showAuthForm('login');
        } catch (error) {
            showNotification('Failed to log out: ' + error.message, 'error');
        }
    });

    // Legacy calendar listeners removed; initAdminCalendar wires these to avoid double-binding.

    document.addEventListener('click', (e) => {
        const isClickInsideDropdown = e.target.closest('.status-dropdown');
        const isClickInsideEditButton = e.target.closest('.edit-btn');
        const isClickInsideEditingInput = e.target.closest('.edit-input') || e.target.closest('.edit-textarea');
        const isClickInsideHighlight = e.target.closest('#highlight-text') || e.target.closest('#highlight-edit-btn');
        
        if (!isClickInsideDropdown && !isClickInsideEditButton && !isClickInsideEditingInput && !isClickInsideHighlight) {
            document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
            });

            // Revert any active edit modes (excluding highlight)
            document.querySelectorAll('.edit-btn[data-editing="true"]').forEach(async editBtn => {
                // ... existing edit button handling code ...
            });
        }
    });

    document.querySelector('#add-activity-modal .modal-close-btn').addEventListener('click', () => {
        closeActivityModal();
    });

    addActivityModal.addEventListener('click', (e) => {
        if (e.target === addActivityModal) {
            closeActivityModal();
        }
    });
    plusButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const statusCard = e.target.closest('.metric');
        if (statusCard) {
            modalStatus = statusCard.dataset.today;
            document.querySelector('#add-activity-modal .modal-title').textContent = `Add ${statusCard.dataset.today} activity`;
            addActivityModal.style.display = 'flex';
            activityInput.focus();
        }
    });
});




    addActivityBtn.addEventListener('click', addNewActivity);

    // Add buttons open modal now
    if (addHighlightBtn) {
      addHighlightBtn.addEventListener('click', () => openNoteModal('highlight'));
    }
    if (addInquiryBtn) {
      addInquiryBtn.addEventListener('click', () => openNoteModal('inquiry'));
    }

    // Generate Report button
    const genReportBtn = document.getElementById('generate-report-btn');
    if (genReportBtn) {
      genReportBtn.addEventListener('click', generateDailyReport);
    }

    document.querySelector('.ongoing-tasks-header').addEventListener('click', () => {
        const content = document.querySelector('.ongoing-tasks-content');
        const toggleBtn = document.querySelector('.collapse-toggle');
        content.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
    });

    document.querySelector('.collapse-toggle').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling if needed
        const content = document.querySelector('.ongoing-tasks-content');
        const toggleBtn = document.querySelector('.collapse-toggle');
        content.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
    });

    // After successful login/auth state change, check if user is admin and redirect
const ADMIN_UIDS = [
  "0MbDZJCVZoXglO2t0CUGyU3krEa2",
  "tcwVw2wAuBZ3Ln3aSnewrjyOy793"
];

function handleAuthRedirect(user) {
  if (user && ADMIN_UIDS.includes(user.uid)) {
    // If already on admin.html, do nothing
    if (!window.location.pathname.endsWith('admin.html')) {
      window.location.href = "admin.html";
    }
  } else {
    // If on admin.html but not admin, redirect to index.html
    if (window.location.pathname.endsWith('admin.html')) {
      window.location.href = "index.html";
    }
  }
}

// Example: If you use Firebase Auth state listener
firebase.auth().onAuthStateChanged(user => {
  handleAuthRedirect(user);
  // ...your existing logic...
});

    setupAuthChangeListener(
        (user) => {
            if (user) {
                selectedDate = new Date();
                currentCalendarDate = new Date();
                showDashboard(user);
            } else {
                showAuthForm('login');
            }
        },
        (error) => {
            showNotification('Authentication state change failed: ' + error.message, 'error');
        }
    );

    // Delegated event listener for daily activities list
    dailyActivitiesList.addEventListener('click', async (e) => {
        const dropdownButton = e.target.closest('.status-dropdown-button');
        if (dropdownButton) {
            e.preventDefault();
            e.stopPropagation();
            const parentDropdown = dropdownButton.parentElement;

            document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
                if (dropdown !== parentDropdown) {
                    dropdown.classList.remove('show');
                }
            });

            parentDropdown.classList.toggle('show');
            return;
        }

        const newStatusButton = e.target.closest('.status-dropdown-menu button');
        if (newStatusButton) {
            e.preventDefault();
            e.stopPropagation();
            const newStatus = newStatusButton.dataset.status;
            const card = e.target.closest('.daily-report-card');
            const activity = JSON.parse(card.dataset.activity);

            if (currentUserId && activity && newStatus) {
                const oldStatus = activity.status;
                const originalCardHTML = card.innerHTML;

                // Optimistically update overall performance counters
                if (overallPerformance[oldStatus] !== undefined) overallPerformance[oldStatus]--;
                if (overallPerformance[newStatus] !== undefined) overallPerformance[newStatus]++;
                updateOverallPerformanceUI();

                // Optimistically update the card's status text and class
                card.classList.remove(oldStatus);
                card.classList.add(newStatus);
                card.querySelector('.status-dropdown-button').textContent = statusOptions[newStatus].text;

                try {
                    const todayDate = formatDate(new Date());
                    await updateActivityStatus(currentUserId, activity, newStatus, todayDate);
                    showNotification(`Activity status updated to "${statusOptions[newStatus].text}"`);
                } catch (error) {
                    showNotification('Failed to update activity status: ' + error.message, 'error');
                    // Revert the UI on failure
                    card.classList.remove(newStatus);
                    card.classList.add(oldStatus);
                    card.querySelector('.status-dropdown-button').textContent = statusOptions[oldStatus].text;
                    // Revert the overall performance counters
                    if (overallPerformance[oldStatus] !== undefined) overallPerformance[oldStatus]++;
                    if (overallPerformance[newStatus] !== undefined) overallPerformance[newStatus]--;
                    updateOverallPerformanceUI();
                }
            }
            const dropdownElement = document.querySelector('.status-dropdown.show');
            if (dropdownElement) {
                dropdownElement.classList.remove('show');
            }
            return;
        }

        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
            const activity = JSON.parse(card.dataset.activity);
            const activityTextElement = card.querySelector('.activity-text');
            const activityDescriptionElement = card.querySelector('.activity-description');
            const editIcon = editBtn.querySelector('i');

            if (editIcon.classList.contains('fa-edit')) {
                // Enter edit mode
                const currentText = activityTextElement.textContent;
                const currentDescription = activityDescriptionElement.textContent;

                const textInputElement = document.createElement('input');
                textInputElement.type = 'text';
                textInputElement.value = currentText;
                textInputElement.className = 'edit-input';

                const descriptionInputElement = document.createElement('textarea');
                descriptionInputElement.value = currentDescription;
                descriptionInputElement.className = 'edit-textarea';

                activityTextElement.replaceWith(textInputElement);
                activityDescriptionElement.replaceWith(descriptionInputElement);

                textInputElement.focus();
                editIcon.classList.remove('fa-edit');
                editIcon.classList.add('fa-save');
                editBtn.style.backgroundColor = 'var(--done-text)';
                editBtn.dataset.editing = 'true';

                // Handle saving on Enter key press on the text input
                textInputElement.addEventListener('keydown', async (keyEvent) => {
                    if (keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        descriptionInputElement.focus();
                    }
                });

                // Handle saving on Ctrl+Enter key press on the description textarea
                descriptionInputElement.addEventListener('keydown', async (keyEvent) => {
                    if (keyEvent.ctrlKey && keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        const newText = textInputElement.value;
                        const newDescription = descriptionInputElement.value;
                        if (newText.trim() === '') {
                            showNotification('Activity text cannot be empty.', 'error');
                            return;
                        }

                        try {
                            await updateActivityContent(currentUserId, activity.id, 'dailyReports', newText, newDescription);
                            showNotification('Activity updated successfully!');
                            const newTextElement = document.createElement('span');
                            newTextElement.className = 'activity-text';
                            newTextElement.textContent = newText;
                            const newDescriptionElement = document.createElement('span');
                            newDescriptionElement.className = 'activity-description';
                            newDescriptionElement.textContent = newDescription;
                            textInputElement.replaceWith(newTextElement);
                            descriptionInputElement.replaceWith(newDescriptionElement);
                            editIcon.classList.remove('fa-save');
                            editIcon.classList.add('fa-edit');
                            editBtn.style.backgroundColor = 'var(--primary-color)';
                            editBtn.dataset.editing = 'false';
                        } catch (error) {
                            showNotification('Failed to update activity: ' + error.message, 'error');
                            // Revert on failure
                            const newTextElement = document.createElement('span');
                            newTextElement.className = 'activity-text';
                            newTextElement.textContent = currentText;
                            const newDescriptionElement = document.createElement('span');
                            newDescriptionElement.className = 'activity-description';
                            newDescriptionElement.textContent = currentDescription;
                            textInputElement.replaceWith(newTextElement);
                            descriptionInputElement.replaceWith(newDescriptionElement);
                            editIcon.classList.remove('fa-save');
                            editIcon.classList.add('fa.edit');
                            editBtn.style.backgroundColor = 'var(--primary-color)';
                            editBtn.dataset.editing = 'false';
                        }
                    }
                });
            } else {
                // Exit edit mode and save
                const textInputElement = card.querySelector('.edit-input');
                const descriptionInputElement = card.querySelector('.edit-textarea');
                const newText = textInputElement.value;
                const newDescription = descriptionInputElement.value;

                if (newText.trim() === '') {
                    showNotification('Activity text cannot be empty.', 'error');
                    return;
                }

                try {
                    await updateActivityContent(currentUserId, activity.id, 'dailyReports', newText, newDescription);
                    showNotification('Activity updated successfully!');
                    const newTextElement = document.createElement('span');
                    newTextElement.className = 'activity-text';
                    newTextElement.textContent = newText;
                    const newDescriptionElement = document.createElement('span');
                    newDescriptionElement.className = 'activity-description';
                    newDescriptionElement.textContent = newDescription;
                    textInputElement.replaceWith(newTextElement);
                    descriptionInputElement.replaceWith(newDescriptionElement);
                    editIcon.classList.remove('fa-save');
                    editIcon.classList.add('fa-edit');
                    editBtn.style.backgroundColor = 'var(--primary-color)';
                } catch (error) {
                    showNotification('Failed to update activity: ' + error.message, 'error');
                    // Revert on failure
                    const newTextElement = document.createElement('span');
                    newTextElement.className = 'activity-text';
                    newTextElement.textContent = activity.text; // Revert to original text
                    const newDescriptionElement = document.createElement('span');
                    newDescriptionElement.className = 'activity-description';
                    newDescriptionElement.textContent = activity.description;
                    textInputElement.replaceWith(newTextElement);
                    descriptionInputElement.replaceWith(newDescriptionElement);
                    editIcon.classList.remove('fa-save');
                    editIcon.classList.add('fa.edit');
                    editBtn.style.backgroundColor = 'var(--primary-color)';
                }
            }
            return;
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
            // Add a check to ensure the card was found before proceeding.
            if (!card) {
                console.error("Could not find the parent daily-report-card for deletion.");
                showNotification("Could not find the task to delete.", 'error');
                return; 
            }
            const activity = JSON.parse(card.dataset.activity);
            const status = activity.status;
            const originalCardHTML = card.innerHTML;
            const originalParent = card.parentElement;
            // Optimistically remove the card
            card.remove();

            // Optimistically update overall performance counters
            if (overallPerformance[status] !== undefined) {
                overallPerformance[status]--;
                updateOverallPerformanceUI();
            }

            try {
                await deleteActivity(currentUserId, activity);
                showNotification('Activity deleted successfully!');
            } catch (error) {
                showNotification('Failed to delete activity: ' + error.message, 'error');
                // Revert UI on failure
                originalParent.appendChild(card);
                card.innerHTML = originalCardHTML;
                // Revert the overall performance counter
                if (overallPerformance[status] !== undefined) {
                    overallPerformance[status]++;
                    updateOverallPerformanceUI();
                }
            }
            return;
        }
    });

    // Delegated event listener for ongoing tasks list
    ongoingTasksContent.addEventListener('click', async (e) => {
        const dropdownButton = e.target.closest('.status-dropdown-button');
        if (dropdownButton) {
            e.preventDefault();
            e.stopPropagation();
            const parentDropdown = dropdownButton.parentElement;

            document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
                if (dropdown !== parentDropdown) {
                    dropdown.classList.remove('show');
                }
            });

            parentDropdown.classList.toggle('show');
            return;
        }

        const newStatusButton = e.target.closest('.status-dropdown-menu button');
        if (newStatusButton) {
            e.preventDefault();
            e.stopPropagation();
            const newStatus = newStatusButton.dataset.status;
            const card = e.target.closest('.daily-report-card');
            const activity = JSON.parse(card.dataset.activity);
            const oldStatus = activity.status;
            const originalCardHTML = card.innerHTML;
            const originalParent = card.parentElement;

            if (currentUserId && activity && newStatus) {
                // Optimistically update overall performance counters
                if (overallPerformance[oldStatus] !== undefined) overallPerformance[oldStatus]--;
                if (overallPerformance[newStatus] !== undefined) overallPerformance[newStatus]++;
                updateOverallPerformanceUI();

                // Optimistically update the UI
                card.remove();

                try {
                    const todayDate = formatDate(new Date()); // Get today's date
                    await updateActivityStatus(currentUserId, activity, newStatus, todayDate);
                    showNotification(`Activity status updated to "${statusOptions[newStatus].text}"`);
                } catch (error) {
                    showNotification('Failed to update activity status: ' + error.message, 'error');
                    // Revert UI on failure
                    originalParent.appendChild(card);
                    card.innerHTML = originalCardHTML;
                    // Revert the overall performance counters
                    if (overallPerformance[oldStatus] !== undefined) overallPerformance[oldStatus]++;
                    if (overallPerformance[newStatus] !== undefined) overallPerformance[newStatus]--;
                    updateOverallPerformanceUI();
                }
            }
            const dropdownElement = document.querySelector('.status-dropdown.show');
            if (dropdownElement) {
                dropdownElement.classList.remove('show');
            }
            return;
        }

        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
            const activity = JSON.parse(card.dataset.activity);
            const activityTextElement = card.querySelector('.activity-text');
            const activityDescriptionElement = card.querySelector('.activity-description');
            const editIcon = editBtn.querySelector('i');

            if (editIcon.classList.contains('fa-edit')) {
                // Enter edit mode
                const currentText = activityTextElement.textContent;
                const currentDescription = activityDescriptionElement.textContent;

                const textInputElement = document.createElement('input');
                textInputElement.type = 'text';
                textInputElement.value = currentText;
                textInputElement.className = 'edit-input';

                const descriptionInputElement = document.createElement('textarea');
                descriptionInputElement.value = currentDescription;
                descriptionInputElement.className = 'edit-textarea';

                activityTextElement.replaceWith(textInputElement);
                activityDescriptionElement.replaceWith(descriptionInputElement);

                textInputElement.focus();
                editIcon.classList.remove('fa-edit');
                editIcon.classList.add('fa-save');
                editBtn.style.backgroundColor = 'var(--done-text)';
                editBtn.dataset.editing = 'true';

                // Handle saving on Enter key press on the text input
                textInputElement.addEventListener('keydown', async (keyEvent) => {
                    if (keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        descriptionInputElement.focus();
                    }
                });

                // Handle saving on Ctrl+Enter key press on the description textarea
                descriptionInputElement.addEventListener('keydown', async (keyEvent) => {
                    if (keyEvent.ctrlKey && keyEvent.key === 'Enter') {
                        keyEvent.preventDefault();
                        const newText = textInputElement.value;
                        const newDescription = descriptionInputElement.value;
                        if (newText.trim() === '') {
                            showNotification('Activity text cannot be empty.', 'error');
                            return;
                        }

                        try {
                            await updateActivityContent(currentUserId, activity.id, 'ongoingTasks', newText, newDescription);
                            showNotification('Activity updated successfully!');
                            const newTextElement = document.createElement('span');
                            newTextElement.className = 'activity-text';
                            newTextElement.textContent = newText;
                            const newDescriptionElement = document.createElement('span');
                            newDescriptionElement.className = 'activity-description';
                            newDescriptionElement.textContent = newDescription;
                            textInputElement.replaceWith(newTextElement);
                            descriptionInputElement.replaceWith(newDescriptionElement);
                            editIcon.classList.remove('fa-save');
                            editIcon.classList.add('fa-edit');
                            editBtn.style.backgroundColor = 'var(--primary-color)';
                            editBtn.dataset.editing = 'false';
                        } catch (error) {
                            showNotification('Failed to update activity: ' + error.message, 'error');
                            // Revert on failure
                            const newTextElement = document.createElement('span');
                            newTextElement.className = 'activity-text';
                            newTextElement.textContent = currentText;
                            const newDescriptionElement = document.createElement('span');
                            newDescriptionElement.className = 'activity-description';
                            newDescriptionElement.textContent = currentDescription;
                            textInputElement.replaceWith(newTextElement);
                            descriptionInputElement.replaceWith(newDescriptionElement);
                            editIcon.classList.remove('fa-save');
                            editIcon.classList.add('fa.edit');
                            editBtn.style.backgroundColor = 'var(--primary-color)';
                            editBtn.dataset.editing = 'false';
                        }
                    }
                });
            } else {
                // Exit edit mode and save
                const textInputElement = card.querySelector('.edit-input');
                const descriptionInputElement = card.querySelector('.edit-textarea');
                const newText = textInputElement.value;
                const newDescription = descriptionInputElement.value;

                if (newText.trim() === '') {
                    showNotification('Activity text cannot be empty.', 'error');
                    return;
                }

                try {
                    await updateActivityContent(currentUserId, activity.id, 'ongoingTasks', newText, newDescription);
                    showNotification('Activity updated successfully!');
                    const newTextElement = document.createElement('span');
                    newTextElement.className = 'activity-text';
                    newTextElement.textContent = newText;
                    const newDescriptionElement = document.createElement('span');
                    newDescriptionElement.className = 'activity-description';
                    newDescriptionElement.textContent = newDescription;
                    textInputElement.replaceWith(newTextElement);
                    descriptionInputElement.replaceWith(newDescriptionElement);
                    editIcon.classList.remove('fa-save');
                    editIcon.classList.add('fa-edit');
                    editBtn.style.backgroundColor = 'var(--primary-color)';
                } catch (error) {
                    showNotification('Failed to update activity: ' + error.message, 'error');
                    // Revert on failure
                    const newTextElement = document.createElement('span');
                    newTextElement.className = 'activity-text';
                    newTextElement.textContent = activity.text; // Revert to original text
                    const newDescriptionElement = document.createElement('span');
                    newDescriptionElement.className = 'activity-description';
                    newDescriptionElement.textContent = activity.description;
                    textInputElement.replaceWith(newTextElement);
                    descriptionInputElement.replaceWith(newDescriptionElement);
                    editIcon.classList.remove('fa-save');
                    editIcon.classList.add('fa.edit');
                    editBtn.style.backgroundColor = 'var(--primary-color)';
                }
            }
            return;
        }
        

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
            // Add a check to ensure the card was found before proceeding.
            if (!card) {
                console.error("Could not find the parent daily-report-card for deletion.");
                showNotification("Could not find the task to delete.", 'error');
                return;
            }
            const activity = JSON.parse(card.dataset.activity);
            const status = activity.status;
            const originalCardHTML = card.innerHTML;
            const originalParent = card.parentElement;

            // Optimistically remove the card
            card.remove();

            // Optimistically update overall performance counters
            if (overallPerformance[status] !== undefined) {
                overallPerformance[status]--;
                updateOverallPerformanceUI();
            }

            try {
                await deleteActivity(currentUserId, activity);
                showNotification('Activity deleted successfully!');
            } catch (error) {
                showNotification('Failed to delete activity: ' + error.message, 'error');
                // Revert UI on failure
                originalParent.appendChild(card);
                card.innerHTML = originalCardHTML;
                // Revert the overall performance counter
                if (overallPerformance[status] !== undefined) {
                    overallPerformance[status]++;
                    updateOverallPerformanceUI();
                }
            }
            return;
        }
    });

    // Global outside-click handler removed; initAdminCalendar already registers a scoped handler.

    function showUserTasksModal(title, html) {
  const modal = document.getElementById('user-tasks-modal');
  document.getElementById('user-tasks-modal-title').textContent = title;
  document.getElementById('user-tasks-modal-body').innerHTML = html;
  modal.style.display = 'flex';
}
function hideUserTasksModal() {
  document.getElementById('user-tasks-modal').style.display = 'none';
}
document.getElementById('user-tasks-modal-close').onclick = hideUserTasksModal;
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') hideUserTasksModal();
});
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  const yearStart = new Date(d.getFullYear(),0,1);
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
function groupTasksByWeek(tasks) {
  const grouped = {};
  tasks.forEach(task => {
    const date = new Date(task.date || task.completionDate || task.creationDate);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-W${week}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  });
  return grouped;
}
function buildUserTasksModalHtml(tasks, statusLabel) {
  if (!tasks.length) return `<div style="color:#7a7e9a;">No tasks found.</div>`;
  const grouped = groupTasksByWeek(tasks);
  const weekKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  return weekKeys.map(week => `
    <div style="margin-bottom:1.2rem;">
      <div style="font-weight:600;color:#4956c6;margin-bottom:.3rem;">${week}</div>
      <ul style="margin:0 0 0 1.2rem;padding:0;">
        ${grouped[week].map(task => `
          <li style="margin-bottom:.5rem;">
            <div style="font-weight:500;">${task.text || task.title || ''}</div>
            ${task.description ? `<div style="color:#7a7e9a;font-size:.95rem;">${task.description}</div>` : ''}
            <div style="font-size:.85rem;color:#b0b4c3;">${task.date || task.completionDate || task.creationDate || ''}</div>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

// Task metrics (overall performance) sections: show user tasks on click
document.querySelectorAll('.performance-section .metric').forEach(metric => {
  metric.addEventListener('click', function() {
    const status = this.dataset.status; // e.g. 'done', 'wip', 'not-started', 'cancelled'
    // You must fetch/filter the user's tasks for this status:
    // Example: getUserTasks() should return all tasks for the current user
    const allTasks = getUserTasks(); // Implement this function based on your data structure
    let filtered = [];
    if (status === 'done') filtered = allTasks.filter(t => t.status === 'done');
    else if (status === 'wip') filtered = allTasks.filter(t => t.status === 'wip');
    else if (status === 'not-started') filtered = allTasks.filter(t => t.status === 'not-started');
    else if (status === 'cancelled') filtered = allTasks.filter(t => t.status === 'cancelled');
    const html = buildUserTasksModalHtml(filtered, status);
    showUserTasksModal(this.textContent.trim(), html);
  });
});
});