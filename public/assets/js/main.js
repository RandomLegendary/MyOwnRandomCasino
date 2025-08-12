// DOM Elements
const loginForm = document.getElementById('login-form');
const registerLink = document.getElementById('register-link');
const errorMessage = document.getElementById('error-message');
const gameBoard = document.getElementById('game-board');
const betAmountInput = document.getElementById('bet-amount');
const mineCountSelect = document.getElementById('mine-count');
const startGameBtn = document.getElementById('start-game');
const cashOutBtn = document.getElementById('cash-out');
const multiplierDisplay = document.getElementById('multiplier');
const potentialWinDisplay = document.getElementById('potential-win');
const usernameDisplay = document.getElementById('username-display');
const balanceDisplay = document.getElementById('balance-display');
const logoutBtn = document.getElementById('logout-btn');

const adminNavButtons = document.querySelectorAll('.nav-btn');
const adminSections = document.querySelectorAll('.admin-section');
const userSearchInput = document.getElementById('user-search');
const searchUsersBtn = document.getElementById('search-users');
const usersList = document.getElementById('users-list');
const prevUsersBtn = document.getElementById('prev-users');
const nextUsersBtn = document.getElementById('next-users');
const usersPageInfo = document.getElementById('users-page-info');

// Game state
let currentGame = null;  // null when no game in progress
let userData = null;
let socket = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupEventListeners();
});

// Check if user is authenticated
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include'
    });
    
    if (response.ok) {
        const data = await response.json();
            userData = data.user;
            
         updateUserDisplay();
    } else {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}


// Update user display
function updateUserDisplay() {
    if (userData) {
        usernameDisplay.textContent = userData.username;
        balanceDisplay.textContent = `$${userData.balance.toFixed(2)}`;
    } else {
        usernameDisplay.textContent = 'Guest';
        balanceDisplay.textContent = '$0.00';
    }
}

// Setup event listeners
function setupEventListeners() {
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerLink) registerLink.addEventListener('click', e => {
        e.preventDefault();
        showRegisterForm();
    });
    if (startGameBtn) startGameBtn.addEventListener('click', startNewGame);
    if (cashOutBtn) cashOutBtn.addEventListener('click', cashOut);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Redirect admins to /admin, others to /
            if (data.user && data.user.isAdmin) {
                window.location.href = '/admin';
            } else {
                window.location.href = '/';
            }
        } else {
            showError(data.error || 'Login failed');
}
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Show register form
function showRegisterForm() {
    loginForm.innerHTML = `
        <input type="text" id="username" placeholder="Username" required>
        <input type="email" id="email" placeholder="Email" required>
        <input type="password" id="password" placeholder="Password" required>
        <input type="password" id="confirm-password" placeholder="Confirm Password" required>
        <button type="submit">Register</button>
        <p>Already have an account? <a href="#" id="login-link">Login</a></p>
    `;
    
    document.getElementById('login-link').addEventListener('click', e => {
        e.preventDefault();
        window.location.reload();
    });
    
    loginForm.addEventListener('submit', handleRegister);
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Network error. Please try again.');
    }
}

// Show error message
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => errorMessage.style.display = 'none', 5000);
    } else {
        alert(message);
    }
}

