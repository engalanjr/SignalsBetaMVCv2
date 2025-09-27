// FeedbackController - Handles feedback interactions (like/unlike, etc.)
class FeedbackController {
    constructor() {
        this.setupEventListeners();
        console.log('🎯 FeedbackController initialized');
    }
    
    setupEventListeners() {
        // Set up delegated event handling for feedback interactions
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.getAttribute('data-action');
            const signalId = target.getAttribute('data-signal-id');
            
            // Only handle feedback-related actions
            if (this.isFeedbackAction(action)) {
                e.preventDefault();
                e.stopPropagation();
                await this.handleFeedbackAction(action, signalId, target);
            }
        });
    }
    
    isFeedbackAction(action) {
        const feedbackActions = ['like', 'not-accurate', 'helpful', 'not-helpful'];
        return feedbackActions.includes(action);
    }
    
    async handleFeedbackAction(action, signalId, target) {
        switch (action) {
            case 'like':
                await this.submitFeedback(signalId, 'like');
                break;
                
            case 'not-accurate':
                await this.submitFeedback(signalId, 'not-accurate');
                break;
                
            case 'helpful':
                await this.submitFeedback(signalId, 'helpful');
                break;
                
            case 'not-helpful':
                await this.submitFeedback(signalId, 'not-helpful');
                break;
                
            default:
                console.warn(`Unknown feedback action: ${action}`);
        }
    }
    
    async submitFeedback(signalId, feedbackType) {
        // Get current signal state
        const state = signalsStore.getState();
        const signal = state.signalsById.get(signalId);
        
        if (!signal) {
            console.error(`Signal ${signalId} not found`);
            return;
        }
        
        // Use FeedbackService to handle the feedback (includes toggle logic)
        await FeedbackService.handleFeedback(signalId, feedbackType);
    }
    
    showFeedbackMessage(message, type = 'info') {
        // Use notification service if available
        if (window.NotificationService) {
            window.NotificationService.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Bulk feedback operations
    submitBulkFeedback(signalIds, feedbackType) {
        signalIds.forEach(signalId => {
            this.submitFeedback(signalId, feedbackType);
        });
        
        this.showFeedbackMessage(
            `Applied ${feedbackType} feedback to ${signalIds.length} signals`, 
            'success'
        );
    }
    
    clearAllFeedback(signalId) {
        const state = signalsStore.getState();
        const signal = state.signalsById.get(signalId);
        
        if (!signal || !signal.currentUserFeedback) {
            return;
        }
        
        const userId = state.currentUser?.id || 1; // Default user ID
        dispatcher.dispatch(Actions.removeFeedback(signalId, userId));
        this.showFeedbackMessage('Feedback cleared', 'info');
    }
    
    // Get feedback statistics
    getFeedbackStats() {
        const state = signalsStore.getState();
        const signals = Array.from(state.signalsById.values());
        
        const stats = {
            total: signals.length,
            liked: signals.filter(s => s.currentUserFeedback === 'like').length,
            notAccurate: signals.filter(s => s.currentUserFeedback === 'not-accurate').length,
            helpful: signals.filter(s => s.currentUserFeedback === 'helpful').length,
            notHelpful: signals.filter(s => s.currentUserFeedback === 'not-helpful').length,
            noFeedback: signals.filter(s => !s.currentUserFeedback).length
        };
        
        return stats;
    }
}

// Make globally available
window.FeedbackController = FeedbackController;