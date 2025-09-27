// FeedbackService - Handles user feedback through Flux actions
class FeedbackService {
    
    /**
     * Handle user feedback (like/not-accurate) with optimistic updates
     * @param {string} signalId - Signal ID
     * @param {string} feedbackType - Type of feedback ('like', 'not-accurate')
     * @param {string} userId - User ID (optional, defaults to current user)
     */
    static async handleFeedback(signalId, feedbackType, userId = null) {
        // Get current user if not provided
        userId = userId || signalsStore.getState().userInfo.userId || 'user-1';
        
        // Check if user already has this type of feedback
        const currentFeedback = this.getUserFeedback(signalId, userId);
        
        console.log(`🎯 FeedbackService: Handling ${feedbackType} for signal ${signalId}, current feedback: ${currentFeedback}`);
        
        // Dispatch optimistic request action
        const requestAction = Actions.requestFeedback(signalId, feedbackType, userId);
        dispatcher.dispatch(requestAction);
        
        const operationId = requestAction.payload.operationId;
        
        try {
            let result;
            
            if (currentFeedback === feedbackType) {
                // User is removing their feedback (toggle off)
                console.log(`🔄 Toggling off ${feedbackType} feedback for signal ${signalId}`);
                result = await SignalsRepository.removeFeedbackInteraction(signalId, userId);
            } else {
                // User is adding new feedback (or switching from one type to another)
                console.log(`➕ Adding ${feedbackType} feedback for signal ${signalId}`);
                result = await SignalsRepository.saveFeedbackInteraction(signalId, feedbackType, userId);
            }
            
            if (result.success) {
                // Dispatch success action
                dispatcher.dispatch(Actions.feedbackSucceeded(signalId, feedbackType, operationId));
                
                // Show success message
                const action = currentFeedback === feedbackType ? 'removed' : 'added';
                dispatcher.dispatch(Actions.showMessage(`Signal ${action} ${feedbackType} feedback`, 'success'));
                
            } else {
                // Dispatch failure action
                dispatcher.dispatch(Actions.feedbackFailed(signalId, feedbackType, operationId, result.error));
                
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to save feedback - changes reverted', 'error'));
            }
            
        } catch (error) {
            console.error('❌ FeedbackService: Critical error in feedback handling:', error);
            
            // Dispatch failure action
            dispatcher.dispatch(Actions.feedbackFailed(signalId, feedbackType, operationId, error.message));
            
            // Show error message
            dispatcher.dispatch(Actions.showMessage('Failed to save feedback - changes reverted', 'error'));
        }
    }
    
    /**
     * Remove user feedback for a signal
     * @param {string} signalId - Signal ID
     * @param {string} userId - User ID (optional)
     */
    static async removeFeedback(signalId, userId = null) {
        userId = userId || signalsStore.getState().userInfo.userId || 'user-1';
        
        console.log(`🎯 FeedbackService: Removing feedback for signal ${signalId}`);
        
        // Dispatch remove feedback action (optimistic update)
        dispatcher.dispatch(Actions.removeFeedback(signalId, userId));
        
        try {
            // Remove from API
            const result = await SignalsRepository.removeFeedbackInteraction(signalId, userId);
            
            if (result.success) {
                console.log('✅ Feedback removed successfully');
            } else {
                console.error('❌ Failed to remove feedback:', result.error);
                // Note: We don't revert the optimistic update for feedback removal
            }
        } catch (error) {
            console.error('❌ Critical error removing feedback:', error);
        }
        
        // Show success message
        dispatcher.dispatch(Actions.showMessage('Feedback removed', 'info'));
    }
    