// Connect to WebSocket
function connectWebSocket() {
    if (socket) socket.close();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    socket = new WebSocket(`${protocol}//${host}`);
    
    socket.onopen = () => {
        console.log('WebSocket connected');
        if (userData) {
            socket.send(JSON.stringify({ type: 'auth', token: getCookie('token') }));
        }
    };
    
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
    };
    
    socket.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(connectWebSocket, 5000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Handle WebSocket messages
function handleSocketMessage(message) {
    switch (message.type) {
        case 'balance_update':
            if (userData) {
                userData.balance = message.balance;
                updateUserDisplay();
            }
            break;
            
        case 'game_update':
            if (currentGame && currentGame.gameId === message.gameId) {
                currentGame = sanitizeGameData(message.game);
                updateGameDisplay();
                renderGameBoard();
            }
            break;
            
        case 'notification':
            showNotification(message.text);
            break;
    }
}

// Sanitize incoming game data to ensure arrays exist
function sanitizeGameData(gameData) {
    return {
        ...gameData,
        revealedCells: Array.isArray(gameData.revealedCells) ? gameData.revealedCells : [],
        minePositions: Array.isArray(gameData.minePositions) ? gameData.minePositions : [],
        gridSize: gameData.gridSize || 0,
        gameOver: !!gameData.gameOver,
        multiplier: typeof gameData.multiplier === 'number' ? gameData.multiplier : 1.0,
        potentialWin: typeof gameData.potentialWin === 'number' ? gameData.potentialWin : 0.0,
    };
}

// Start new game
async function startNewGame() {
    const betAmount = parseFloat(betAmountInput.value);
    const mineCount = parseInt(mineCountSelect.value);


    mineCountSelect.disabled = true
    betAmountInput.disabled = true
    startGameBtn.disabled = true
    

    if (!betAmount || betAmount <= 0) {
        showError('Please enter a valid bet amount');
        return;
    }
    
    if (!userData || userData.balance < betAmount) {
        showError('Insufficient balance');
        return;
    }
    
    try {
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ betAmount, mineCount }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentGame = sanitizeGameData(data);

            if (typeof data.balance === 'number') {
                userData.balance = data.balance;
                updateUserDisplay();
            }

            startGameBtn.disabled = true;
            cashOutBtn.disabled = false;
            renderGameBoard();
            updateUserDisplay();
        } else {
            showError(data.error || 'Failed to start game');
        }
    } catch (error) {
        console.error('Start game error:', error);
        showError('Network error. Please try again.');
    }
}

