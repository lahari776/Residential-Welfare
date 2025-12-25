// payment-dashboard.js
document.addEventListener('DOMContentLoaded', function() {
    // Get current user from local storage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Set user info
    document.getElementById('username').textContent = currentUser.username;

    // Fetch unread notifications count
    fetchUnreadNotifications();

    // Load payment data
    loadPaymentStats();
    loadPaymentHistory();

    // Set up event listeners
    setupEventListeners();
});

// Fetch unread notifications
function fetchUnreadNotifications() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    fetch(`/notifications/${currentUser.id}`)
        .then(response => response.json())
        .then(data => {
            const unreadCount = data.filter(notification => notification.read_status === 0).length;
            const badge = document.getElementById('notificationBadge');
            
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        })
        .catch(error => console.error('Error fetching notifications:', error));
}

// Load payment statistics and upcoming/overdue payments
function loadPaymentStats() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    fetch(`/user/payments/stats/${currentUser.id}`)
        .then(response => response.json())
        .then(data => {
            // Update statistics
            document.getElementById('totalDue').textContent = `$${data.stats.total_pending_amount.toFixed(2)}`;
            document.getElementById('pendingPayments').textContent = data.stats.pending_payments;
            document.getElementById('paidAmount').textContent = `$${data.stats.total_paid_amount.toFixed(2)}`;
            
            // Load overdue payments
            const overdueTable = document.getElementById('overduePaymentsTable').getElementsByTagName('tbody')[0];
            const overdueEmptyState = document.getElementById('overdueEmptyState');
            
            if (data.overdue.length > 0) {
                overdueTable.innerHTML = '';
                overdueEmptyState.style.display = 'none';
                
                data.overdue.forEach(payment => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>$${payment.amount.toFixed(2)}</td>
                        <td>${formatDate(payment.due_date)}</td>
                        <td><span class="status-badge status-pending">Pending</span></td>
                        <td><button class="btn btn-pay" data-payment-id="${payment.id}" data-amount="${payment.amount}" data-due-date="${payment.due_date}">Pay Now</button></td>
                    `;
                    overdueTable.appendChild(row);
                });
            } else {
                overdueTable.innerHTML = '';
                overdueEmptyState.style.display = 'flex';
            }
            
            // Load upcoming payments
            const upcomingTable = document.getElementById('upcomingPaymentsTable').getElementsByTagName('tbody')[0];
            const upcomingEmptyState = document.getElementById('upcomingEmptyState');
            
            if (data.upcoming.length > 0) {
                upcomingTable.innerHTML = '';
                upcomingEmptyState.style.display = 'none';
                
                data.upcoming.forEach(payment => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>$${payment.amount.toFixed(2)}</td>
                        <td>${formatDate(payment.due_date)}</td>
                        <td><span class="status-badge status-pending">Pending</span></td>
                        <td><button class="btn btn-pay" data-payment-id="${payment.id}" data-amount="${payment.amount}" data-due-date="${payment.due_date}">Pay Now</button></td>
                    `;
                    upcomingTable.appendChild(row);
                });
            } else {
                upcomingTable.innerHTML = '';
                upcomingEmptyState.style.display = 'flex';
            }
            
            // Set up pay buttons
            const payButtons = document.querySelectorAll('.btn-pay');
            payButtons.forEach(button => {
                button.addEventListener('click', function() {openPaymentModal(
                    this.getAttribute('data-payment-id'),
                    this.getAttribute('data-amount'),
                    this.getAttribute('data-due-date')
                );
            });
        });
    })
    .catch(error => console.error('Error loading payment stats:', error));
}

