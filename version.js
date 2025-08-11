// File: version.js

document.addEventListener('DOMContentLoaded', () => {
    const versionBtn = document.getElementById('version-btn');
    const versionModal = document.getElementById('version-modal');
    const versionMessages = document.getElementById('version-messages');
    const closeModalBtn = versionModal.querySelector('.modal-close-btn');
    const versionButtons = document.querySelectorAll('#version-button-container .vbtn');

    // Define your version changes as a more structured object for easier filtering
    const versionChanges = {
        'v2.0': ['Improve server response time for fast and more efficient task managing.',
                'Implemented code caching to speed up recurring tasks.',
                'Edit button is added where users can now edit a task informations.',
                'Description input feild is added when adding a task.',
                'Separated database for ongoing task is added.'
        ],
        'v1.1': ['Fixed a bug in task counting function.',
                'Task deletion function is added',
                'Improve the User Interface'
        ],
        'v1.0': ['Fixed a bug where users cannot edit a task.']
    };

    // Function to render messages based on a filter
    const renderVersionMessages = (filterVersion) => {
        versionMessages.innerHTML = ''; // Clear previous messages
        const messages = versionChanges[filterVersion]; // Get messages for the specified version
        
        if (messages) {
            messages.forEach(change => {
                const messageBubble = document.createElement('div');
                messageBubble.className = 'bot-message';
                messageBubble.textContent = change;
                versionMessages.appendChild(messageBubble);
            });
        }
    };

    // Add event listeners to the hardcoded buttons
    versionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove 'active' class from all buttons
            versionButtons.forEach(btn => btn.classList.remove('active'));
            // Add 'active' class to the clicked button
            e.target.classList.add('active');
            
            // Get the version from the data-version attribute
            const version = e.target.getAttribute('data-version');
            renderVersionMessages(version);
        });
    });

    // Toggle the version modal
    const toggleModal = () => {
        versionModal.classList.toggle('active');
        if (versionModal.classList.contains('active')) {
            const activeVersion = versionModal.querySelector('.vbtn.active').getAttribute('data-version');
            renderVersionMessages(activeVersion);
        }
    };

    // Event listeners
    if (versionBtn && versionModal) {
        versionBtn.addEventListener('click', toggleModal);
        closeModalBtn.addEventListener('click', toggleModal);

        versionModal.addEventListener('click', (e) => {
            if (e.target === versionModal) {
                toggleModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && versionModal.classList.contains('active')) {
                toggleModal();
            }
        });
    }
});