// Render game board
function renderGameBoard() {
    if (!currentGame) return;

    const revealedCells = currentGame.revealedCells || [];
    const minePositions = currentGame.minePositions || [];

    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${currentGame.gridSize}, 1fr)`;

    for (let row = 0; row < currentGame.gridSize; row++) {
        for (let col = 0; col < currentGame.gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'game-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            const isRevealed = revealedCells.some(c => c.row === row && c.col === col);
            const isMine = minePositions.some(m => m.row === row && m.col === col);

            if (isRevealed) {
                cell.classList.add('revealed', 'safe');
                cell.textContent = '💎';
            } else if (currentGame.gameOver && isMine) {
                cell.classList.add('mine');
                cell.textContent = '💣';
            } else if (!currentGame.gameOver) {
                cell.addEventListener('click', () => revealCell(row, col));
            }

            gameBoard.appendChild(cell);
        }
    }

    updateGameDisplay();
}

// Reveal cell
async function revealCell(row, col) {
    if (!currentGame) return;

    try {
        const response = await fetch('/api/game/reveal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: currentGame.gameId, row, col }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            currentGame = sanitizeGameData(data);

            if (typeof data.balance === 'number') {
                userData.balance = data.balance;
                updateUserDisplay();
            }

            renderGameBoard();

            if (currentGame.gameOver) {
                mineCountSelect.disabled = false;
                betAmountInput.disabled = false;
                startGameBtn.disabled = false;
                cashOutBtn.disabled = true;
                updateUserDisplay();
            }
        } else {
            showError(data.error || 'Failed to reveal cell');
        }
    } catch (error) {
        console.error('Reveal cell error:', error);
        showError('Network error. Please try again.');
    }
}


// Cash out
async function cashOut() {
    if (!currentGame) return;

    try {
        const response = await fetch('/api/game/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId: currentGame.gameId }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            currentGame = null;

             if (typeof data.balance === 'number') {
                userData.balance = data.balance;
                updateUserDisplay();
            }

            mineCountSelect.disabled = false
            betAmountInput.disabled = false
            startGameBtn.disabled = false
            updateUserDisplay();
            gameBoard.innerHTML = '';
        } else {
            showError(data.error || 'Cash out failed');
        }
    } catch (error) {
        console.error('Cash out error:', error);
        showError('Network error. Please try again.');
    }
}

// Update multiplier and potential win display
function updateGameDisplay() {
    if (!currentGame) return;

    multiplierDisplay.textContent = currentGame.multiplier.toFixed(2) + 'x';
    potentialWinDisplay.textContent = `$${currentGame.potentialWin.toFixed(2)}`;
}

// Show notification (placeholder)
function showNotification(text) {
    alert(text);
}

// Utility: get cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}










if (document.querySelector('.admin-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        // First make sure all elements exist
        if (adminNavButtons && adminSections && userSearchInput && searchUsersBtn && 
            usersList && prevUsersBtn && nextUsersBtn && usersPageInfo) {
            setupAdminEventListeners();
            loadUsers();
            checkAdminStatus();
        } else {
            console.error('One or more admin elements missing from DOM');
        }
    });
}



/**
 * Update user via API
 */
async function updateUser(userId, updateData) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update user');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}
// Then modify your showEditUserModal function to use it properly:

async function showEditUserModal(user) {
    // Create modal HTML
    const modalHtml = `
        <div class="modal-overlay active" id="edit-user-modal">
            <div class="modal-content">
                <h3>Edit User: ${user.username}</h3>
                <form id="edit-user-form">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="edit-username" value="${user.username}" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="edit-email" value="${user.email}" required>
                    </div>
                    <div class="form-group">
                        <label>Balance</label>
                        <input type="number" step="0.01" id="edit-balance" value="${user.balance}" required>
                    </div>
                    <div class="form-group checkbox">
                        <input type="checkbox" id="edit-isActive" ${user.isActive ? 'checked' : ''}>
                        <label>Active</label>
                    </div>
                    <div class="form-group checkbox">
                        <input type="checkbox" id="edit-isAdmin" ${user.isAdmin ? 'checked' : ''}>
                        <label>Admin</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn cancel-btn">Cancel</button>
                        <button type="submit" class="btn save-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('edit-user-modal');
    
    // Handle form submission
    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedUser = {
            username: document.getElementById('edit-username').value,
            email: document.getElementById('edit-email').value,
            balance: parseFloat(document.getElementById('edit-balance').value),
            isActive: document.getElementById('edit-isActive').checked,
            isAdmin: document.getElementById('edit-isAdmin').checked
        };
        
        try {
            await updateUser(user._id, updatedUser);
            modal.remove();
            loadUsers(); // Refresh the users list
            showNotification('User updated successfully');
        } catch (error) {
            console.error('Error updating user:', error);
            showError('Failed to update user. Please try again.', 'edit-user-modal');
        }
    });
    
    // Handle cancel
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
}


// Admin Panel Functionality
if (document.querySelector('.admin-container')) {
    document.addEventListener('DOMContentLoaded', () => {
        setupAdminEventListeners();
        loadUsers();
        
        // Check admin privileges
        checkAdminStatus();
    });
}

// Check if user is admin
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (!data.user || !data.user.isAdmin) {
                window.location.href = '/';
            }
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Admin check error:', error);
        window.location.href = '/login';
    }
}

// Enhanced admin functionality
function setupAdminEventListeners() {
    // Navigation buttons
    adminNavButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.section + '-section';
            
            adminNavButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            adminSections.forEach(section => section.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            // Load section data when clicked
            switch(button.dataset.section) {
                case 'users':
                    loadUsers();
                    break;
                case 'games':
                    loadGames();
                    break;
                case 'logs':
                    loadLogs();
                    break;
                case 'settings':
                    loadSystemStats();
                    break;
            }
        });
    });

    // User search
    searchUsersBtn.addEventListener('click', searchUsers);
    userSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });

    // Pagination
    prevUsersBtn.addEventListener('click', () => {
        if (currentUsersPage > 1) {
            currentUsersPage--;
            loadUsers();
        }
    });

    nextUsersBtn.addEventListener('click', () => {
        if (currentUsersPage < totalUsersPages) {
            currentUsersPage++;
            loadUsers();
        }
    });
}

