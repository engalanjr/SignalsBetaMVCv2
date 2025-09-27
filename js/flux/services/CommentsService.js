// CommentsService - Handles comments through Flux actions
class CommentsService {
    
    /**
     * Add a new comment with optimistic updates
     * @param {string} signalId - Signal ID (optional if accountId provided)
     * @param {string} accountId - Account ID (optional if signalId provided)
     * @param {string} text - Comment text
     * @param {string} userId - User ID (optional)
     */
    static async addComment(signalId = null, accountId = null, text, userId = null) {
        // Get current user if not provided
        userId = userId || signalsStore.getState().userInfo.userId || 'user-1';
        
        if (!text || text.trim().length === 0) {
            dispatcher.dispatch(Actions.showMessage('Comment cannot be empty', 'error'));
            return;
        }
        
        console.log(`🎯 CommentsService: Adding comment for ${signalId ? 'signal' : 'account'} ${signalId || accountId}`);
        
        // Dispatch optimistic request action
        const requestAction = Actions.requestComment(signalId, accountId, text.trim(), userId);
        dispatcher.dispatch(requestAction);
        
        const operationId = requestAction.payload.operationId;
        
        try {
            // Create comment object for API
            const commentData = {
                signalId,
                accountId,
                text: text.trim(),
                userId,
                timestamp: new Date().toISOString()
            };
            
            // Make API call in background
            const result = await SignalsRepository.saveComment(commentData);
            
            if (result.success) {
                // Dispatch success action with real comment data
                dispatcher.dispatch(Actions.commentSucceeded(result.data, operationId));
                
                // Show success message
                dispatcher.dispatch(Actions.showMessage('Comment added successfully', 'success'));
                
            } else {
                // Dispatch failure action
                dispatcher.dispatch(Actions.commentFailed(operationId, result.error));
                
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to save comment - changes reverted', 'error'));
            }
            
        } catch (error) {
            console.error('❌ CommentsService: Critical error in comment handling:', error);
            
            // Dispatch failure action
            dispatcher.dispatch(Actions.commentFailed(operationId, error.message));
            
            // Show error message
            dispatcher.dispatch(Actions.showMessage('Failed to save comment - changes reverted', 'error'));
        }
    }
    
    /**
     * Update an existing comment
     * @param {string} commentId - Comment ID
     * @param {string} newText - New comment text
     */
    static async updateComment(commentId, newText) {
        if (!newText || newText.trim().length === 0) {
            dispatcher.dispatch(Actions.showMessage('Comment cannot be empty', 'error'));
            return;
        }
        
        console.log(`🎯 CommentsService: Updating comment ${commentId}`);
        
        try {
            // Make API call
            const result = await SignalsRepository.updateComment(commentId, { text: newText.trim() });
            
            if (result.success) {
                // Dispatch update action
                dispatcher.dispatch(Actions.updateComment(commentId, newText.trim()));
                
                // Show success message
                dispatcher.dispatch(Actions.showMessage('Comment updated successfully', 'success'));
                
            } else {
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to update comment', 'error'));
            }
            
        } catch (error) {
            console.error('❌ CommentsService: Failed to update comment:', error);
            dispatcher.dispatch(Actions.showMessage('Failed to update comment', 'error'));
        }
    }
    
    /**
     * Delete a comment
     * @param {string} commentId - Comment ID
     */
    static async deleteComment(commentId) {
        console.log(`🎯 CommentsService: Deleting comment ${commentId}`);
        
        try {
            // Make API call
            const result = await SignalsRepository.deleteComment(commentId);
            
            if (result.success) {
                // Dispatch delete action
                dispatcher.dispatch(Actions.deleteComment(commentId));
                
                // Show success message
                dispatcher.dispatch(Actions.showMessage('Comment deleted successfully', 'success'));
                
            } else {
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to delete comment', 'error'));
            }
            
        } catch (error) {
            console.error('❌ CommentsService: Failed to delete comment:', error);
            dispatcher.dispatch(Actions.showMessage('Failed to delete comment', 'error'));
        }
    }
    
    /**
     * Get comments for a signal
     * @param {string} signalId - Signal ID
     * @returns {Array} - Array of comments
     */
    static getCommentsForSignal(signalId) {
        const state = signalsStore.getState();
        return state.comments.get(signalId) || [];
    }
    
    /**
     * Get comments for an account
     * @param {string} accountId - Account ID
     * @returns {Array} - Array of comments
     */
    static getCommentsForAccount(accountId) {
        const state = signalsStore.getState();
        return state.comments.get(accountId) || [];
    }
    
