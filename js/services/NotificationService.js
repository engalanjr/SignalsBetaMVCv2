// NotificationService - Handle UI notifications
class NotificationService {
    
    /**
     * Show success notification
     * @param {string} message - Success message to display
     */
    static showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    /**
     * Show error notification
     * @param {string} message - Error message to display
     */
    static showError(message) {
        this.showNotification(message, 'error');
    }
    
    /**
     * Show info notification
     * @param {string} message - Info message to display
     */
    static showInfo(message) {
        this.showNotification(message, 'info');
    }
    
    /**
     * Show warning notification
     * @param {string} message - Warning message to display
     */
    static showWarning(message) {
        this.showNotification(message, 'warning');
    }
    
    /**
     * Show notification with specified type
     * @param {string} message - Message to display
     * @param {string} type - Type of notification (success, error, info, warning)
     */
    static showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.notification-toast');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification-toast notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getIconForType(type)}"></i>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    /**
     * Get icon class for notification type
     * @param {string} type - Notification type
     * @returns {string} - Icon class
     */
    static getIconForType(type) {
        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'info': 'fa-info-circle',
            'warning': 'fa-exclamation-triangle'
        };
        return icons[type] || 'fa-info-circle';
    }
}

// Make globally available
window.NotificationService = NotificationService;