// Search users
function searchUsers() {
    currentSearchQuery = userSearchInput.value.trim();
    currentUsersPage = 1;
    loadUsers();
}

// Enhanced user loading with error handling
async function loadUsers() {
    try {
        showLoading('users-section');
        
        const url = new URL('/api/admin/users', window.location.origin);
        url.searchParams.append('page', currentUsersPage);
        url.searchParams.append('limit', 10);
        if (currentSearchQuery) {
            url.searchParams.append('search', currentSearchQuery);
        }

        const response = await fetch(url, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        renderUsers(data.users);
        updatePagination(data.totalPages, data.currentPage);
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load users. Please try again.', 'users-section');
    } finally {
        hideLoading('users-section');
    }
}

// Enhanced user rendering with more actions
function renderUsers(users) {
    usersList.innerHTML = '';

    if (users.length === 0) {
        usersList.innerHTML = '<tr><td colspan="5" class="no-data">No users found</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${user._id}</td>
            <td>${user.username}</td>
            <td>$${user.balance.toFixed(2)}</td>
            <td>
                <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
                ${user.isAdmin ? '<span class="status-badge admin">Admin</span>' : ''}
            </td>
            <td class="actions">
                <button class="btn edit-btn" data-user-id="${user._id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn balance-btn" data-user-id="${user._id}">
                    <i class="fas fa-coins"></i>
                </button>
                <button class="btn ${user.isActive ? 'deactivate-btn' : 'activate-btn'}" data-user-id="${user._id}">
                    <i class="fas ${user.isActive ? 'fa-user-slash' : 'fa-user-check'}"></i>
                </button>
                <button class="btn delete-btn" data-user-id="${user._id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        // Add event listeners
        row.querySelector('.edit-btn').addEventListener('click', () => showEditUserModal(user));
        row.querySelector('.balance-btn').addEventListener('click', () => showAdjustBalanceModal(user));
        row.querySelector('.activate-btn, .deactivate-btn').addEventListener('click', () => toggleUserActive(user._id, !user.isActive));
        row.querySelector('.delete-btn').addEventListener('click', () => showDeleteUserModal(user));
        
        usersList.appendChild(row);
    });
}