    /**
     * Get current user feedback for a signal
     * @param {string} signalId - Signal ID
     * @param {string} userId - User ID (optional)
     * @returns {string|null} - Feedback type or null
     */
    static getUserFeedback(signalId, userId = null) {
        const state = signalsStore.getState();
        userId = userId || state.userInfo.userId || 'user-1';
        
        // First check the signal's currentUserFeedback property (most reliable)
        const signal = state.signalsById?.get(signalId);
        if (signal && signal.currentUserFeedback) {
            return signal.currentUserFeedback;
        }
        
        // Fallback: Get interactions from the normalized data structure
        const interactions = state.normalizedData?.interactions || new Map();
        const interactionsBySignal = state.indexes?.interactionsBySignal || new Map();
        
        // Get interaction IDs for this signal
        const signalInteractionIds = interactionsBySignal.get(signalId) || new Set();
        
        // Find user's feedback interaction
        for (const interactionId of signalInteractionIds) {
            const interaction = interactions.get(interactionId);
            if (interaction && 
                interaction.userId === userId && 
                (interaction.interactionType === 'like' || interaction.interactionType === 'not-accurate')) {
                return interaction.interactionType;
            }
        }
        
        return null;
    }
    
    /**
     * Get signal feedback counts
     * @param {string} signalId - Signal ID
     * @returns {Object} - Object with likes and notAccurate counts
     */
    static getSignalCounts(signalId) {
        const state = signalsStore.getState();
        
        // Get interactions from the normalized data structure
        const interactions = state.normalizedData?.interactions || new Map();
        const interactionsBySignal = state.indexes?.interactionsBySignal || new Map();
        
        // Get interaction IDs for this signal
        const signalInteractionIds = interactionsBySignal.get(signalId) || new Set();
        
        let likes = 0;
        let notAccurate = 0;
        
        // Count interactions
        for (const interactionId of signalInteractionIds) {
            const interaction = interactions.get(interactionId);
            if (interaction) {
                if (interaction.interactionType === 'like') {
                    likes++;
                } else if (interaction.interactionType === 'not-accurate') {
                    notAccurate++;
                }
            }
        }
        
        return { likes, notAccurate };
    }
    
    /**
     * Mark signal as viewed (for tracking)
     * @param {string} signalId - Signal ID
     * @param {Object} app - Legacy app reference (ignored in Flux)
     */
    static async markSignalAsViewed(signalId, app) {
        const userId = signalsStore.getState().userInfo.userId || 'user-1';
        
        console.log(`👁️ FeedbackService: Marking signal ${signalId} as viewed`);
        
        // Dispatch viewed action
        dispatcher.dispatch(Actions.viewSignal(signalId));
        
        try {
            // Save to API in background
            await SignalsRepository.saveFeedbackInteraction(signalId, 'viewed', userId);
        } catch (error) {
            console.error('Failed to save viewed status:', error);
            // Don't revert for view tracking - it's not critical
        }
    }
    
    /**
     * Acknowledge signal (wrapper for compatibility with old code)
     * @param {string} signalId - Signal ID
     * @param {string} feedbackType - Type of feedback
     * @param {Object} app - Legacy app reference (ignored)
     */
    static async acknowledgeSignal(signalId, feedbackType, app) {
        return this.handleFeedback(signalId, feedbackType);
    }
    
    /**
     * Save interaction to API
     * @param {string} signalId - Signal ID
     * @param {string} interactionType - Type of interaction
     */
    static async saveInteraction(signalId, interactionType) {
        const userId = signalsStore.getState().userInfo.userId || 'user-1';
        return SignalsRepository.saveFeedbackInteraction(signalId, interactionType, userId);
    }
    
    /**
     * Update signal display counts in UI
     * @param {string} signalId - Signal ID
     * @param {Object} app - Legacy app reference (ignored)
     */
    static updateSignalDisplayCounts(signalId, app) {
        // This is now handled automatically through store change events
        // Trigger a UI update through the store
        signalsStore.emitChange('feedback:counts_updated', signalId);
    }
}

// Make globally available
window.FeedbackService = FeedbackService;

// Create aliases for backward compatibility with old code
window.SignalFeedbackService = FeedbackService;