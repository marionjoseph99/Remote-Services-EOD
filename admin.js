// No import statements needed
const db = firebase.firestore();

let selectedDate = new Date();
let currentCalendarDate = new Date();

// Realtime data cache
const usersDataCache = {};
const subUnsubs = {};
let usersUnsub = null;

// Persisted view filter (selected user IDs)
const FILTER_STORAGE_KEY = 'adminUserFilterV1';
let viewControlsWired = false;
// Helper to check if a stored filter exists
function hasStoredFilter() {
  try {
    return localStorage.getItem(FILTER_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

// Global click-outside handler to close the dropdown when clicking elsewhere
document.addEventListener('click', (e) => {
  const panel = document.getElementById('user-filter-panel');
  const btn = document.getElementById('edit-view-btn');
  if (!panel || !btn) return;
  const inside = panel.contains(e.target) || btn.contains(e.target);
  if (!inside && panel.style.display === 'block') {
    panel.style.display = 'none';
  }
});

// Details modal helpers
let detailsModalWired = false;
function wireDetailsModal() {
  if (detailsModalWired) return;
  const modal = document.getElementById('admin-details-modal');
  const dialog = modal?.querySelector('.details-dialog');
  const closeBtn = document.getElementById('details-close');
  if (!modal || !dialog) return;

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDetailsModal();
  });
  // Close on X button
  closeBtn?.addEventListener('click', () => closeDetailsModal());
  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailsModal();
  });

  detailsModalWired = true;
}
function openDetailsModal(title, html) {
  const modal = document.getElementById('admin-details-modal');
  const body = document.getElementById('details-body');
  const titleEl = document.getElementById('details-title');
  if (!modal || !body || !titleEl) return;
  titleEl.textContent = title;
  body.innerHTML = html;
  // Set visible first, then add 'show' next frame to trigger CSS transitions
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });
}
function closeDetailsModal() {
  const modal = document.getElementById('admin-details-modal');
  const body = document.getElementById('details-body');
  if (!modal || !body) return;
  // Remove class to start CSS closing animation, then hide after transition
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    body.innerHTML = '';
  }, 280);
}

function loadSelectedIds() {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return new Set(); // no stored filter yet
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
    if (parsed && Array.isArray(parsed.selected)) return new Set(parsed.selected);
    return new Set();
  } catch {
    return new Set();
  }
}
function saveSelectedIds(idSet) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(Array.from(idSet)));
  } catch {}
}
// On first run (no stored filter), default to "all selected". After that, respect stored selection strictly.
function getSelectedSet(allIds = []) {
  if (!hasStoredFilter()) {
    const initial = new Set(allIds);
    saveSelectedIds(initial);
    return initial;
  }
  return loadSelectedIds();
}

function ensureViewControlsWired() {
  if (viewControlsWired) return;
  const editBtn = document.getElementById('edit-view-btn');
  const panel = document.getElementById('user-filter-panel');
  const selectAll = document.getElementById('filter-select-all');
  if (!editBtn || !panel || !selectAll) return;

  editBtn.addEventListener('click', () => {
    panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
  });

  selectAll.addEventListener('change', (e) => {
    const allIds = usersArray().map(u => u.id);
    if (e.target.checked) {
      const sel = new Set(allIds); // select all
      saveSelectedIds(sel);
    } else {
      saveSelectedIds(new Set()); // deselect all
    }
    updateFilterUI(usersArray());
    applyViewFilter();
  });

  viewControlsWired = true;
}