// Show edit user modal
async function showEditUserModal(user) {
    // Create modal HTML
    const modalHtml = `
        <div class="modal-overlay active" id="edit-user-modal">
            <div class="modal-content">
                <h3>Edit User: ${user.username}</h3>
                <form id="edit-user-form">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="edit-username" value="${user.username}" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="edit-email" value="${user.email}" required>
                    </div>
                    <div class="form-group">
                        <label>Balance</label>
                        <input type="number" step="0.01" id="edit-balance" value="${user.balance}" required>
                    </div>
                    <div class="form-group checkbox">
                        <input type="checkbox" id="edit-isActive" ${user.isActive ? 'checked' : ''}>
                        <label>Active</label>
                    </div>
                    <div class="form-group checkbox">
                        <input type="checkbox" id="edit-isAdmin" ${user.isAdmin ? 'checked' : ''}>
                        <label>Admin</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn cancel-btn">Cancel</button>
                        <button type="submit" class="btn save-btn">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('edit-user-modal');
    
    // Handle form submission
    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updatedUser = {
            username: document.getElementById('edit-username').value,
            email: document.getElementById('edit-email').value,
            balance: parseFloat(document.getElementById('edit-balance').value),
            isActive: document.getElementById('edit-isActive').checked,
            isAdmin: document.getElementById('edit-isAdmin').checked
        };
        
        try {
            await updateUser(user._id, updatedUser);
            modal.remove();
            loadUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Failed to update user. Please try again.');
        }
    });
    
    // Handle cancel
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// Show adjust balance modal
async function showAdjustBalanceModal(user) {
    const modalHtml = `
        <div class="modal-overlay active" id="adjust-balance-modal">
            <div class="modal-content">
                <h3>Adjust Balance: ${user.username}</h3>
                <p>Current Balance: $${user.balance.toFixed(2)}</p>
                <form id="adjust-balance-form">
                    <div class="form-group">
                        <label>Operation</label>
                        <select id="adjust-operation" required>
                            <option value="add">Add</option>
                            <option value="subtract">Subtract</option>
                            <option value="set">Set</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" step="0.01" min="0.01" id="adjust-amount" required>
                    </div>
                    <div class="form-group">
                        <label>Reason</label>
                        <input type="text" id="adjust-reason" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn cancel-btn">Cancel</button>
                        <button type="submit" class="btn confirm-btn">Confirm</button>
                    </div>
                </form>
                <div id="balance-error" class="error-message" style="display:none;"></div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('adjust-balance-modal');
    const errorDisplay = document.getElementById('balance-error');

    document.getElementById('adjust-balance-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const operation = document.getElementById('adjust-operation').value;
        const amount = parseFloat(document.getElementById('adjust-amount').value);
        const reason = document.getElementById('adjust-reason').value;

        // Client-side validation
        if (isNaN(amount) || amount <= 0) {
            errorDisplay.textContent = 'Please enter a valid positive amount';
            errorDisplay.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${user._id}/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('token')}`
                },
                body: JSON.stringify({ operation, amount, reason })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to adjust balance');
            }

            // Success case
            modal.remove();
            showNotification(`Balance updated successfully! New balance: $${data.newBalance.toFixed(2)}`);
            loadUsers(); // Refresh user list
            if (userData && userData._id === user._id) {
                userData.balance = data.newBalance;
                updateUserDisplay();
            }

        } catch (error) {
            console.error('Balance adjustment error:', error);
            errorDisplay.textContent = error.message || 'Failed to adjust balance';
            errorDisplay.style.display = 'block';
        }
    });

    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// Show delete user modal
function showDeleteUserModal(user) {
    const modalHtml = `
        <div class="modal-overlay active" id="delete-user-modal">
            <div class="modal-content">
                <h3>Delete User</h3>
                <p>Are you sure you want to delete user ${user.username}?</p>
                <p>This action cannot be undone and will delete all associated games and logs.</p>
                <div class="modal-actions">
                    <button type="button" class="btn cancel-btn">Cancel</button>
                    <button type="button" class="btn delete-btn">Delete User</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('delete-user-modal');
    
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/admin/users/${user._id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete user');
            }
            
            modal.remove();
            loadUsers();
            showNotification(`User ${user.username} deleted successfully`);
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user. Please try again.');
        }
    });
    
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// Toggle user active status
async function toggleUserActive(userId, isActive) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isActive }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to update user status');
        }
        
        loadUsers();
        showNotification(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert('Failed to update user status. Please try again.');
    }
}

// Load games
async function loadGames() {
    try {
        showLoading('games-section');
        
        const response = await fetch('/api/admin/games?limit=10', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load games');
        }
        
        const data = await response.json();
        renderGames(data.games);
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games. Please try again.', 'games-section');
    } finally {
        hideLoading('games-section');
    }
}

