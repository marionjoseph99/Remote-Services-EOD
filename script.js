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

    // Custom Message Modal Elements
    const messageModal = document.getElementById('message-modal');
    const messageTitle = document.getElementById('message-title');
    const messageText = document.getElementById('message-text');
    const messageCloseBtn = document.getElementById('message-close-btn');

    let overallPerformance = {
        done: 0,
        wip: 0,
        'not-started': 0,
        cancelled: 0,
    };
    let dailyPerformance = {}; // Stores activities for the selected day only
    let selectedDate = new Date();
    let currentCalendarDate = new Date();
    let currentUserId = null; // Store the current user's UID
    let modalStatus; // FIX: Declare modalStatus in a shared scope

    let authMode = 'login';

    // --- Custom Message Modal Functions ---
    function showMessage(title, message) {
        messageTitle.textContent = title;
        messageText.textContent = message;
        messageModal.style.display = 'flex';
    }

    function closeMessageModal() {
        messageModal.style.display = 'none';
    }

    messageCloseBtn.addEventListener('click', closeMessageModal);
    messageModal.addEventListener('click', (event) => {
        if (event.target === messageModal) {
            closeMessageModal();
        }
    });

    // --- Helper function to format date as YYYY-MM-DD ---
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Function to render the calendar grid ---
    function renderCalendar() {
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
                selectedDate = new Date(dateString);
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
                showMessage('Success', 'Activity added successfully!');
                updateUI();
            } catch (error) {
                showMessage('Error', 'Failed to add activity: ' + error.message);
            }
            closeActivityModal();
        } else if (!activityText) {
            showMessage('Input Error', 'Please enter an activity.');
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
                    const li = document.createElement('div');
                    li.className = `daily-report-card ${activity.status}`;
                    li.dataset.activityId = activity.id;
                    li.dataset.activity = JSON.stringify(activity);
                    li.innerHTML = `
                        <div class="activity-text-container">
                            <span class="activity-text">${activity.text}</span>
                            <span class="timestamp">${activity.timestamp}</span>
                        </div>
                        <div class="controls">
                            <select class="status-select">
                                <option value="done" ${activity.status === 'done' ? 'selected' : ''}>Done</option>
                                <option value="wip" ${activity.status === 'wip' ? 'selected' : ''}>Work in Progress</option>
                                <option value="not-started" ${activity.status === 'not-started' ? 'selected' : ''}>Not Yet Started</option>
                                <option value="cancelled" ${activity.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                            <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    `;
                    dailyActivitiesList.appendChild(li);
                });
            } else {
                noReportMessage.style.display = 'block';
                dailyActivitiesList.style.display = 'none';
            }
            renderCalendar();
        } catch (error) {
            showMessage('Data Fetch Error', 'Failed to load user data: ' + error.message);
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
        
        userNameSpan.textContent = userData ? userData.name : 'N/A';
        userClientSpan.textContent = userData ? userData.client : 'N/A';
        userPositionSpan.textContent = userData ? userData.position : 'N/A';

        updateUI();
    }

    // --- Event Listeners for Authentication Forms ---
    authForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = authEmailInput.value;
        const password = authPasswordInput.value;
        const name = authNameInput.value;
        const client = authClientInput.value;
        const position = authPositionInput.value;

        try {
            if (authMode === 'login') {
                await loginUser(email, password);
                showMessage('Success', 'Logged in successfully!');
            } else if (authMode === 'register') {
                if (!name || !client || !position) {
                    showMessage('Registration Error', 'Please fill in all registration details.');
                    return;
                }
                const userCredential = await registerUser(email, password);
                const user = userCredential.user;
                await updateUserProfile(user, name);
                await saveUserDetailsToFirestore(user.uid, { name, client, position });

                showMessage('Success', 'Account created successfully! You are now logged in.');
            } else if (authMode === 'forgot-password') {
                await resetPassword(email);
                showMessage('Password Reset', 'If an account with that email exists, a password reset link has been sent.');
                showAuthForm('login');
            }
        } catch (error) {
            let errorMessage = 'An unknown error occurred.';
            if (error.code) {
                switch (error.code) {
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'Your account has been disabled.';
                        break;
                    case 'auth/user-not-found':
                        errorMessage = 'No user found with this email.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password.';
                        break;
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already in use.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password should be at least 6 characters.';
                        break;
                    case 'auth/missing-password':
                        errorMessage = 'Please enter a password.';
                        break;
                    default:
                        errorMessage = error.message;
                }
            }
            showMessage('Authentication Error', errorMessage);
        }
    });

    showRegisterLink.addEventListener('click', (event) => {
        event.preventDefault();
        showAuthForm('register');
    });

    showForgotPasswordLink.addEventListener('click', (event) => {
        event.preventDefault();
        showAuthForm('forgot-password');
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await logoutUser();
            showMessage('Logged Out', 'You have been successfully logged out.');
        } catch (error) {
            showMessage('Logout Error', 'Failed to log out: ' + error.message);
        }
    });

    // --- Firebase Authentication State Change Listener ---
    setupAuthChangeListener((user) => {
        if (user) {
            console.log("Auth state changed: User is logged in", user);
            showDashboard(user);
        } else {
            console.log("Auth state changed: User is logged out");
            currentUserId = null;
            showAuthForm('login');
            overallPerformance = { done: 0, wip: 0, 'not-started': 0, cancelled: 0 };
            dailyPerformance = {};
            updateUI(); 
        }
    });

    // --- Event listener to toggle the calendar popup ---
    dateDisplay.addEventListener('click', () => {
        calendarPopup.style.display = calendarPopup.style.display === 'block' ? 'none' : 'block';
    });

    // --- Event listeners to navigate calendar months ---
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });

    // --- Event listeners to open the activity modal ---
    plusButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const card = event.target.closest('.metric');
            if (card) {
                modalStatus = card.dataset.status;
                addActivityModal.style.display = 'flex';
                activityInput.focus();
            }
        });
    });
    
    addActivityBtn.addEventListener('click', addNewActivity);

    // Event listeners to close the activity modal
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && addActivityModal.style.display === 'flex') {
            closeActivityModal();
        }
    });

    addActivityModal.addEventListener('click', (event) => {
        if (event.target === addActivityModal) {
            closeActivityModal();
        }
    });

    activityInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            addNewActivity();
        }
    });

    // Event delegation for Daily Reports (status change)
    dailyActivitiesList.addEventListener('change', async (event) => {
        const target = event.target;
        if (target.classList.contains('status-select') && currentUserId) {
            const card = target.closest('.daily-report-card');
            const newStatus = target.value;
            const formattedDate = formatDate(selectedDate);
            const activityToUpdate = JSON.parse(card.dataset.activity);

            try {
                await updateActivityStatus(currentUserId, formattedDate, activityToUpdate, newStatus);
                showMessage('Success', 'Activity status updated!');
                updateUI();
            } catch (error) {
                showMessage('Error', 'Failed to update activity: ' + error.message);
            }
        }
    });

    // Event delegation for Daily Reports (delete activity)
    dailyActivitiesList.addEventListener('click', async (event) => {
        const target = event.target;
        const deleteButton = target.closest('.delete-btn');

        if (deleteButton && currentUserId) {
            const card = deleteButton.closest('.daily-report-card');
            const formattedDate = formatDate(selectedDate);
            const activityToDelete = JSON.parse(card.dataset.activity);
            const status = activityToDelete.status;

            try {
                await deleteActivity(currentUserId, formattedDate, activityToDelete, status);
                showMessage('Success', 'Activity deleted!');
                updateUI();
            } catch (error) {
                showMessage('Error', 'Failed to delete activity: ' + error.message);
            }
        }
    });
});