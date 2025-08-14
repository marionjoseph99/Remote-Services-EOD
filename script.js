// File: script.js
import { HighlightManager } from './highlight.js';

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
    db
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

    // Highlight Elements
    const highlightDisplay = document.getElementById('highlight-display');
    const highlightEdit = document.getElementById('highlight-edit');
    const highlightEditBtn = document.getElementById('highlight-edit-btn');
    const highlightSaveBtn = document.getElementById('highlight-save-btn');
    const highlightCancelBtn = document.getElementById('highlight-cancel-btn');
    
    console.log('Highlight elements:', {
        highlightDisplay,
        highlightEdit,
        highlightEditBtn
    });
    

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

    // Unsubscribe functions for real-time listeners
    let unsubscribeDaily = null;
    let unsubscribeOngoing = null;

    // Data from listeners
    let dailyActivitiesData = [];
    let ongoingTasksData = [];

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
    function updateHighlightManagerDate(date) {
    if (highlightManager) {
        highlightManager.setDate(date);
        setupHighlightUI(); // Refresh the highlight UI with new date
    }
}

    // Highlight Functions
    async function setupHighlightUI() {
    if (!highlightManager) return;

    const highlightDisplay = document.getElementById('highlight-display');
    const highlightEditorContainer = document.getElementById('highlight-editor');
    const editBtn = document.getElementById('highlight-edit-btn');
    const saveBtn = document.getElementById('highlight-save-btn');
    const cancelBtn = document.getElementById('highlight-cancel-btn');

    // Initialize Quill with default toolbar
    if (!window.quillHighlight) {
        window.quillHighlight = new Quill('#highlight-quill', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });
    }
    const quill = window.quillHighlight;

    // Load and display highlight
    async function loadHighlight() {
        const content = await highlightManager.load();
        highlightDisplay.innerHTML = content ? content : '';
        highlightDisplay.dataset.placeholder = "Click edit to add today's highlight";
        updatePlaceholder();
    }

    function updatePlaceholder() {
        if (!highlightDisplay.innerHTML.trim()) {
            highlightDisplay.classList.add('empty');
        } else {
            highlightDisplay.classList.remove('empty');
        }
    }

    function toggleEditMode(editing) {
        if (editing) {
            highlightDisplay.style.display = 'none';
            highlightEditorContainer.style.display = 'block';
            quill.root.innerHTML = highlightDisplay.innerHTML;
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-flex';
            cancelBtn.style.display = 'inline-flex';
        } else {
            highlightDisplay.style.display = 'block';
            highlightEditorContainer.style.display = 'none';
            editBtn.style.display = 'inline-flex';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
    }

    editBtn.addEventListener('click', () => toggleEditMode(true));

    cancelBtn.addEventListener('click', () => {
        toggleEditMode(false);
    });

    saveBtn.addEventListener('click', async () => {
        const newContent = quill.root.innerHTML.trim();
        try {
            await highlightManager.save(newContent);
            highlightDisplay.innerHTML = newContent;
            toggleEditMode(false);
            updatePlaceholder();
            showNotification('Highlight saved!');
        } catch (error) {
            showNotification('Failed to save highlight', 'error');
        }
    });

    // Initial load
    await loadHighlight();

    // Update placeholder when content changes (for non-input events)
    const observer = new MutationObserver(updatePlaceholder);
    observer.observe(highlightDisplay, { childList: true, subtree: true });
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

    function renderCalendar() {
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
            dayEl.addEventListener('click', () => {
            const parts = dateString.split('-');
            selectedDate = new Date(parts[0], parts[1] - 1, parts[2], 12);
            updateUI(currentUserId, selectedDate);
            updateHighlightManagerDate(selectedDate); // Fixed function name
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
    

    // Initialize highlight manager
    highlightManager = new HighlightManager(user.uid, selectedDate);

    try {
        await setupHighlightUI();

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
        renderCalendar();
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

    dateDisplay.addEventListener('click', () => {
        calendarPopup.style.display = calendarPopup.style.display === 'block' ? 'none' : 'block';
    });

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    todayBtn.addEventListener('click', () => {
        selectedDate = new Date();
        currentCalendarDate = new Date();
        updateUI(currentUserId, selectedDate);
        updateHighlightManagerDate(selectedDate);
        renderCalendar();
        calendarPopup.style.display = 'none';
    });

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

    document.addEventListener('click', function(event) {
        const calendarPopup = document.querySelector('.calendar-popup');
        const dateDisplay = document.getElementById('date-display');
        if (!calendarPopup) return;

        // If the popup is open and the click is outside both the popup and the button
        if (
            calendarPopup.style.display === 'block' &&
            !calendarPopup.contains(event.target) &&
            (!dateDisplay || !dateDisplay.contains(event.target))
        ) {
            calendarPopup.style.display = 'none';
        }
    });
});