// Render games
function renderGames(games) {
    const gamesSection = document.getElementById('games-section');
    if (!gamesSection) return;
    
    let gamesTable = gamesSection.querySelector('#games-table');
    
    if (!gamesTable) {
        gamesSection.innerHTML = `
            <h2>Game Management</h2>
            <div class="search-bar">
                <input type="text" id="game-search" placeholder="Search games...">
                <button id="search-games">Search</button>
            </div>
            <table id="games-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Bet Amount</th>
                        <th>Potential Win</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="games-list"></tbody>
            </table>
            <div class="pagination">
                <button id="prev-games">Previous</button>
                <span id="games-page-info">Page 1 of 1</span>
                <button id="next-games">Next</button>
            </div>
        `;
        
        gamesTable = document.getElementById('games-table');
        
        // Setup games search
        document.getElementById('search-games').addEventListener('click', searchGames);
        document.getElementById('game-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchGames();
        });
        
        // Setup games pagination
        document.getElementById('prev-games').addEventListener('click', () => {
            if (currentGamesPage > 1) {
                currentGamesPage--;
                loadGames();
            }
        });
        
        document.getElementById('next-games').addEventListener('click', () => {
            if (currentGamesPage < totalGamesPages) {
                currentGamesPage++;
                loadGames();
            }
        });
    }
    
    const gamesList = document.getElementById('games-list');
    gamesList.innerHTML = '';
    
    if (games.length === 0) {
        gamesList.innerHTML = '<tr><td colspan="7" class="no-data">No games found</td></tr>';
        return;
    }
    
    games.forEach(game => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${game._id}</td>
            <td>${game.userId?.username || 'Deleted User'}</td>
            <td>$${game.betAmount.toFixed(2)}</td>
            <td>$${game.potentialWin?.toFixed(2) || '0.00'}</td>
            <td>
                <span class="status-badge ${game.status}">
                    ${game.status.replace('_', ' ')}
                </span>
            </td>
            <td>${new Date(game.createdAt).toLocaleString()}</td>
            <td class="actions">
                <button class="btn view-btn" data-game-id="${game._id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn delete-btn" data-game-id="${game._id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        row.querySelector('.view-btn').addEventListener('click', () => viewGameDetails(game._id));
        row.querySelector('.delete-btn').addEventListener('click', () => showDeleteGameModal(game._id));
        
        gamesList.appendChild(row);
    });
}

// View game details
async function viewGameDetails(gameId) {
    try {
        const response = await fetch(`/api/admin/games/${gameId}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load game details');
        }
        
        const game = await response.json();
        
        // Create modal to show game details
        const modalHtml = `
            <div class="modal-overlay active" id="game-details-modal">
                <div class="modal-content wide">
                    <h3>Game Details</h3>
                    <div class="game-info">
                        <p><strong>ID:</strong> ${game._id}</p>
                        <p><strong>User:</strong> ${game.userId?.username || 'Deleted User'}</p>
                        <p><strong>Status:</strong> <span class="status-badge ${game.status}">${game.status.replace('_', ' ')}</span></p>
                        <p><strong>Bet Amount:</strong> $${game.betAmount.toFixed(2)}</p>
                        ${game.winAmount ? `<p><strong>Win Amount:</strong> $${game.winAmount.toFixed(2)}</p>` : ''}
                        <p><strong>Date:</strong> ${new Date(game.createdAt).toLocaleString()}</p>
                    </div>
                    
                    <h4>Game Board</h4>
                    <div class="game-board-preview" style="grid-template-columns: repeat(${game.gridSize}, 1fr);">
                        ${renderGamePreview(game)}
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn close-btn">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('game-details-modal').querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('game-details-modal').remove();
        });
    } catch (error) {
        console.error('Error viewing game details:', error);
        alert('Failed to load game details. Please try again.');
    }
}

// Render game preview
function renderGamePreview(game) {
    let html = '';
    const revealedCells = game.revealedCells || [];
    const minePositions = game.minePositions || [];
    
    for (let row = 0; row < game.gridSize; row++) {
        for (let col = 0; col < game.gridSize; col++) {
            const isRevealed = revealedCells.some(c => c.row === row && c.col === col);
            const isMine = minePositions.some(m => m.row === row && m.col === col);
            
            let cellClass = 'game-cell-preview';
            let cellContent = '';
            
            if (isRevealed) {
                cellClass += ' revealed safe';
                cellContent = '💎';
            } else if (game.status === 'ended' && isMine) {
                cellClass += ' mine';
                cellContent = '💣';
            }
            
            html += `<div class="${cellClass}">${cellContent}</div>`;
        }
    }
    
    return html;
}