function updateFilterUI(users) {
  const list = document.getElementById('user-filter-list');
  const selectAll = document.getElementById('filter-select-all');
  if (!list || !selectAll) return;
  const sorted = [...users].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const allIds = sorted.map(u => u.id);
  const selected = getSelectedSet(allIds);

  // Build checkboxes
  list.innerHTML = sorted.map(u => {
    const name = u.name || u.id;
    const checked = selected.has(u.id) ? 'checked' : '';
    return `<label><input type="checkbox" data-user-id="${u.id}" ${checked}> ${name}</label>`;
  }).join('');

  // Wire each checkbox
  list.querySelectorAll('input[type="checkbox"][data-user-id]').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-user-id');
      const allIds2 = usersArray().map(u => u.id);
      const sel = getSelectedSet(allIds2);
      if (e.target.checked) sel.add(id); else sel.delete(id);
      saveSelectedIds(sel);
      // Update select-all state
      const allSelected = allIds2.every(uid => sel.has(uid));
      selectAll.checked = allSelected;
      applyViewFilter();
    });
  });

  // Update select-all state based on current selection
  const allSelected = allIds.every(uid => selected.has(uid));
  selectAll.checked = allSelected;
}

function dateKey(d = selectedDate) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function formatMMDDYYYY(d) {
  try {
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
}

function usersArray() {
  return Object.values(usersDataCache);
}

function startsWithYear(dateStr, year) {
  return typeof dateStr === 'string' && dateStr.startsWith(`${year}-`);
}

// Build Year-to-Date details HTML for modal (client-friendly)
function buildYtdHtml(year, users) {
  // Prepare per-user aggregates and sort for readability (Done desc, then WIP, then total)
  const sorted = [...users].map(u => {
    const name = u.name || u.id;
    const position = u.position || '';
    const tasks = (u && u.tasks) ? u.tasks : [];

    const done = tasks.filter(t => t.source === 'dailyReports' && t.status === 'done' && startsWithYear(t.completionDate, year)).length;
    const cancelled = tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && startsWithYear(t.completionDate, year)).length;
    const wip = tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'wip' && startsWithYear(t.creationDate, year)).length;
    const notStarted = tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'not-started' && startsWithYear(t.creationDate, year)).length;

    const total = done + cancelled + wip + notStarted;
    const pct = (n) => total ? Math.round((n / total) * 100) : 0;

    return {
      name, position, done, cancelled, wip, notStarted, total,
      pctDone: pct(done), pctWip: pct(wip), pctNS: pct(notStarted), pctCan: pct(cancelled)
    };
  }).sort((a, b) => (b.done - a.done) || (b.wip - a.wip) || (b.total - a.total));

  const items = sorted.map(item => {
    const secondary = item.position
      ? ` <span style="color: var(--secondary-color); font-weight:600; font-size:.85rem;">${item.position}</span>` : '';

    const chip = (label, count, bg, color) =>
      `<span style="display:inline-block;padding:.25rem .6rem;border-radius:9999px;font-size:.78rem;font-weight:700;background:${bg};color:${color};">${label}: ${count}</span>`;

    const chips = [
      chip('Done', item.done, 'var(--done-bg)', 'var(--done-text)'),
      chip('WIP', item.wip, 'var(--wip-bg)', '#8a6d00'),
      chip('Not Started', item.notStarted, 'var(--not-started-bg)', 'var(--not-started-text)'),
      chip('Cancelled', item.cancelled, 'var(--cancelled-bg)', 'var(--cancelled-text)')
    ].join(' ');

    const seg = (w, bg) => `<span style="display:inline-block;height:100%;width:${w}%;background:${bg};"></span>`;
    const bar = `
      <div style="height:10px;border-radius:9999px;background:#eef2f7;overflow:hidden;">
        ${seg(item.pctDone, 'var(--done-bg)')}
        ${seg(item.pctWip, 'var(--wip-bg)')}
        ${seg(item.pctNS, 'var(--not-started-bg)')}
        ${seg(item.pctCan, 'var(--cancelled-bg)')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem;margin-top:.35rem;color:var(--secondary-color);">
        <span>${item.total} tasks YTD</span>
        <span>${item.pctDone}% Done • ${item.pctWip}% WIP • ${item.pctNS}% Not Started • ${item.pctCan}% Cancelled</span>
      </div>
    `;

    return `
      <li class="detail-item">
        <div class="activity-text" style="display:flex;align-items:center;gap:.35rem;">
          <span>${item.name}</span>${secondary}
        </div>
        <div class="activity-description" style="margin:.4rem 0 .5rem 0;">${chips}</div>
        ${bar}
      </li>
    `;
  }).join('');

  return `
    <div class="details-section">
      <h4>Year to Date (${year})</h4>
      <ul class="details-list">${items || '<li class="detail-item none">No YTD data</li>'}</ul>
    </div>
  `;
}

