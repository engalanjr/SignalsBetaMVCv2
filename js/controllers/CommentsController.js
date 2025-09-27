// CommentsController - Handles comment management across the application
class CommentsController {
    constructor() {
        this.setupEventListeners();
        console.log('🎯 CommentsController initialized');
    }
    
    setupEventListeners() {
        // Set up delegated event handling for comment interactions
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.getAttribute('data-action');
            const signalId = target.getAttribute('data-signal-id');
            const commentId = target.getAttribute('data-comment-id');
            const accountId = target.getAttribute('data-account-id');
            
            // Only handle comment-related actions
            if (this.isCommentAction(action)) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCommentAction(action, { signalId, commentId, accountId }, target);
            }
        });
        
        // Handle comment input submissions via Enter key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (e.target.classList.contains('comment-input-linkedin')) {
                    e.preventDefault();
                    const signalId = e.target.closest('.signal-card')?.getAttribute('data-signal-id');
                    if (signalId && e.target.value.trim()) {
                        this.addSignalComment(signalId, e.target.value.trim());
                        e.target.value = '';
                    }
                } else if (e.target.classList.contains('account-comment-input')) {
                    e.preventDefault();
                    const accountId = e.target.getAttribute('data-account-id') || 
                                    e.target.id.replace('accountCommentInput-', '');
                    if (accountId && e.target.value.trim()) {
                        this.addAccountComment(accountId, e.target.value.trim());
                        e.target.value = '';
                    }
                }
            }
        });
    }
    
    isCommentAction(action) {
        const commentActions = [
            'add-comment', 'edit-comment', 'delete-comment',
            'add-account-comment', 'edit-account-comment', 'delete-account-comment'
        ];
        return commentActions.includes(action);
    }
    
    handleCommentAction(action, params, target) {
        const { signalId, commentId, accountId } = params;
        
        switch (action) {
            case 'add-comment':
                const inputElement = document.getElementById(`inlineCommentText-${signalId}`);
                if (inputElement && inputElement.value.trim()) {
                    this.addSignalComment(signalId, inputElement.value.trim());
                    inputElement.value = '';
                }
                break;
                
            case 'edit-comment':
                this.editSignalComment(commentId, signalId);
                break;
                
            case 'delete-comment':
                this.deleteSignalComment(commentId, signalId);
                break;
                
            case 'add-account-comment':
                const accountInputElement = document.getElementById(`accountCommentInput-${accountId}`);
                if (accountInputElement && accountInputElement.value.trim()) {
                    this.addAccountComment(accountId, accountInputElement.value.trim());
                    accountInputElement.value = '';
                }
                break;
                
            case 'edit-account-comment':
                this.editAccountComment(commentId, accountId);
                break;
                
            case 'delete-account-comment':
                this.deleteAccountComment(commentId, accountId);
                break;
                
            default:
                console.warn(`Unknown comment action: ${action}`);
        }
    }
    
    // Signal comment methods
    addSignalComment(signalId, commentText) {
        console.log('💬 CommentsController.addSignalComment called:', { signalId, commentText });
        
        if (!signalId || !commentText.trim()) {
            console.error('Signal ID and comment text are required');
            return;
        }
        
        // Get the signal to find the accountId
        const state = signalsStore.getState();
        const signal = state.signalsById.get(signalId);
        
        if (!signal) {
            console.error('Signal not found:', signalId);
            return;
        }
        
        const accountId = signal.accountId || signal.account_id;
        if (!accountId) {
            console.error('Account ID not found for signal:', signalId);
            return;
        }
        
        const userId = state.currentUser?.id || 1; // Default user ID
        console.log('💬 Dispatching comment request:', { signalId, accountId, commentText, userId });
        dispatcher.dispatch(Actions.requestComment(signalId, accountId, commentText.trim(), userId));
        this.showCommentMessage('Comment added successfully', 'success');
    }
    
    editSignalComment(commentId, signalId) {
        const state = signalsStore.getState();
        const comments = state.comments.get(signalId) || [];
        const comment = comments.find(c => c.id === commentId);
        
        if (!comment) {
            console.error(`Comment ${commentId} not found`);
            return;
        }
        
        const newText = prompt('Edit comment:', comment.text);
        
        if (newText !== null && newText.trim() !== comment.text) {
            dispatcher.dispatch(Actions.updateComment(commentId, signalId, newText.trim()));
            this.showCommentMessage('Comment updated successfully', 'success');
        }
    }
    
    deleteSignalComment(commentId, signalId) {
        if (confirm('Are you sure you want to delete this comment?')) {
            dispatcher.dispatch(Actions.deleteComment(commentId, signalId));
            this.showCommentMessage('Comment deleted successfully', 'info');
        }
    }
    
    // Account comment methods
    addAccountComment(accountId, commentText) {
        if (!accountId || !commentText.trim()) {
            console.error('Account ID and comment text are required');
            return;
        }
        
        dispatcher.dispatch(Actions.addAccountComment(accountId, commentText.trim()));
        this.showCommentMessage('Account comment added successfully', 'success');
    }
    
    editAccountComment(commentId, accountId) {
        const state = signalsStore.getState();
        const comments = state.accountComments.get(accountId) || [];
        const comment = comments.find(c => c.id === commentId);
        
        if (!comment) {
            console.error(`Account comment ${commentId} not found`);
            return;
        }
        
        const newText = prompt('Edit comment:', comment.text);
        
        if (newText !== null && newText.trim() !== comment.text) {
            dispatcher.dispatch(Actions.updateAccountComment(commentId, accountId, newText.trim()));
            this.showCommentMessage('Account comment updated successfully', 'success');
        }
    }
    
    deleteAccountComment(commentId, accountId) {
        if (confirm('Are you sure you want to delete this account comment?')) {
            dispatcher.dispatch(Actions.deleteAccountComment(commentId, accountId));
            this.showCommentMessage('Account comment deleted successfully', 'info');
        }
    }
    
    showCommentMessage(message, type = 'info') {
        // Use notification service if available
        if (window.NotificationService) {
            window.NotificationService.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Utility methods
    getCommentsForSignal(signalId) {
        const state = signalsStore.getState();
        return state.comments.get(signalId) || [];
    }
    
    getCommentsForAccount(accountId) {
        const state = signalsStore.getState();
        return state.accountComments.get(accountId) || [];
    }
    
    getCommentStats() {
        const state = signalsStore.getState();
        
        const signalCommentCount = Array.from(state.comments.values())
            .reduce((total, comments) => total + comments.length, 0);
            
        const accountCommentCount = Array.from(state.accountComments.values())
            .reduce((total, comments) => total + comments.length, 0);
        
        return {
            totalSignalComments: signalCommentCount,
            totalAccountComments: accountCommentCount,
            totalComments: signalCommentCount + accountCommentCount
        };
    }
    
    searchComments(searchText) {
        const state = signalsStore.getState();
        const results = [];
        
        // Search signal comments
        state.comments.forEach((comments, signalId) => {
            comments.forEach(comment => {
                if (comment.text.toLowerCase().includes(searchText.toLowerCase())) {
                    results.push({
                        type: 'signal',
                        signalId,
                        comment
                    });
                }
            });
        });
        
        // Search account comments
        state.accountComments.forEach((comments, accountId) => {
            comments.forEach(comment => {
                if (comment.text.toLowerCase().includes(searchText.toLowerCase())) {
                    results.push({
                        type: 'account',
                        accountId,
                        comment
                    });
                }
            });
        });
        
        return results;
    }
}

// Make globally available
window.CommentsController = CommentsController;