// Load payment history
function loadPaymentHistory() {
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

fetch(`/user/payments/history/${currentUser.id}`)
    .then(response => response.json())
    .then(data => {
        const historyTable = document.getElementById('paymentHistoryTable').getElementsByTagName('tbody')[0];
        const historyEmptyState = document.getElementById('historyEmptyState');
        
        // Filter only completed payments
        const completedPayments = data.filter(payment => payment.status === 'Completed');
        
        if (completedPayments.length > 0) {
            historyTable.innerHTML = '';
            historyEmptyState.style.display = 'none';
            
            completedPayments.forEach(payment => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>$${payment.amount.toFixed(2)}</td>
                    <td>${formatDate(payment.due_date)}</td>
                    <td>${payment.payment_date ? formatDate(payment.payment_date) : '-'}</td>
                    <td><span class="status-badge status-completed">Completed</span></td>
                `;
                historyTable.appendChild(row);
            });
        } else {
            historyTable.innerHTML = '';
            historyEmptyState.style.display = 'flex';
        }
    })
    .catch(error => console.error('Error loading payment history:', error));
}

// Open payment modal
function openPaymentModal(paymentId, amount, dueDate) {
const modal = document.getElementById('paymentModal');
const modalAmount = document.getElementById('modalAmount');
const modalDueDate = document.getElementById('modalDueDate');
const processBtn = document.getElementById('processPaymentBtn');

// Reset the modal state
resetModal();

// Set payment details
modalAmount.textContent = `$${parseFloat(amount).toFixed(2)}`;
modalDueDate.textContent = formatDate(dueDate);

// Store payment ID in button for processing
processBtn.setAttribute('data-payment-id', paymentId);
processBtn.setAttribute('data-amount', amount);

// Show the modal
modal.style.display = 'block';
}

// Reset modal to initial state
function resetModal() {
document.getElementById('paymentForm');
document.getElementById('paymentSuccess').style.display = 'none';
document.getElementById('paymentLoading').style.display = 'none';
document.getElementById('cardNumber').value = '';
document.getElementById('expiryDate').value = '';
document.getElementById('cvv').value = '';
document.getElementById('cardName').value = '';

// Show the payment form
document.querySelector('.payment-form').style.display = 'block';
}

// Close modal
function closeModal() {
document.getElementById('paymentModal').style.display = 'none';
}

// Process payment
function processPayment(paymentId, amount) {
const currentUser = JSON.parse(localStorage.getItem('currentUser'));
const loadingElement = document.getElementById('paymentLoading');
const formElement = document.querySelector('.payment-form');
const successElement = document.getElementById('paymentSuccess');

// Validate form (basic validation)
const cardNumber = document.getElementById('cardNumber').value.trim();
const expiryDate = document.getElementById('expiryDate').value.trim();
const cvv = document.getElementById('cvv').value.trim();
const cardName = document.getElementById('cardName').value.trim();

if (!cardNumber || !expiryDate || !cvv || !cardName) {
    alert('Please fill in all payment details');
    return;
}

// Show loading state
formElement.style.display = 'none';
loadingElement.style.display = 'block';

// Send payment to server
fetch('/user/payments/process', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        payment_id: paymentId,
        user_id: currentUser.id,
        amount: amount
        // In a real app, you would not send card details to your server directly
        // You would use a payment processor like Stripe, PayPal, etc.
    })
})
.then(response => response.json())
.then(data => {
    // Hide loading state
    loadingElement.style.display = 'none';
    
    if (data.success) {
        // Show success message
        successElement.style.display = 'block';
        
        // Reload data after a successful payment
        loadPaymentStats();
        loadPaymentHistory();
        fetchUnreadNotifications();
    } else {
        // Show error
        alert(`Payment failed: ${data.error}`);
        formElement.style.display = 'block';
    }
})
.catch(error => {
    console.error('Error processing payment:', error);
    loadingElement.style.display = 'none';
    formElement.style.display = 'block';
    alert('Payment processing failed. Please try again.');
});
}

// Set up event listeners
function setupEventListeners() {
// Close modal when clicking the X or outside the modal
const modal = document.getElementById('paymentModal');
const closeBtn = document.querySelector('.close-btn');

closeBtn.addEventListener('click', closeModal);

window.addEventListener('click', function(event) {
    if (event.target === modal) {
        closeModal();
    }
});

// Process payment button
const processBtn = document.getElementById('processPaymentBtn');
processBtn.addEventListener('click', function() {
    const paymentId = this.getAttribute('data-payment-id');
    const amount = this.getAttribute('data-amount');
    processPayment(paymentId, amount);
});

// Close success button
const closeSuccessBtn = document.getElementById('closeSuccessBtn');
closeSuccessBtn.addEventListener('click', closeModal);

// Format credit card number with spaces
const cardNumberInput = document.getElementById('cardNumber');
cardNumberInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^\d]/g, '').replace(/(.{4})/g, '$1 ').trim();
});

// Format expiry date
const expiryDateInput = document.getElementById('expiryDate');
expiryDateInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^\d]/g, '');
    if (this.value.length > 2) {
        this.value = this.value.substring(0, 2) + '/' + this.value.substring(2, 4);
    }
});

// Allow only numbers in CVV
const cvvInput = document.getElementById('cvv');
cvvInput.addEventListener('input', function() {
    this.value = this.value.replace(/[^\d]/g, '');
});

// Notification icon click - redirect to notifications page
const notificationIcon = document.querySelector('.notification-icon');
notificationIcon.addEventListener('click', function() {
    window.location.href = 'notifications.html';
});
}

// Format date as MM/DD/YYYY
function formatDate(dateString) {
const date = new Date(dateString);
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const year = date.getFullYear();

return `${month}/${day}/${year}`;
}