// Build details HTML for modal
function buildDetailsHtml(user, key) {
  const tasks = (user && user.tasks) ? user.tasks : [];
  const completedToday = tasks.filter(t => t.source === 'dailyReports' && (t.status === 'done' || t.status === 'cancelled') && t.completionDate === key);
  const ongoingNow = tasks.filter(t => t.source === 'ongoingTasks' && (t.status === 'wip' || t.status === 'not-started'));
  const cancelledToday = tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && t.completionDate === key);

  const completedListHtml = completedToday.length
    ? completedToday.map(a => `
        <li class="detail-item ${a.status}">
          <div class="activity-text">${a.text || ''}</div>
          <div class="activity-description">${a.description || ''}</div>
        </li>
      `).join('')
    : `<li class="detail-item none">No completed activities for this date</li>`;

  const ongoingListHtml = ongoingNow.length
    ? ongoingNow.map(a => `
        <li class="detail-item ${a.status}">
          <div class="activity-text">${a.text || ''}</div>
          <div class="activity-description">${a.description || ''}</div>
        </li>
      `).join('')
    : `<li class="detail-item none">No ongoing activities</li>`;

  const cancelledListHtml = cancelledToday.length
    ? cancelledToday.map(a => `
        <li class="detail-item ${a.status}">
          <div class="activity-text">${a.text || ''}</div>
          <div class="activity-description">${a.description || ''}</div>
        </li>
      `).join('')
    : `<li class="detail-item none">No cancelled activities for this date</li>`;

  return `
    <div class="details-section">
      <h4>Completed Today</h4>
      <ul class="details-list">${completedListHtml}</ul>
    </div>
    <div class="details-section">
      <h4>Ongoing</h4>
      <ul class="details-list">${ongoingListHtml}</ul>
    </div>
    <div class="details-section">
      <h4>Cancelled</h4>
      <ul class="details-list">${cancelledListHtml}</ul>
    </div>
  `;
}

// Hide/show already-rendered cards based on current selection without re-rendering
function applyViewFilter() {
  const allUsers = usersArray();
  const selected = getSelectedSet(allUsers.map(u => u.id));
  const rightPanel = document.querySelector('.right-panel');
  if (!rightPanel) return;
  rightPanel.querySelectorAll('.user-summary-card').forEach(card => {
    const uid = card.getAttribute('data-user-id');
    const visible = !uid || selected.has(uid);
    card.style.display = visible ? '' : 'none';
  });
}

function upsertUser(uid, data) {
  usersDataCache[uid] = Object.assign({}, usersDataCache[uid] || { id: uid }, data);
}

function recomputeUserTasks(uid) {
  const u = usersDataCache[uid] || {};
  const daily = u.tasksDaily || [];
  const ongoing = u.tasksOngoing || [];
  upsertUser(uid, { tasks: [...daily, ...ongoing] });
}