    /**
     * Legacy wrapper for adding comment
     * @param {string} signalId - Signal ID
     * @param {Object} app - Legacy app reference (ignored)
     */
    static async addCommentLegacy(signalId, app) {
        // Get comment text from either inline or modal input
        const commentText = document.getElementById(`inlineCommentText-${signalId}`)?.value ||
                          document.getElementById('newCommentText')?.value;
        
        if (!commentText || !commentText.trim()) {
            dispatcher.dispatch(Actions.showMessage('Please enter a comment', 'error'));
            return;
        }
        
        // Add the comment using the new method
        await this.addComment(signalId, null, commentText.trim());
        
        // Clear input fields
        if (document.getElementById(`inlineCommentText-${signalId}`)) {
            document.getElementById(`inlineCommentText-${signalId}`).value = '';
        }
        if (document.getElementById('newCommentText')) {
            document.getElementById('newCommentText').value = '';
        }
    }
    
    /**
     * Save comment to API (for backward compatibility)
     * @param {Object} comment - Comment object
     */
    static async saveComment(comment) {
        return SignalsRepository.saveComment(comment);
    }
    
    /**
     * Edit comment wrapper
     * @param {string} commentId - Comment ID
     * @param {string} signalId - Signal ID
     */
    static editComment(commentId, signalId) {
        const comment = this.getCommentsForSignal(signalId).find(c => c.id === commentId);
        if (comment) {
            // Set up edit mode in UI
            const commentEl = document.getElementById(`comment-${commentId}`);
            if (commentEl) {
                const currentText = comment.text;
                commentEl.innerHTML = `
                    <textarea id="edit-comment-${commentId}" class="edit-comment-textarea">${currentText}</textarea>
                    <div class="edit-comment-actions">
                        <button onclick="CommentsService.saveEditedComment('${commentId}', '${signalId}')" class="btn btn-sm btn-primary">Save</button>
                        <button onclick="CommentsService.cancelEditComment('${commentId}', '${signalId}', '${currentText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" class="btn btn-sm btn-secondary">Cancel</button>
                    </div>
                `;
            }
        }
    }
    
    /**
     * Save edited comment
     * @param {string} commentId - Comment ID
     * @param {string} signalId - Signal ID
     */
    static async saveEditedComment(commentId, signalId) {
        const textarea = document.getElementById(`edit-comment-${commentId}`);
        if (textarea) {
            const newText = textarea.value;
            await this.updateComment(commentId, newText);
        }
    }
    
    /**
     * Cancel comment edit
     * @param {string} commentId - Comment ID
     * @param {string} signalId - Signal ID
     * @param {string} originalText - Original comment text
     */
    static cancelEditComment(commentId, signalId, originalText) {
        const commentEl = document.getElementById(`comment-${commentId}`);
        if (commentEl) {
            commentEl.innerHTML = originalText;
        }
    }
    
    /**
     * Render comments for signal (HTML generation)
     * @param {string} signalId - Signal ID
     * @param {Object} app - Legacy app reference (ignored)
     */
    static renderCommentsForSignal(signalId, app) {
        const comments = this.getCommentsForSignal(signalId);
        if (comments.length === 0) {
            return '<p class="no-comments">No comments yet</p>';
        }
        
        return comments.map(comment => `
            <div class="comment" id="comment-container-${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">${comment.author || comment.authorId || 'User'}</span>
                    <span class="comment-time">${this.formatCommentTime(comment.timestamp)}</span>
                </div>
                <div class="comment-body" id="comment-${comment.id}">
                    ${comment.text}
                </div>
                <div class="comment-actions">
                    <button onclick="CommentsService.editComment('${comment.id}', '${signalId}')" class="btn btn-link btn-sm">Edit</button>
                    <button onclick="CommentsService.deleteComment('${comment.id}')" class="btn btn-link btn-sm text-danger">Delete</button>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Format comment timestamp
     * @param {string} timestamp - ISO timestamp
     */
    static formatCommentTime(timestamp) {
        const now = new Date();
        const commentTime = new Date(timestamp);
        const diffSeconds = Math.floor((now - commentTime) / 1000);

        if (diffSeconds < 60) {
            return 'Just now';
        } else if (diffSeconds < 3600) {
            const diffMinutes = Math.floor(diffSeconds / 60);
            return `${diffMinutes}m ago`;
        } else if (diffSeconds < 86400) {
            const diffHours = Math.floor(diffSeconds / 3600);
            return `${diffHours}h ago`;
        } else {
            return commentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }
}

// Make globally available
window.CommentsService = CommentsService;

// Create alias for backward compatibility
window.CommentService = CommentsService;