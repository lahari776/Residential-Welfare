// admin-payments.js

// Global variables
let allUsers = [];
let allPayments = [];
let summaryData = {
    pending: { count: 0, amount: 0 },
    completed: { count: 0, amount: 0 },
    failed: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 }
};

// Initialize the page
document.addEventListener("DOMContentLoaded", function() {
    // Load initial data
    loadAllData();
    
    // Setup event listeners
    document.getElementById('add-payment-btn').addEventListener('click', addPayment);
    document.getElementById('update-payment-btn').addEventListener('click', updatePayment);
    document.getElementById('confirm-delete-btn').addEventListener('click', deletePayment);
});

// Load all necessary data
async function loadAllData() {
    try {
        // Load users for the dropdown
        await loadUsers();
        
        // Load payments and summary data
        await loadPaymentsData();
        
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load data. Please refresh the page.");
    }
}

// Load users for the dropdown
async function loadUsers() {
    try {
        const response = await fetch('/admin/users');
        allUsers = await response.json();
        
        // Populate user dropdown
        const userSelect = document.getElementById('user-select');
        userSelect.innerHTML = '<option value="">Select User</option>';
        
        allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.email})`;
            userSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        throw error;
    }
}

// Load payments and summary data
async function loadPaymentsData() {
    try {
        // Get payments summary for dashboard cards
        const summaryResponse = await fetch('/admin/payments/summary');
        const summaryResult = await summaryResponse.json();
        
        // Get all payments
        const paymentsResponse = await fetch('/admin/payments');
        allPayments = await paymentsResponse.json();
        
        // Update summary cards
        updateSummaryCards(summaryResult);
        
        // Populate payments table
        populatePaymentsTable(allPayments);
        
        // Populate upcoming payments
        populateUpcomingPayments(summaryResult.upcoming);
        
        // Populate overdue payments
        populateOverduePayments(summaryResult.overdue);
        
    } catch (error) {
        console.error("Error loading payments data:", error);
        throw error;
    }
}

// Update summary cards with data
function updateSummaryCards(data) {
    // Reset summary data
    summaryData = {
        pending: { count: 0, amount: 0 },
        completed: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 },
        overdue: { count: 0, amount: 0 }
    };
    
    // Process summary data
    data.summary.forEach(item => {
        if (item.status === 'Pending') {
            summaryData.pending.count = item.count;
            summaryData.pending.amount = item.total;
        } else if (item.status === 'Completed') {
            summaryData.completed.count = item.count;
            summaryData.completed.amount = item.total;
        } else if (item.status === 'Failed') {
            summaryData.failed.count = item.count;
            summaryData.failed.amount = item.total;
        }
    });
    
    // Count overdue payments
    summaryData.overdue.count = data.overdue.length;
    summaryData.overdue.amount = data.overdue.reduce((total, payment) => total + parseFloat(payment.amount), 0);
    
    // Update the UI
    document.getElementById('pending-count').textContent = summaryData.pending.count;
    document.getElementById('pending-amount').textContent = formatCurrency(summaryData.pending.amount);
    
    document.getElementById('completed-count').textContent = summaryData.completed.count;
    document.getElementById('completed-amount').textContent = formatCurrency(summaryData.completed.amount);
    
    document.getElementById('failed-count').textContent = summaryData.failed.count;
    document.getElementById('failed-amount').textContent = formatCurrency(summaryData.failed.amount);
    
    document.getElementById('overdue-count').textContent = summaryData.overdue.count;
    document.getElementById('overdue-amount').textContent = formatCurrency(summaryData.overdue.amount);
}

// Populate the payments table
// Populate the payments table
function populatePaymentsTable(payments) {
    const tableBody = document.getElementById('all-payments-table');
    tableBody.innerHTML = '';
    
    if (payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No payments found</td>
            </tr>
        `;
        return;
    }
    
    payments.forEach(payment => {
        const row = document.createElement('tr');
        
        // Determine if payment is overdue
        const isOverdue = payment.status === 'Pending' && new Date(payment.due_date) < new Date();
        if (isOverdue) {
            row.classList.add('table-danger');
        }
        
        // Format status with appropriate styling
        let statusHtml = '';
        if (payment.status === 'Pending') {
            statusHtml = `<span class="badge bg-warning text-dark">Pending</span>`;
        } else if (payment.status === 'Completed') {
            statusHtml = `<span class="badge bg-success">Completed</span>`;
        } else if (payment.status === 'Failed') {
            statusHtml = `<span class="badge bg-danger">Failed</span>`;
        }
        
        // Add overdue badge if applicable
        if (isOverdue) {
            statusHtml += ` <span class="badge bg-danger">Overdue</span>`;
        }
        
        // Get category badge color
        let categoryBadgeClass = "bg-secondary";
        if (payment.category === "Rent") categoryBadgeClass = "bg-primary";
        if (payment.category === "Utilities") categoryBadgeClass = "bg-info";
        if (payment.category === "Maintenance") categoryBadgeClass = "bg-warning text-dark";
        if (payment.category === "Security") categoryBadgeClass = "bg-dark";
        
        row.innerHTML = `
            <td>${payment.id}</td>
            <td>${payment.username}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td><span class="badge ${categoryBadgeClass}">${payment.category || 'Other'}</span></td>
            <td>${statusHtml}</td>
            <td>${formatDate(payment.due_date)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="openEditModal(${payment.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="openDeleteModal(${payment.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Populate upcoming payments list
// Populate upcoming payments list
function populateUpcomingPayments(payments) {
    const upcomingList = document.getElementById('upcoming-payments-list');
    upcomingList.innerHTML = '';
    
    if (payments.length === 0) {
        upcomingList.innerHTML = '<div class="alert alert-info">No upcoming payments in the next 7 days</div>';
        return;
    }
    
    payments.forEach(payment => {
        const daysUntilDue = Math.ceil((new Date(payment.due_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        const card = document.createElement('div');
        card.className = 'payment-card pending card mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title mb-0">${payment.username}</h5>
                    <span class="badge bg-warning text-dark">Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</span>
                </div>
                <div class="d-flex justify-content-between">
                    <div>
                        <p class="card-text mb-1">Amount: <strong>${formatCurrency(payment.amount)}</strong></p>
                        <p class="card-text mb-1">Category: <strong>${payment.category || 'Other'}</strong></p>
                        <p class="card-text mb-1">Due: <strong>${formatDate(payment.due_date)}</strong></p>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-success" onclick="markAsCompleted(${payment.id})">
                            <i class="fas fa-check me-1"></i> Mark Paid
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        upcomingList.appendChild(card);
    });
}

// Populate overdue payments list
function populateOverduePayments(payments) {
    const overdueList = document.getElementById('overdue-payments-list');
    overdueList.innerHTML = '';
    
    if (payments.length === 0) {
        overdueList.innerHTML = '<div class="alert alert-success">No overdue payments!</div>';
        return;
    }
    
    payments.forEach(payment => {
        const daysOverdue = Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24));
        
        const card = document.createElement('div');
        card.className = 'payment-card overdue card mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h5 class="card-title mb-0">${payment.username}</h5>
                    <span class="badge bg-danger">${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</span>
                </div>
                <div class="d-flex justify-content-between">
                    <div>
                        <p class="card-text mb-1">Amount: <strong>${formatCurrency(payment.amount)}</strong></p>
                        <p class="card-text mb-1">Category: <strong>${payment.category || 'Other'}</strong></p>
                        <p class="card-text mb-1">Due: <strong>${formatDate(payment.due_date)}</strong></p>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-success" onclick="markAsCompleted(${payment.id})">
                            <i class="fas fa-check me-1"></i> Mark Paid
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        overdueList.appendChild(card);
    });
}
// Populate overdue payments list

// Add a new payment
// Add a new payment
async function addPayment() {
    const userIdInput = document.getElementById('user-select');
    const amountInput = document.getElementById('amount-input');
    const categoryInput = document.getElementById('category-select');
    const statusInput = document.getElementById('status-select');
    const dueDateInput = document.getElementById('due-date-input');
    
    // Form validation
    if (!userIdInput.value || !amountInput.value || !categoryInput.value || !statusInput.value || !dueDateInput.value) {
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
                user_id: parseInt(userIdInput.value),
                amount: parseFloat(amountInput.value),
                category: categoryInput.value,
                status: statusInput.value,
                due_date: dueDateInput.value
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
            modal.hide();
            
            // Reset the form
            document.getElementById('add-payment-form').reset();
            
            // Reload data
            await loadPaymentsData();
            
            // Show success message
            alert('Payment added successfully');
        } else {
            throw new Error(result.error || 'Failed to add payment');
        }
    } catch (error) {
        console.error('Error adding payment:', error);
        alert(`Failed to add payment: ${error.message}`);
    }
}

// Open the edit payment modal
function openEditModal(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        alert('Payment not found');
        return;
    }
    
    // Populate the form
    document.getElementById('payment-id-input').value = payment.id;
    document.getElementById('user-display').value = payment.username;
    document.getElementById('update-amount-input').value = payment.amount;
    document.getElementById('update-category-select').value = payment.category || 'Other';
    document.getElementById('update-status-select').value = payment.status;
    document.getElementById('update-due-date-input').value = payment.due_date.split('T')[0];
    
    // Open the modal
    const modal = new bootstrap.Modal(document.getElementById('updatePaymentModal'));
    modal.show();
}

// Update payment
async function updatePayment() {
    const paymentId = document.getElementById('payment-id-input').value;
    const amount = document.getElementById('update-amount-input').value;
    const category = document.getElementById('update-category-select').value;
    const status = document.getElementById('update-status-select').value;
    const dueDate = document.getElementById('update-due-date-input').value;
    
    // Form validation
    if (!amount || !category || !status || !dueDate) {
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
                category: category,
                status: status,
                due_date: dueDate
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('updatePaymentModal'));
            modal.hide();
            
            // Reload data
            await loadPaymentsData();
            
            // Show success message
            alert('Payment updated successfully');
        } else {
            throw new Error(result.error || 'Failed to update payment');
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        alert(`Failed to update payment: ${error.message}`);
    }
}

// Open the edit payment modal
function openEditModal(paymentId) {
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
        alert('Payment not found');
        return;
    }
    
    // Populate the form
    document.getElementById('payment-id-input').value = payment.id;
    document.getElementById('user-display').value = payment.username;
    document.getElementById('update-amount-input').value = payment.amount;
    document.getElementById('update-status-select').value = payment.status;
    document.getElementById('update-due-date-input').value = payment.due_date.split('T')[0];
    
    // Open the modal
    const modal = new bootstrap.Modal(document.getElementById('updatePaymentModal'));
    modal.show();
}

// Update payment
async function updatePayment() {
    const paymentId = document.getElementById('payment-id-input').value;
    const amount = document.getElementById('update-amount-input').value;
    const status = document.getElementById('update-status-select').value;
    const dueDate = document.getElementById('update-due-date-input').value;
    
    // Form validation
    if (!amount || !status || !dueDate) {
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
                status: status,
                due_date: dueDate
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('updatePaymentModal'));
            modal.hide();
            
            // Reload data
            await loadPaymentsData();
            
            // Show success message
            alert('Payment updated successfully');
        } else {
            throw new Error(result.error || 'Failed to update payment');
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        alert(`Failed to update payment: ${error.message}`);
    }
}

// Open delete confirmation modal
function openDeleteModal(paymentId) {
    document.getElementById('delete-payment-id').value = paymentId;
    
    // Open the modal
    const modal = new bootstrap.Modal(document.getElementById('deletePaymentModal'));
    modal.show();
}

// Delete payment
async function deletePayment() {
    const paymentId = document.getElementById('delete-payment-id').value;
    
    try {
        const response = await fetch(`/admin/payments/${paymentId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deletePaymentModal'));
            modal.hide();
            
            // Reload data
            await loadPaymentsData();
            
            // Show success message
            alert('Payment deleted successfully');
        } else {
            throw new Error(result.error || 'Failed to delete payment');
        }
    } catch (error) {
        console.error('Error deleting payment:', error);
        alert(`Failed to delete payment: ${error.message}`);
    }
}

// Mark payment as completed
async function markAsCompleted(paymentId) {
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
        
        const result = await response.json();
        
        if (response.ok) {
            // Reload data
            await loadPaymentsData();
            
            // Show success message
            alert('Payment marked as completed');
        } else {
            throw new Error(result.error || 'Failed to update payment');
        }
    } catch (error) {
        console.error('Error updating payment:', error);
        alert(`Failed to update payment: ${error.message}`);
    }
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Helper function to format date
function formatDate(dateString) {
    if (!dateString || dateString === 'N/A') return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}