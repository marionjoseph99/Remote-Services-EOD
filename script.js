// File: script.js
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
    const todayBtn = document.getElementById('today-btn'); // New element for "Today" button

    const addActivityModal = document.getElementById('add-activity-modal');
    const activityInput = document.getElementById('activity-input');
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

    let overallPerformance = {
        done: 0,
        wip: 0,
        'not-started': 0,
        cancelled: 0,
    };
    let dailyPerformance = {};
    let selectedDate = new Date();
    let currentCalendarDate = new Date();
    let currentUserId = null;
    let modalStatus;

    // Unsubscribe functions for real-time listeners
    let unsubscribeDaily = null;
    let unsubscribeOngoing = null;

    let authMode = 'login';
    const statusOptions = {
        'not-started': {
            text: 'Not Started',
            class: 'not-started',
            dotColor: 'var(--not-started-text)'
        },
        'wip': {
            text: 'Work in Progress',
            class: 'wip',
            dotColor: 'var(--wip-text)'
        },
        'done': {
            text: 'Done',
            class: 'done',
            dotColor: 'var(--done-text)'
        },
        'cancelled': {
            text: 'Cancelled',
            class: 'cancelled',
            dotColor: 'var(--cancelled-text)'
        }
    };

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

    function calculateTodayPerformance(dailyActivities, ongoingTasks) {
        if (!currentUserId) return;

        let doneCount = 0;
        let cancelledCount = 0;
        if (dailyActivities) {
            dailyActivities.forEach(activity => {
                if (activity.status === 'done') doneCount++;
                if (activity.status === 'cancelled') cancelledCount++;
            });
        }

        let wipCount = 0;
        let notStartedCount = 0;
        if (ongoingTasks) {
            ongoingTasks.forEach(task => {
                if (task.status === 'wip') wipCount++;
                if (task.status === 'not-started') notStartedCount++;
            });
        }

        todayPerformanceValues.done.textContent = doneCount;
        todayPerformanceValues.wip.textContent = wipCount;
        todayPerformanceValues['not-started'].textContent = notStartedCount;
        todayPerformanceValues.cancelled.textContent = cancelledCount;
    }


    /**
     * Renders ONLY wip/not-started tasks from the ongoingTasks collection
     * @param {Array} ongoingTasks - The array of tasks to render.
     */
    function renderOngoingTasks(ongoingTasks) {
        if (!currentUserId) return;

        const container = document.querySelector('.ongoing-tasks-content');
        container.innerHTML = '';

        if (ongoingTasks.length === 0) {
            container.innerHTML = '<div class="no-tasks">No ongoing tasks found</div>';
            return;
        }

        ongoingTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `daily-report-card ${task.status}`;
            taskEl.dataset.activityId = task.id;
            taskEl.dataset.activity = JSON.stringify(task);
            taskEl.dataset.date = task.creationDate;

            const currentStatus = statusOptions[task.status] || statusOptions['not-started'];
            const dropdownHtml = `
                <div class="status-dropdown">
                    <button class="status-dropdown-button">
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

            taskEl.innerHTML = `
                <div class="activity-text-container">
                    <span class="activity-text">${task.text}</span>
                    <span class="timestamp">Created on: ${task.creationDate}</span>
                </div>
                <div class="controls">
                    ${dropdownHtml}
                    <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            container.appendChild(taskEl);
        });
    }

    /**
     * Renders daily report tasks from the dailyReports collection
     * @param {Array} dailyActivities - The array of tasks to render.
     */
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
                const card = document.createElement('div');
                card.className = `daily-report-card ${activity.status}`;
                card.dataset.activityId = activity.id;
                card.dataset.activity = JSON.stringify(activity);
                card.dataset.date = activity.completionDate; // Use completionDate from activity
                const currentStatus = statusOptions[activity.status] || statusOptions['not-started'];
                const dropdownHtml = `
                    <div class="status-dropdown">
                        <button class="status-dropdown-button">
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
                card.innerHTML = `
                    <div class="activity-text-container">
                        <span class="activity-text">${activity.text}</span>
                        <span class="timestamp">${activity.timestamp}</span>
                    </div>
                    <div class="controls">
                        ${dropdownHtml}
                        <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
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
                // Create the date in CST to avoid timezone issues
                selectedDate = new Date(parts[0], parts[1] - 1, parts[2], 12); // Using 12pm to avoid timezone shift
                updateUI(currentUserId, selectedDate);
            });

            calendarGrid.appendChild(dayEl);
        }
    }

    function closeActivityModal() {
        addActivityModal.style.display = 'none';
        activityInput.value = '';
    }

    function updateOverallPerformanceUI() {
        if (!overallPerformanceValues) return;
        overallPerformanceValues.done.textContent = overallPerformance.done;
        overallPerformanceValues.wip.textContent = overallPerformance.wip;
        overallPerformanceValues['not-started'].textContent = overallPerformance['not-started'];
        overallPerformanceValues.cancelled.textContent = overallPerformance.cancelled;
    }


    // New function to handle optimistic UI update for adding a task
    async function addNewActivity() {
        const activityText = activityInput.value.trim();
        const activityStatus = modalStatus;
        const formattedDate = formatDate(selectedDate); // Corrected to use selectedDate

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
                status: activityStatus,
                timestamp: timestamp,
            };

            // Set creationDate or completionDate based on status
            if (activityStatus === 'done' || activityStatus === 'cancelled') {
                newActivity.completionDate = formattedDate;
            } else {
                newActivity.creationDate = formattedDate;
            }


            // Optimistically update the UI by manually creating a card
            const container = (activityStatus === 'done' || activityStatus === 'cancelled') ? dailyActivitiesList : ongoingTasksContent;
            const newCard = createActivityCard(newActivity);

            // Only append the card if the date matches the current view
            const currentFormattedDate = formatDate(selectedDate);
            if (formattedDate === currentFormattedDate || (activityStatus === 'wip' || activityStatus === 'not-started')) {
                container.appendChild(newCard);
            }

            // Optimistically update overall performance counters
            const oldOverallPerformance = { ...overallPerformance
            };
            if (overallPerformance[activityStatus] !== undefined) {
                overallPerformance[activityStatus]++;
                updateOverallPerformanceUI();
            }

            try {
                await addActivity(currentUserId, newActivity);
                showNotification('Activity added successfully!');
            } catch (error) {
                showNotification('Failed to add activity: ' + error.message, 'error');
                // Revert the optimistic UI update on failure
                newCard.remove();
                overallPerformance = oldOverallPerformance;
                updateOverallPerformanceUI();
            }
            closeActivityModal();
        } else if (!activityText) {
            showNotification('Please enter an activity.', 'error');
        }
    }

    /**
     * Main function to set up listeners and render the UI.
     */
    async function updateUI(userId, date) {
        if (!userId) return;

        const formattedDate = formatDate(date);
        dateDisplay.textContent = formattedDate;
        reportDateSpan.textContent = formattedDate;

        // Unsubscribe from the previous daily listener if it exists
        if (unsubscribeDaily) unsubscribeDaily();

        // Set up a new real-time listener for the selected date
        unsubscribeDaily = setupDailyActivitiesListener(userId, formattedDate, (activities) => {
            renderDailyActivities(activities);
            // We also need to recalculate today's performance when the date changes
            const ongoingTasks = document.querySelectorAll('.ongoing-tasks-content .daily-report-card');
            calculateTodayPerformance(activities, ongoingTasks);
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

    /**
     * Creates an activity card element.
     * @param {object} activity - The activity object.
     * @returns {HTMLElement} The created card element.
     */
    function createActivityCard(activity) {
        const card = document.createElement('div');
        card.className = `daily-report-card ${activity.status}`;
        card.dataset.activityId = activity.id;
        card.dataset.activity = JSON.stringify(activity);
        card.dataset.date = activity.creationDate || activity.completionDate;
        const currentStatus = statusOptions[activity.status] || statusOptions['not-started'];
        const dropdownHtml = `
            <div class="status-dropdown">
                <button class="status-dropdown-button">
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
                <span class="timestamp">${dateDisplay}</span>
            </div>
            <div class="controls">
                ${dropdownHtml}
                <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        return card;
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
        authContainer.style.display = 'none';
        dashboardContainer.style.display = 'flex';
        currentUserId = user.uid;

        // Unsubscribe from previous ongoing listener if it exists
        if (unsubscribeOngoing) unsubscribeOngoing();

        // Set up the ongoing tasks listener which is not date-specific
        unsubscribeOngoing = setupOngoingTasksListener(currentUserId, (tasks) => {
            renderOngoingTasks(tasks);
            // This is now the source of truth, so we use it to calculate today's performance
            const dailyActivities = document.querySelectorAll('.daily-reports .daily-report-card');
            calculateTodayPerformance(dailyActivities, tasks);
        });

        const userData = await getAllUserDataFromFirestore(user.uid);
        if (userData) {
            userNameSpan.textContent = userData.name || user.displayName || 'User';
            userClientSpan.textContent = userData.client || 'N/A';
            userPositionSpan.textContent = userData.position || 'N/A';
        } else {
            userNameSpan.textContent = user.displayName || 'User';
            userClientSpan.textContent = 'N/A';
            userPositionSpan.textContent = 'N/A';
        }

        updateUI(user.uid, new Date());
        renderCalendar();
    }

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
        renderCalendar();
        calendarPopup.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (!calendarPopup.contains(e.target) && e.target !== dateDisplay && e.target.closest('#calendar-popup') === null) {
            calendarPopup.style.display = 'none';
        }
    });

    plusButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const statusCard = e.target.closest('.metric');
            if (statusCard) {
                modalStatus = statusCard.dataset.today;
                addActivityModal.querySelector('.modal-title').textContent = `Add a new activity`;
                addActivityModal.style.display = 'flex';
            }
        });
    });

    document.querySelector('#add-activity-modal .modal-close-btn').addEventListener('click', () => {
        closeActivityModal();
    });

    addActivityModal.addEventListener('click', (e) => {
        if (e.target === addActivityModal) {
            closeActivityModal();
        }
    });

    addActivityBtn.addEventListener('click', addNewActivity);

    document.querySelector('.ongoing-tasks-header').addEventListener('click', () => {
        const content = document.querySelector('.ongoing-tasks-content');
        const toggleBtn = document.querySelector('.collapse-toggle');

        content.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
    });

    setupAuthChangeListener(
        (user) => {
            if (user) {
                // Set the selected date to today when the user logs in or refreshes
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

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
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
                // Revert the UI on failure
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

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
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

    document.addEventListener('click', (e) => {
        const isClickInsideDropdown = e.target.closest('.status-dropdown');
        if (!isClickInsideDropdown) {
            document.querySelectorAll('.status-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });

});