/*
 * File: script.js
 */
import {
    registerUser,
    updateUserProfile,
    loginUser,
    resetPassword,
    logoutUser,
    setupAuthChangeListener,
    saveUserDetailsToFirestore,
    getAllUserDataFromFirestore,
    getDailyActivities,
    addActivityToDailyReport,
    updateActivityStatus,
    deleteActivity
} from './auth.js';

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

    // New notification container element
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

    let authMode = 'login';
    const statusOptions = {
        'not-started': { text: 'Not Started', class: 'not-started', dotColor: 'var(--not-started-text)' },
        'wip': { text: 'Work in Progress', class: 'wip', dotColor: 'var(--wip-text)' },
        'done': { text: 'Done', class: 'done', dotColor: 'var(--done-text)' },
        'cancelled': { text: 'Cancelled', class: 'cancelled', dotColor: 'var(--cancelled-text)' }
    };

    // --- New Notification Function ---
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 5000); // Notification automatically hides after 5 seconds
    }

    // --- Helper function to format date as YYYY-MM-DD ---
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Function to render the calendar grid ---
    function renderCalendar() {
        //-- day highlight function --//

        
        calendarGrid.innerHTML = '';
        currentMonthYearSpan.textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
                selectedDate = new Date(year, month, i);
                updateUI();
            });

            calendarGrid.appendChild(dayEl);
        }
    }

    // --- Helper function to close the activity modal ---
    function closeActivityModal() {
        addActivityModal.style.display = 'none';
        activityInput.value = '';
    }

    // --- Helper function to add a new activity (now with Firestore) ---
    async function addNewActivity() {
        const activityText = activityInput.value.trim();
        const activityStatus = modalStatus;
        const formattedDate = formatDate(selectedDate);

        if (activityText && currentUserId) {
            const now = new Date();
            const timestamp = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Los_Angeles'
            });
            const newActivity = {
                id: Date.now(),
                text: activityText,
                status: activityStatus,
                timestamp: timestamp
            };
            
            try {
                await addActivityToDailyReport(currentUserId, formattedDate, newActivity, activityStatus);
                showNotification('Activity added successfully!');
                updateUI();
            } catch (error) {
                showNotification('Failed to add activity: ' + error.message, 'error');
            }
            closeActivityModal();
        } else if (!activityText) {
            showNotification('Please enter an activity.', 'error');
        }
    }

    // --- Helper function to fetch data and update the UI from Firestore ---
    async function updateUI() {
        if (!currentUserId) return;

        const formattedDate = formatDate(selectedDate);
        dateDisplay.textContent = formattedDate;
        reportDateSpan.textContent = formattedDate;

        try {
            const userData = await getAllUserDataFromFirestore(currentUserId);
            if (userData && userData.performanceSummary) {
                overallPerformance = userData.performanceSummary;
                overallPerformanceValues.done.textContent = overallPerformance.done;
                overallPerformanceValues.wip.textContent = overallPerformance.wip;
                overallPerformanceValues['not-started'].textContent = overallPerformance['not-started'];
                overallPerformanceValues.cancelled.textContent = overallPerformance.cancelled;
            } else {
                overallPerformance = { done: 0, wip: 0, 'not-started': 0, cancelled: 0 };
                overallPerformanceValues.done.textContent = 0;
                overallPerformanceValues.wip.textContent = 0;
                overallPerformanceValues['not-started'].textContent = 0;
                overallPerformanceValues.cancelled.textContent = 0;
            }

            const todayData = await getDailyActivities(currentUserId, formattedDate);
            
            todayPerformanceValues.done.textContent = todayData ? todayData.done || 0 : 0;
            todayPerformanceValues.wip.textContent = todayData ? todayData.wip || 0 : 0;
            todayPerformanceValues['not-started'].textContent = todayData ? todayData['not-started'] || 0 : 0;
            todayPerformanceValues.cancelled.textContent = todayData ? todayData.cancelled || 0 : 0;

            dailyActivitiesList.innerHTML = '';
            if (todayData && todayData.activities && todayData.activities.length > 0) {
                noReportMessage.style.display = 'none';
                dailyActivitiesList.style.display = 'grid';
                const sortedActivities = todayData.activities.sort((a, b) => {
                    const timeA = new Date(`2000/01/01 ${a.timestamp}`);
                    const timeB = new Date(`2000/01/01 ${b.timestamp}`);
                    return timeA - timeB;
                });

                sortedActivities.forEach(activity => {
                    const card = document.createElement('div');
                    card.className = `daily-report-card ${activity.status}`;
                    card.dataset.activityId = activity.id;
                    card.dataset.activity = JSON.stringify(activity);
                    const currentStatus = statusOptions[activity.status] || statusOptions['not-started']; // Fallback to a default status
                    const dropdownHtml = `
 <div class="status-dropdown">
 <button class="status-dropdown-button" style="background-color: var(--${currentStatus.class}-bg); color: var(--${currentStatus.class}-text);">
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
            renderCalendar();
        } catch (error) {
            showNotification('Failed to load user data: ' + error.message, 'error');
        }
    }

    // --- Authentication UI Functions ---
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
        updateUI();
    }

    // --- Event Listeners ---
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
                await saveUserDetailsToFirestore(userCredential.user.uid, { name, client, position });
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

    // Calendar logic
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

    document.addEventListener('click', (e) => {
        if (!calendarPopup.contains(e.target) && e.target !== dateDisplay) {
            calendarPopup.style.display = 'none';
        }
    });

    // Activity modal
    plusButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const statusCard = e.target.closest('.metric');
            if (statusCard) {
                modalStatus = statusCard.querySelector('.value').dataset.overall || statusCard.dataset.today;
                addActivityModal.querySelector('.modal-title').textContent = `Add a new activity`;
                addActivityModal.style.display = 'flex';
            }
        });
    });

    // Close modal when clicking on the close button
    document.querySelector('#add-activity-modal .modal-close-btn').addEventListener('click', () => {
        closeActivityModal();
    });

    // Close modal when clicking outside
    addActivityModal.addEventListener('click', (e) => {
        if (e.target === addActivityModal) {
            closeActivityModal();
        }
    });

    // Handle form submission inside modal
    addActivityBtn.addEventListener('click', addNewActivity);

    // Initial setup
    setupAuthChangeListener(
        (user) => {
            if (user) {
                showDashboard(user);
            } else {
                showAuthForm('login');
            }
        },
        (error) => {
            showNotification('Authentication state change failed: ' + error.message, 'error');
        }
    );

    // Delegated event listener for status updates
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
            const formattedDate = formatDate(selectedDate);

            if (currentUserId && activity && newStatus) {
                try {
                    await updateActivityStatus(currentUserId, formattedDate, activity, newStatus);
                    showNotification(`Activity status updated to "${statusOptions[newStatus].text}"`);
                    updateUI();
                } catch (error) {
                    showNotification('Failed to update activity status: ' + error.message, 'error');
                }
            }
            document.querySelector('.status-dropdown.show').classList.remove('show');
            return;
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const card = e.target.closest('.daily-report-card');
            const activityId = card.dataset.activityId;
            const activity = JSON.parse(card.dataset.activity);
            const formattedDate = formatDate(selectedDate);
            if (currentUserId && activityId) {
                try {
                    await deleteActivity(currentUserId, formattedDate, activity, activity.status);
                    showNotification('Activity deleted successfully!');
                    updateUI();
                } catch (error) {
                    showNotification('Failed to delete activity: ' + error.message, 'error');
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