// Show delete game modal
function showDeleteGameModal(gameId) {
    const modalHtml = `
        <div class="modal-overlay active" id="delete-game-modal">
            <div class="modal-content">
                <h3>Delete Game</h3>
                <p>Are you sure you want to delete this game?</p>
                <p>This action cannot be undone.</p>
                <div class="modal-actions">
                    <button type="button" class="btn cancel-btn">Cancel</button>
                    <button type="button" class="btn delete-btn">Delete Game</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('delete-game-modal');
    
    modal.querySelector('.delete-btn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/admin/games/${gameId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete game');
            }
            
            modal.remove();
            loadGames();
            showNotification('Game deleted successfully');
        } catch (error) {
            console.error('Error deleting game:', error);
            alert('Failed to delete game. Please try again.');
        }
    });
    
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
}

// Load logs
async function loadLogs() {
    try {
        showLoading('logs-section');
        
        const response = await fetch('/api/admin/logs?limit=20', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load logs');
        }
        
        const data = await response.json();
        renderLogs(data.logs);
    } catch (error) {
        console.error('Error loading logs:', error);
        showError('Failed to load logs. Please try again.', 'logs-section');
    } finally {
        hideLoading('logs-section');
    }
}

// Render logs
function renderLogs(logs) {
    const logsSection = document.getElementById('logs-section');
    if (!logsSection) return;
    
    let logsTable = logsSection.querySelector('#logs-table');
    
    if (!logsTable) {
        logsSection.innerHTML = `
            <h2>System Logs</h2>
            <div class="search-bar">
                <input type="text" id="log-search" placeholder="Search logs...">
                <button id="search-logs">Search</button>
            </div>
            <table id="logs-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody id="logs-list"></tbody>
            </table>
            <div class="pagination">
                <button id="prev-logs">Previous</button>
                <span id="logs-page-info">Page 1 of 1</span>
                <button id="next-logs">Next</button>
            </div>
        `;
        
        logsTable = document.getElementById('logs-table');
        
        // Setup logs search
        document.getElementById('search-logs').addEventListener('click', searchLogs);
        document.getElementById('log-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchLogs();
        });
        
        // Setup logs pagination
        document.getElementById('prev-logs').addEventListener('click', () => {
            if (currentLogsPage > 1) {
                currentLogsPage--;
                loadLogs();
            }
        });
        
        document.getElementById('next-logs').addEventListener('click', () => {
            if (currentLogsPage < totalLogsPages) {
                currentLogsPage++;
                loadLogs();
            }
        });
    }
    
    const logsList = document.getElementById('logs-list');
    logsList.innerHTML = '';
    
    if (logs.length === 0) {
        logsList.innerHTML = '<tr><td colspan="5" class="no-data">No logs found</td></tr>';
        return;
    }
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${log._id}</td>
            <td>${log.userId?.username || 'System'}</td>
            <td>${log.action.replace(/_/g, ' ')}</td>
            <td>${formatLogDetails(log.details)}</td>
            <td>${new Date(log.createdAt).toLocaleString()}</td>
        `;
        
        logsList.appendChild(row);
    });
}

// Format log details
function formatLogDetails(details) {
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
}

// Load system stats
async function loadSystemStats() {
    try {
        showLoading('settings-section');
        
        const response = await fetch('/api/admin/stats', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load system stats');
        }
        
        const stats = await response.json();
        renderSystemStats(stats);
    } catch (error) {
        console.error('Error loading system stats:', error);
        showError('Failed to load system stats. Please try again.', 'settings-section');
    } finally {
        hideLoading('settings-section');
    }
}