function subscribeAllUsers() {
  if (usersUnsub) {
    try { usersUnsub(); } catch (e) {}
  }
  usersUnsub = db.collection("users").onSnapshot((usersSnap) => {
    usersSnap.docChanges().forEach((change) => {
      const doc = change.doc;
      const uid = doc.id;
      if (change.type === 'removed') {
        if (subUnsubs[uid]) {
          Object.values(subUnsubs[uid]).forEach(fn => { try { fn && fn(); } catch (e) {} });
          delete subUnsubs[uid];
        }
        delete usersDataCache[uid];
        renderAllUsers(selectedDate);
        return;
      }
      // added or modified
      upsertUser(uid, doc.data());
      if (!subUnsubs[uid]) {
        subUnsubs[uid] = {};
        subUnsubs[uid].daily = db.collection("users").doc(uid).collection("dailyReports").onSnapshot((snap) => {
          const dailyTasks = snap.docs.map(d => ({ ...d.data(), source: 'dailyReports' }));
          upsertUser(uid, { tasksDaily: dailyTasks });
          recomputeUserTasks(uid);
          renderAllUsers(selectedDate);
        });
        subUnsubs[uid].ongoing = db.collection("users").doc(uid).collection("ongoingTasks").onSnapshot((snap) => {
          const ongoingTasks = snap.docs.map(d => ({ ...d.data(), source: 'ongoingTasks' }));
          upsertUser(uid, { tasksOngoing: ongoingTasks });
          recomputeUserTasks(uid);
          renderAllUsers(selectedDate);
        });
        subUnsubs[uid].highlights = db.collection("users").doc(uid).collection("highlights").onSnapshot((snap) => {
          const highlights = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          upsertUser(uid, { highlights });
          renderAllUsers(selectedDate);
        });
      } else {
        renderAllUsers(selectedDate);
      }
    });
    // Always (re)wire the view controls and refresh the filter list after snapshot settles
    ensureViewControlsWired();
    updateFilterUI(usersArray());
    wireDetailsModal();
  });
}

