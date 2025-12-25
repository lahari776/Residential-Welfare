// Check if user is logged in and is an admin
/*document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser) {
        window.location.href = 'adminlogin.html';
        return;
    }

    // Check if user is admin
    fetchAdminStatus(currentUser.email)
        .then(isAdmin => {
            if (!isAdmin) {
                alert("You don't have permission to access this page.");
                window.location.href = 'adminhome.html';
            } else {
                // Load all necessary data
                loadDashboardData();
                loadUsers();
            }
        })
        .catch(error => {
            console.error("Error checking admin status:", error);
            alert("Error checking permissions. Please try again.");
            window.location.href = 'adminlogin.html';
        });

    // Set up event listeners
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'adminlogin.html';
    });

    document.getElementById('add-payment-btn').addEventListener('click', handleAddPayment);
    document.getElementById('update-payment-btn').addEventListener('click', handleUpdatePayment);
    document.getElementById('confirm-delete-btn').addEventListener('click', handleDeletePayment);
});

// Check if user is admin
async function fetchAdminStatus(email) {
    try {
        const response = await fetch(`/admin/users`);
        const users = await response.json();
        const currentUser = users.find(user => user.email === email);
        return currentUser && currentUser.isAdmin;
    } catch (error) {
        console.error("Error fetching admin status:", error);
        throw error;
    }
}
*/
// Load dashboard data
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    loadUsers();
});
async function loadDashboardData() {
    try {
        // Fetch payment summary
        const summaryResponse = await fetch('/admin/payments/summary');
        const summary = await summaryResponse.json();
        
        updateSummaryCards(summary);
        displayUpcomingPayments(summary.upcoming);
        displayOverduePayments(summary.overdue);
        
        // Fetch all payments
        const paymentsResponse = await fetch('/admin/payments');
        const payments = await paymentsResponse.json();
        
        displayAllPayments(payments);
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        alert("Error loading data. Please refresh the page and try again.");
    }
}

// Load users for the dropdown
async function loadUsers() {
    try {
        const response = await fetch('/admin/users');
        const users = await response.json();
        
        const userSelect = document.getElementById('user-select');
        userSelect.innerHTML = '<option value="">Select User</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.email})`;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        alert("Error loading user data. Please refresh the page and try again.");
    }
}

// Update summary cards
function updateSummaryCards(summary) {
    // Initialize counters
    let pendingCount = 0;
    let pendingAmount = 0;
    let completedCount = 0;
    let completedAmount = 0;
    let failedCount = 0;
    let failedAmount = 0;
    
    // Process summary data
    summary.summary.forEach(item => {
        if (item.status === 'Pending') {
            pendingCount = item.count;
            pendingAmount = item.total || 0;
        } else if (item.status === 'Completed') {
            completedCount = item.count;
            completedAmount = item.total || 0;
        } else if (item.status === 'Failed') {
            failedCount = item.count;
            failedAmount = item.total || 0;
        }
    });
    
    // Update DOM
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('pending-amount').textContent = formatCurrency(pendingAmount);
    
    document.getElementById('completed-count').textContent = completedCount;
    document.getElementById('completed-amount').textContent = formatCurrency(completedAmount);
    
    document.getElementById('failed-count').textContent = failedCount;
    document.getElementById('failed-amount').textContent = formatCurrency(failedAmount);
    
    document.getElementById('overdue-count').textContent = summary.overdue.length;
    
    // Calculate total overdue amount
    const overdueAmount = summary.overdue.reduce((total, payment) => total + parseFloat(payment.amount), 0);
    document.getElementById('overdue-amount').textContent = formatCurrency(overdueAmount);
}