function renderSystemStats(stats = {}) {
    const settingsSection = document.getElementById('settings-section');
    if (!settingsSection) return;
    
    // Default values if data is missing
    const safeStats = {
        games: {
            totalWon: 0,
            estimatedProfit: 0,
            biggestWin: { amount: 0, username: 'N/A' },
            biggestLoss: { amount: 0, username: 'N/A' },
            ...stats.games
        },
        deposits: {
            total: 0,
            ...stats.deposits
        },
        withdrawals: {
            total: 0,
            ...stats.withdrawals
        },
        settings: {
            houseEdge: 5,
            maintenanceMode: false,
            ...stats.settings
        },
        users: {
            total: 0,
            newToday: 0,
            ...stats.users
        },
        ...stats
    };

    settingsSection.innerHTML = `
        <h2>System Statistics</h2>
        
        <div class="admin-stats-grid">
            <div class="admin-stat-card">
                <h3>Total Winnings</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.games.totalWon)}</div>
                <div class="admin-stat-detail">All-time player winnings</div>
            </div>
            
            <div class="admin-stat-card">
                <h3>Total Deposits</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.deposits.total)}</div>
                <div class="admin-stat-detail">All-time player deposits</div>
            </div>
            
            <div class="admin-stat-card">
                <h3>Total Withdrawals</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.withdrawals.total)}</div>
                <div class="admin-stat-detail">All-time player withdrawals</div>
            </div>
            
            <div class="admin-stat-card">
                <h3>House Profit</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.games.estimatedProfit)}</div>
                <div class="admin-stat-detail">Net profit for the house</div>
            </div>
            
            <div class="admin-stat-card">
                <h3>Biggest Win</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.games.biggestWin.amount)}</div>
                <div class="admin-stat-detail">By user ${safeStats.games.biggestWin.username || 'Anonymous'}</div>
            </div>
            
            <div class="admin-stat-card">
                <h3>Biggest Loss</h3>
                <div class="admin-stat-value stat-huge">$${formatLargeNumber(safeStats.games.biggestLoss.amount)}</div>
                <div class="admin-stat-detail">By user ${safeStats.games.biggestLoss.username || 'Anonymous'}</div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Users</h3>
                <div class="stat-value">${safeStats.users.total}</div>
                <div class="stat-detail">+${safeStats.users.newToday} today</div>
            </div>
            
            <div class="stat-card">
                <h3>Active Games</h3>
                <div class="stat-value">${safeStats.games.active || 0}</div>
                <div class="stat-detail">${safeStats.games.completed || 0} completed</div>
            </div>
        </div>
        
        <h3>System Settings</h3>
        <form id="system-settings-form">
            <div class="form-group">
                <label>House Edge (%)</label>
                <input type="number" step="0.1" min="1" max="20" value="${safeStats.settings.houseEdge}" id="house-edge">
            </div>
            
            <div class="form-group checkbox">
                <input type="checkbox" id="maintenance-mode" ${safeStats.settings.maintenanceMode ? 'checked' : ''}>
                <label>Maintenance Mode</label>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn save-btn">Save Settings</button>
            </div>
        </form>
    `;
    
    // Add form submission handler
    document.getElementById('system-settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    houseEdge: parseFloat(document.getElementById('house-edge').value),
                    maintenanceMode: document.getElementById('maintenance-mode').checked
                }),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to save settings');
            }
            
            showNotification('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            showError('Failed to save settings. Please try again.', 'settings-section');
        }
    });
}

// Helper function to format large numbers with commas
function formatLargeNumber(num) {
    if (typeof num !== 'number') {
        num = parseFloat(num) || 0;
    }
    
    // Format with 2 decimal places and commas
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Helper functions
function showLoading(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = '<div class="spinner"></div><p>Loading...</p>';
        section.appendChild(loader);
    }
}

function hideLoading(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const loader = section.querySelector('.loader');
        if (loader) loader.remove();
    }
}

function showError(message, sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        section.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    } else {
        alert(message);
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize admin state
let currentUsersPage = 1;
let totalUsersPages = 1;
let currentGamesPage = 1;
let totalGamesPages = 1;
let currentLogsPage = 1;
let totalLogsPages = 1;
let currentSearchQuery = '';