async function renderAllUsers(date = selectedDate) {
  const key = dateKey(date);
  const rightPanel = document.querySelector('.right-panel');
  if (!rightPanel) return;

  const allUsersData = usersArray();
  // Apply saved view filter (selected users)
  const selected = getSelectedSet(allUsersData.map(u => u.id));
  const usersData = allUsersData.filter(u => selected.has(u.id));

  // Remove any previously rendered user cards
  rightPanel.querySelectorAll('.user-summary-card').forEach(el => el.remove());

  // Build cards per user
  const cardsHtml = usersData.map((user) => {
    const tasks = user.tasks || [];
    const doneCount = tasks.filter(t => t.source === 'dailyReports' && t.status === 'done' && t.completionDate === key).length;
    const cancelledCount = tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && t.completionDate === key).length;
    const wipCount = tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'wip').length;
    const notStartedCount = tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'not-started').length;
    const highlight = (user.highlights || []).find(h => h.id === key)?.content || 'None';
    const displayName = user.name || user.id;
    const position = user.position || 'N/A';
    // Build details (expanded) content
    const completedToday = tasks.filter(t => t.source === 'dailyReports' && (t.status === 'done' || t.status === 'cancelled') && t.completionDate === key);
    const ongoingNow = tasks.filter(t => t.source === 'ongoingTasks' && (t.status === 'wip' || t.status === 'not-started'));

    const cancelledToday = tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && t.completionDate === key);

    const completedListHtml = completedToday.length
      ? completedToday.map(a => `
          <li class="detail-item ${a.status}">
            <div class="activity-text">${a.text || ''}</div>
            <div class="activity-description">${a.description || ''}</div>
          </li>
        `).join('')
      : `<li class="detail-item none">No completed activities for this date</li>`;

    const ongoingListHtml = ongoingNow.length
      ? ongoingNow.map(a => `
          <li class="detail-item ${a.status}">
            <div class="activity-text">${a.text || ''}</div>
            <div class="activity-description">${a.description || ''}</div>
          </li>
        `).join('')
      : `<li class="detail-item none">No ongoing activities</li>`;


    const cancelledListHtml = cancelledToday.length
      ? cancelledToday.map(a => `
          <li class="detail-item ${a.status}">
            <div class="activity-text">${a.text || ''}</div>
            <div class="activity-description">${a.description || ''}</div>
          </li>
        `).join('')
      : `<li class="detail-item none">No cancelled activities for this date</li>`;

    return `
        <div class="user-summary-card" data-user-id="${user.id}">
            <h3>${displayName}<span class="user-position">${position}</span> <span class="user-date">${formatMMDDYYYY(date)}</span></h3>
            <div class="performance-grid-2">
                <div class="metric green">
                    <p>Done</p>
                    <p class="value">${doneCount}</p>
                </div>
                <div class="metric yellow">
                    <p>WIP</p>
                    <p class="value">${wipCount}</p>
                </div>
                <div class="metric blue">
                    <p>Not Started</p>
                    <p class="value">${notStartedCount}</p>
                </div>
                <div class="metric orange">
                    <p>Cancelled</p>
                    <p class="value">${cancelledCount}</p>
                </div>
            </div>
            <div class="highlight" style="margin-top: .5rem;">
                <strong>Highlight:</strong> ${highlight}
            </div>

            
        </div>
    `;
  }).join('');

  // Insert cards before the admin error area if present, else append to rightPanel
  const errorEl = rightPanel.querySelector('#admin-error');
  if (errorEl) {
    errorEl.insertAdjacentHTML('beforebegin', cardsHtml);
  } else {
    rightPanel.insertAdjacentHTML('beforeend', cardsHtml);
  }

  // Wire metrics click to open details modal
  const cards = Array.from(rightPanel.querySelectorAll('.user-summary-card'));
  cards.forEach(card => {
    const metrics = card.querySelector('.performance-grid-2');
    metrics?.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = card.getAttribute('data-user-id');
      const user = allUsersData.find(u => u.id === uid);
      const title = `${(user?.name || uid)} — ${formatMMDDYYYY(date)}`;
      const html = buildDetailsHtml(user, key);
      openDetailsModal(title, html);
    });
  });

  // Wire YTD click to open per-user YTD modal
  const ytdYear = new Date(date).getFullYear();
  ['admin-ytd-done','admin-ytd-wip','admin-ytd-not-started','admin-ytd-cancelled'].forEach(id => {
    const el = document.getElementById(id);
    const target = el?.parentElement || el;
    target?.addEventListener('click', (e) => {
      e.stopPropagation();
      const html = buildYtdHtml(ytdYear, allUsersData);
      openDetailsModal(`Year to Date — ${ytdYear}`, html);
    }, { once: false });
  });

  // Ensure view filter applied to the freshly rendered cards
  applyViewFilter();

  // Aggregate overall daily and YTD counters (ALL users, not filtered)
  const year = new Date(date).getFullYear();

  let dailyDone = 0, dailyCancelled = 0, dailyWip = 0, dailyNotStarted = 0;
  let ytdDone = 0, ytdCancelled = 0, ytdWip = 0, ytdNotStarted = 0;

  allUsersData.forEach(user => {
    const tasks = user.tasks || [];

    // Daily aggregates (selected date)
    dailyDone += tasks.filter(t => t.source === 'dailyReports' && t.status === 'done' && t.completionDate === key).length;
    dailyCancelled += tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && t.completionDate === key).length;
    dailyWip += tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'wip').length;
    dailyNotStarted += tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'not-started').length;

    // YTD aggregates
    ytdDone += tasks.filter(t => t.source === 'dailyReports' && t.status === 'done' && startsWithYear(t.completionDate, year)).length;
    ytdCancelled += tasks.filter(t => t.source === 'dailyReports' && t.status === 'cancelled' && startsWithYear(t.completionDate, year)).length;
    ytdWip += tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'wip' && startsWithYear(t.creationDate, year)).length;
    ytdNotStarted += tasks.filter(t => t.source === 'ongoingTasks' && t.status === 'not-started' && startsWithYear(t.creationDate, year)).length;
  });

  // Update Overall Daily Performance counters
  const dailyIds = {
    done: 'admin-daily-done',
    wip: 'admin-daily-wip',
    notStarted: 'admin-daily-not-started',
    cancelled: 'admin-daily-cancelled'
  };
  const dailyElDone = document.getElementById(dailyIds.done);
  const dailyElWip = document.getElementById(dailyIds.wip);
  const dailyElNS = document.getElementById(dailyIds.notStarted);
  const dailyElCan = document.getElementById(dailyIds.cancelled);
  if (dailyElDone) dailyElDone.textContent = String(dailyDone);
  if (dailyElWip) dailyElWip.textContent = String(dailyWip);
  if (dailyElNS) dailyElNS.textContent = String(dailyNotStarted);
  if (dailyElCan) dailyElCan.textContent = String(dailyCancelled);

  // Update Year-to-Date Performance counters
  const ytdIds = {
    done: 'admin-ytd-done',
    wip: 'admin-ytd-wip',
    notStarted: 'admin-ytd-not-started',
    cancelled: 'admin-ytd-cancelled'
  };
  const ytdElDone = document.getElementById(ytdIds.done);
  const ytdElWip = document.getElementById(ytdIds.wip);
  const ytdElNS = document.getElementById(ytdIds.notStarted);
  const ytdElCan = document.getElementById(ytdIds.cancelled);
  if (ytdElDone) ytdElDone.textContent = String(ytdDone);
  if (ytdElWip) ytdElWip.textContent = String(ytdWip);
  if (ytdElNS) ytdElNS.textContent = String(ytdNotStarted);
  if (ytdElCan) ytdElCan.textContent = String(ytdCancelled);
}