// Display all payments
function displayAllPayments(payments) {
    const tableBody = document.getElementById('all-payments-table');
    tableBody.innerHTML = '';
    
    if (payments.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="7" class="text-center">No payments found</td>`;
        tableBody.appendChild(row);
        return;
    }
    
    payments.forEach(payment => {
        const row = document.createElement('tr');
        const dueDate = new Date(payment.due_date);
        const isPastDue = payment.status === 'Pending' && dueDate < new Date();
        
        row.innerHTML = `
            <td>${payment.id}</td>
            <td>${payment.username}<br><small class="text-muted">${payment.email}</small></td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(payment.status)}">${payment.status}</span>
                ${isPastDue ? '<span class="badge bg-danger ms-1">Overdue</span>' : ''}
            </td>
            <td>${formatDate(payment.due_date)}</td>
            <td>${formatDate(payment.created_at)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-primary edit-payment-btn" data-id="${payment.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger delete-payment-btn" data-id="${payment.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Add event listeners to newly created buttons
    document.querySelectorAll('.edit-payment-btn').forEach(button => {
        button.addEventListener('click', () => openEditPaymentModal(button.dataset.id));
    });
    
    document.querySelectorAll('.delete-payment-btn').forEach(button => {
        button.addEventListener('click', () => openDeletePaymentModal(button.dataset.id));
    });
}

// Display upcoming payments
function displayUpcomingPayments(payments) {
    const upcomingList = document.getElementById('upcoming-payments-list');
    upcomingList.innerHTML = '';
    
    if (payments.length === 0) {
        upcomingList.innerHTML = '<div class="alert alert-info">No upcoming payments in the next 7 days</div>';
        return;
    }
    
    payments.forEach(payment => {
        const card = document.createElement('div');
        card.className = 'payment-card pending card mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title mb-0">${payment.username}</h5>
                    <span class="badge bg-warning text-dark">Due: ${formatDate(payment.due_date)}</span>
                </div>
                <h6 class="card-subtitle mb-2 text-muted">${payment.email}</h6>
                <p class="card-text">Amount: ${formatCurrency(payment.amount)}</p>
                <div class="d-flex justify-content-end">
                    <button class="btn btn-sm btn-success mark-completed-btn me-2" data-id="${payment.id}">
                        <i class="fas fa-check me-1"></i> Mark Completed
                    </button>
                    <button class="btn btn-sm btn-primary edit-payment-btn" data-id="${payment.id}">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                </div>
            </div>
        `;
        upcomingList.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.mark-completed-btn').forEach(button => {
        button.addEventListener('click', () => markPaymentAsCompleted(button.dataset.id));
    });
    
    document.querySelectorAll('.edit-payment-btn').forEach(button => {
        button.addEventListener('click', () => openEditPaymentModal(button.dataset.id));
    });
}

// Display overdue payments
function displayOverduePayments(payments) {
    const overdueList = document.getElementById('overdue-payments-list');
    overdueList.innerHTML = '';
    
    if (payments.length === 0) {
        overdueList.innerHTML = '<div class="alert alert-success">No overdue payments! 🎉</div>';
        return;
    }
    
    payments.forEach(payment => {
        const daysPastDue = getDaysPastDue(payment.due_date);
        const card = document.createElement('div');
        card.className = 'payment-card overdue card mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title mb-0">${payment.username}</h5>
                    <span class="badge bg-danger">${daysPastDue} days overdue</span>
                </div>
                <h6 class="card-subtitle mb-2 text-muted">${payment.email}</h6>
                <p class="card-text">Due Date: ${formatDate(payment.due_date)}</p>
                <p class="card-text">Amount: ${formatCurrency(payment.amount)}</p>
                <div class="d-flex justify-content-end">
                    <button class="btn btn-sm btn-success mark-completed-btn me-2" data-id="${payment.id}">
                        <i class="fas fa-check me-1"></i> Mark Completed
                    </button>
                    <button class="btn btn-sm btn-primary edit-payment-btn" data-id="${payment.id}">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                </div>
            </div>
        `;
        overdueList.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.mark-completed-btn').forEach(button => {
        button.addEventListener('click', () => markPaymentAsCompleted(button.dataset.id));
    });
    
    document.querySelectorAll('.edit-payment-btn').forEach(button => {
        button.addEventListener('click', () => openEditPaymentModal(button.dataset.id));
    });
}

// Handle adding a new payment
async function handleAddPayment() {
    const userId = document.getElementById('user-select').value;
    const amount = document.getElementById('amount-input').value;
    const status = document.getElementById('status-select').value;
    const dueDate = document.getElementById('due-date-input').value;
    
    if (!userId || !amount || !status || !dueDate) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch('/admin/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: parseInt(userId),
                amount: parseFloat(amount),
                status,
                due_date: dueDate
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to add payment');
        }
        
        // Close modal and reload data
        const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
        modal.hide();
        
        // Reset form
        document.getElementById('add-payment-form').reset();
        
        // Reload dashboard data
        loadDashboardData();
        
        // Show success message
        alert('Payment added successfully');
    } catch (error) {
        console.error('Error adding payment:', error);
        alert(`Error: ${error.message}`);
    }
}

// Open edit payment modal
async function openEditPaymentModal(paymentId) {
    try {
        const response = await fetch(`/admin/payments`);
        const payments = await response.json();
        
        const payment = payments.find(p => p.id == paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        
        // Populate form
        document.getElementById('payment-id-input').value = payment.id;
        document.getElementById('user-display').value = `${payment.username} (${payment.email})`;
        document.getElementById('update-amount-input').value = payment.amount;
        document.getElementById('update-status-select').value = payment.status;
        document.getElementById('update-due-date-input').value = formatDateForInput(payment.due_date);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('updatePaymentModal'));
        modal.show();
    } catch (error) {
        console.error('Error opening edit modal:', error);
        alert(`Error: ${error.message}`);
    }
}

// Handle updating a payment
async function handleUpdatePayment() {
    const paymentId = document.getElementById('payment-id-input').value;
    const amount = document.getElementById('update-amount-input').value;
    const status = document.getElementById('update-status-select').value;
    const dueDate = document.getElementById('update-due-date-input').value;
    
    if (!paymentId || !amount || !status || !dueDate) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`/admin/payments/${paymentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                status,
                due_date: dueDate
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update payment');
        }
        
        // Close modal and reload data
        const modal = bootstrap.Modal.getInstance(document.getElementById('updatePaymentModal'));
        modal.hide();
        
        // Reload dashboard data
        loadDashboardData();
        
        // Show success message
        alert('Payment updated successfully');
    } catch (error) {
        console.error('Error updating payment:', error);
        alert(`Error: ${error.message}`);
    }
}

// Open delete payment modal
function openDeletePaymentModal(paymentId) {
    document.getElementById('delete-payment-id').value = paymentId;
    const modal = new bootstrap.Modal(document.getElementById('deletePaymentModal'));
    modal.show();
}

// Handle deleting a payment
async function handleDeletePayment() {
    const paymentId = document.getElementById('delete-payment-id').value;
    
    try {
        const response = await fetch(`/admin/payments/${paymentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete payment');
        }
        
        // Close modal and reload data
        const modal = bootstrap.Modal.getInstance(document.getElementById('deletePaymentModal'));
        modal.hide();
        
        // Reload dashboard data
        loadDashboardData();
        
        // Show success message
        alert('Payment deleted successfully');
    } catch (error) {
        console.error('Error deleting payment:', error);
        alert(`Error: ${error.message}`);
    }
}

// Mark payment as completed
async function markPaymentAsCompleted(paymentId) {
    try {
        const response = await fetch(`/admin/payments/${paymentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'Completed'
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update payment');
        }
        
        // Reload dashboard data
        loadDashboardData();
        
        // Show success message
        alert('Payment marked as completed');
    } catch (error) {
        console.error('Error updating payment:', error);
        alert(`Error: ${error.message}`);
    }
}

// Helper functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateForInput(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Pending':
            return 'bg-warning text-dark';
        case 'Completed':
            return 'bg-success';
        case 'Failed':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

function getDaysPastDue(dueDate) {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = Math.abs(today - due);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}