function initAdminCalendar() {
  const dateDisplay = document.getElementById('date-display');
  const calendarPopup = document.getElementById('calendar-popup');
  const currentMonthYearSpan = document.getElementById('current-month-year');
  const prevMonthBtn = document.getElementById('prev-month-btn');
  const nextMonthBtn = document.getElementById('next-month-btn');
  const calendarGrid = document.getElementById('calendar-grid');
  const todayBtn = document.getElementById('today-btn');

  function updateDateDisplay() {
    if (dateDisplay) dateDisplay.textContent = dateKey(selectedDate);
  }

  function renderCalendar() {
    if (!calendarGrid || !currentMonthYearSpan) return;
    calendarGrid.innerHTML = '';
    currentMonthYearSpan.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    for (let i = 0; i < startDay; i++) {
      const blankDay = document.createElement('div');
      blankDay.className = 'day other-month';
      calendarGrid.appendChild(blankDay);
    }

    const todayStr = dateKey(new Date());
    const selectedStr = dateKey(selectedDate);

    for (let i = 1; i <= totalDays; i++) {
      const dayEl = document.createElement('div');
      dayEl.textContent = i;
      dayEl.className = 'day current-month';
      const thisDate = new Date(year, month, i, 12);
      const thisKey = dateKey(thisDate);

      if (thisKey === todayStr) dayEl.classList.add('today');
      if (thisKey === selectedStr) dayEl.classList.add('selected');

      dayEl.addEventListener('click', () => {
        selectedDate = thisDate;
        updateDateDisplay();
        renderAllUsers(selectedDate);
        if (calendarPopup) calendarPopup.style.display = 'none';
        renderCalendar();
      });

      calendarGrid.appendChild(dayEl);
    }
  }

  if (dateDisplay) {
    dateDisplay.addEventListener('click', () => {
      if (!calendarPopup) return;
      calendarPopup.style.display = calendarPopup.style.display === 'block' ? 'none' : 'block';
    });
  }

  if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
  });

  if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
  });

  if (todayBtn) todayBtn.addEventListener('click', () => {
    selectedDate = new Date();
    currentCalendarDate = new Date();
    updateDateDisplay();
    renderAllUsers(selectedDate);
    renderCalendar();
    if (calendarPopup) calendarPopup.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!calendarPopup || !dateDisplay) return;
    const isInside = calendarPopup.contains(e.target) || dateDisplay.contains(e.target);
    if (!isInside && calendarPopup.style.display === 'block') {
      calendarPopup.style.display = 'none';
    }
  });

  updateDateDisplay();
  renderCalendar();
}

// Expose functions for admin.html
window.initAdminCalendar = initAdminCalendar;
window.renderAllUsers = renderAllUsers;
window.startAdminRealtime = subscribeAllUsers;