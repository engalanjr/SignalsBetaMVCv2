// Actions - Centralized action types and creators for Flux architecture
class Actions {
    
    // Action Types - All possible actions in the application
    static Types = {
        // App Lifecycle
        APP_INITIALIZED: 'APP_INITIALIZED',
        TAB_CHANGED: 'TAB_CHANGED',
        
        // Data Loading
        DATA_LOAD_REQUESTED: 'DATA_LOAD_REQUESTED',
        DATA_LOAD_STARTED: 'DATA_LOAD_STARTED',
        DATA_LOAD_SUCCESS: 'DATA_LOAD_SUCCESS',
        DATA_LOAD_FAILED: 'DATA_LOAD_FAILED',
        DATA_PAGE_LOADED: 'DATA_PAGE_LOADED',
        LOAD_NEXT_PAGE: 'LOAD_NEXT_PAGE',
        
        // Signal Management
        SIGNALS_FILTERED: 'SIGNALS_FILTERED',
        SIGNAL_VIEWED: 'SIGNAL_VIEWED',
        SIGNAL_SELECTED: 'SIGNAL_SELECTED',
        SIGNAL_REMOVED: 'SIGNAL_REMOVED',
        SIGNAL_DETAILS_OPENED: 'SIGNAL_DETAILS_OPENED',
        
        // Feedback Actions (with optimistic flow)
        FEEDBACK_REQUESTED: 'FEEDBACK_REQUESTED',
        FEEDBACK_SUCCEEDED: 'FEEDBACK_SUCCEEDED',
        FEEDBACK_FAILED: 'FEEDBACK_FAILED',
        FEEDBACK_REMOVED: 'FEEDBACK_REMOVED',
        
        // Comments
        COMMENT_REQUESTED: 'COMMENT_REQUESTED',
        COMMENT_SUCCEEDED: 'COMMENT_SUCCEEDED',
        COMMENT_FAILED: 'COMMENT_FAILED',
        COMMENT_UPDATED: 'COMMENT_UPDATED',
        COMMENT_DELETED: 'COMMENT_DELETED',
        
        // Action Plans
        ACTION_PLAN_REQUESTED: 'ACTION_PLAN_REQUESTED',
        ACTION_PLAN_SUCCEEDED: 'ACTION_PLAN_SUCCEEDED',
        ACTION_PLAN_FAILED: 'ACTION_PLAN_FAILED',
        ACTION_PLAN_UPDATED: 'ACTION_PLAN_UPDATED',
        ACTION_PLAN_DELETED: 'ACTION_PLAN_DELETED',
        
        // UI State
        LOADING_SHOWN: 'LOADING_SHOWN',
        LOADING_HIDDEN: 'LOADING_HIDDEN',
        MESSAGE_SHOWN: 'MESSAGE_SHOWN',
        MESSAGE_HIDDEN: 'MESSAGE_HIDDEN',
        
        // Modal/Drawer State
        MODAL_OPENED: 'MODAL_OPENED',
        MODAL_CLOSED: 'MODAL_CLOSED',
        DRAWER_OPENED: 'DRAWER_OPENED',
        DRAWER_CLOSED: 'DRAWER_CLOSED',
        PLAN_DRAWER_CLOSED: 'PLAN_DRAWER_CLOSED',
        SIGNAL_DRAWER_CLOSED: 'SIGNAL_DRAWER_CLOSED',
        
        // Portfolio Filters
        PORTFOLIO_FILTERED: 'PORTFOLIO_FILTERED',
        
        // Account Management
        ACCOUNT_EXPANDED: 'ACCOUNT_EXPANDED',
        ACCOUNT_COLLAPSED: 'ACCOUNT_COLLAPSED',
        SHOW_MORE_SIGNALS: 'SHOW_MORE_SIGNALS',
        SHOW_LESS_SIGNALS: 'SHOW_LESS_SIGNALS'
    };
    
    // Action Creators - Functions that create action objects
    
    // App Lifecycle Actions
    static initializeApp(data) {
        return {
            type: this.Types.APP_INITIALIZED,
            payload: { data },
            timestamp: Date.now()
        };
    }
    
    static changeTab(tabName) {
        return {
            type: this.Types.TAB_CHANGED,
            payload: { tabName },
            timestamp: Date.now()
        };
    }
    
    // Alias for consistency
    static switchTab(tabName) {
        return this.changeTab(tabName);
    }
    
    static tabSwitched(tabName) {
        return this.changeTab(tabName);
    }
    
    // Data Loading Actions
    static dataLoadRequested() {
        return {
            type: this.Types.DATA_LOAD_REQUESTED,
            timestamp: Date.now()
        };
    }
    
    static startDataLoad() {
        return {
            type: this.Types.DATA_LOAD_STARTED,
            timestamp: Date.now()
        };
    }
    
    static dataLoadSuccess(data) {
        return {
            type: this.Types.DATA_LOAD_SUCCESS,
            payload: { data },
            timestamp: Date.now()
        };
    }
    
    static dataLoadFailed(error) {
        return {
            type: this.Types.DATA_LOAD_FAILED,
            payload: { error },
            timestamp: Date.now()
        };
    }
    
    // Pagination Actions
    static dataPageLoaded(data) {
        return {
            type: this.Types.DATA_PAGE_LOADED,
            payload: { data },
            timestamp: Date.now()
        };
    }
    
    static loadNextPage() {
        return {
            type: this.Types.LOAD_NEXT_PAGE,
            timestamp: Date.now()
        };
    }
    
    // Signal Actions
    static filterSignals(filters) {
        return {
            type: this.Types.SIGNALS_FILTERED,
            payload: { filters },
            timestamp: Date.now()
        };
    }
    
    // Alias for consistency
    static applyFilters(filters) {
        return this.filterSignals(filters);
    }
    
    static viewSignal(signalId) {
        return {
            type: this.Types.SIGNAL_VIEWED,
            payload: { signalId },
            timestamp: Date.now()
        };
    }
    
    // Alias for consistency
    static markSignalAsViewed(signalId) {
        return this.viewSignal(signalId);
    }
    
    static removeSignalFromFeed(signalId) {
        return {
            type: this.Types.SIGNAL_REMOVED,
            payload: { signalId },
            timestamp: Date.now()
        };
    }
    
    static openSignalDetails(signalId) {
        return {
            type: this.Types.SIGNAL_DETAILS_OPENED,
            payload: { signalId },
            timestamp: Date.now()
        };
    }
    
    static selectSignal(signal) {
        return {
            type: this.Types.SIGNAL_SELECTED,
            payload: { signal },
            timestamp: Date.now()
        };
    }
    
    // Feedback Actions (Optimistic Pattern)
    static requestFeedback(signalId, feedbackType, userId) {
        return {
            type: this.Types.FEEDBACK_REQUESTED,
            payload: { 
                signalId, 
                feedbackType, 
                userId,
                operationId: `feedback_${signalId}_${Date.now()}`
            },
            timestamp: Date.now()
        };
    }
    
    static feedbackSucceeded(signalId, feedbackType, operationId) {
        return {
            type: this.Types.FEEDBACK_SUCCEEDED,
            payload: { signalId, feedbackType, operationId },
            timestamp: Date.now()
        };
    }
    
    static feedbackFailed(signalId, feedbackType, operationId, error) {
        return {
            type: this.Types.FEEDBACK_FAILED,
            payload: { signalId, feedbackType, operationId, error },
            timestamp: Date.now()
        };
    }
    
    static removeFeedback(signalId, userId) {
        return {
            type: this.Types.FEEDBACK_REMOVED,
            payload: { signalId, userId },
            timestamp: Date.now()
        };
    }
    
    // Alias for submitFeedback (for backward compatibility)
    static submitFeedback(signalId, feedbackType, userId = null) {
        return this.requestFeedback(signalId, feedbackType, userId);
    }
    
    // Comment Actions
    static requestComment(signalId, accountId, text, userId) {
        return {
            type: this.Types.COMMENT_REQUESTED,
            payload: { 
                signalId, 
                accountId, 
                text, 
                userId,
                operationId: `comment_${signalId || accountId}_${Date.now()}`
            },
            timestamp: Date.now()
        };
    }
    
    // Alias for backward compatibility
    static addComment(signalId, text, userId = null) {
        return this.requestComment(signalId, null, text, userId);
    }
    
    // Alias for account comments
    static addAccountComment(accountId, text, userId = null) {
        return this.requestComment(null, accountId, text, userId);
    }
    
    static commentSucceeded(comment, operationId) {
        return {
            type: this.Types.COMMENT_SUCCEEDED,
            payload: { comment, operationId },
            timestamp: Date.now()
        };
    }
    
    static commentFailed(operationId, error) {
        return {
            type: this.Types.COMMENT_FAILED,
            payload: { operationId, error },
            timestamp: Date.now()
        };
    }
    
    static updateComment(commentId, text) {
        return {
            type: this.Types.COMMENT_UPDATED,
            payload: { commentId, text },
            timestamp: Date.now()
        };
    }
    
    static deleteComment(commentId) {
        return {
            type: this.Types.COMMENT_DELETED,
            payload: { commentId },
            timestamp: Date.now()
        };
    }
    
    // Additional Action Plan Actions (using standard naming)
    static updateActionPlan(planId, updates) {
        return {
            type: this.Types.ACTION_PLAN_UPDATED,
            payload: { planId, updates },
            timestamp: Date.now()
        };
    }
    
    static deleteActionPlan(planId) {
        return {
            type: this.Types.ACTION_PLAN_DELETED,
            payload: { planId },
            timestamp: Date.now()
        };
    }
    
    // Action Plan Actions
    static requestActionPlan(signalId, title, description, tasks, userId, accountId = null) {
        return {
            type: this.Types.ACTION_PLAN_REQUESTED,
            payload: { 
                signalId, 
                title, 
                description, 
                tasks, 
                userId,
                accountId,
                operationId: `plan_${signalId}_${Date.now()}`
            },
            timestamp: Date.now()
        };
    }
    
    static actionPlanSucceeded(plan, operationId) {
        return {
            type: this.Types.ACTION_PLAN_SUCCEEDED,
            payload: { plan, operationId },
            timestamp: Date.now()
        };
    }
    
    static actionPlanFailed(operationId, error) {
        return {
            type: this.Types.ACTION_PLAN_FAILED,
            payload: { operationId, error },
            timestamp: Date.now()
        };
    }
    
    // UI State Actions
    static showLoading() {
        return {
            type: this.Types.LOADING_SHOWN,
            timestamp: Date.now()
        };
    }
    
    static hideLoading() {
        return {
            type: this.Types.LOADING_HIDDEN,
            timestamp: Date.now()
        };
    }
    
    static showMessage(message, type = 'info') {
        return {
            type: this.Types.MESSAGE_SHOWN,
            payload: { message, type },
            timestamp: Date.now()
        };
    }
    
    static hideMessage() {
        return {
            type: this.Types.MESSAGE_HIDDEN,
            timestamp: Date.now()
        };
    }
    
    // Modal/Drawer Actions
    static openModal(modalType, data = null) {
        return {
            type: this.Types.MODAL_OPENED,
            payload: { modalType, data },
            timestamp: Date.now()
        };
    }
    
    static closeModal() {
        return {
            type: this.Types.MODAL_CLOSED,
            timestamp: Date.now()
        };
    }
    
    static openDrawer(drawerType, data = null) {
        return {
            type: this.Types.DRAWER_OPENED,
            payload: { drawerType, data },
            timestamp: Date.now()
        };
    }
    
    static closeDrawer() {
        return {
            type: this.Types.DRAWER_CLOSED,
            timestamp: Date.now()
        };
    }
    
    // Specific drawer actions
    static closePlanDrawer() {
        return {
            type: this.Types.PLAN_DRAWER_CLOSED,
            timestamp: Date.now()
        };
    }
    
    static closeSignalDrawer() {
        return {
            type: this.Types.SIGNAL_DRAWER_CLOSED,
            timestamp: Date.now()
        };
    }
    
    // Action Plan Actions
    static createActionPlan(data = null) {
        return {
            type: this.Types.ACTION_PLAN_REQUESTED,
            payload: { data },
            timestamp: Date.now()
        };
    }
    
    // Portfolio Filter Actions
    static applyPortfolioFilter(filterType) {
        return {
            type: this.Types.PORTFOLIO_FILTERED,
            payload: { filterType },
            timestamp: Date.now()
        };
    }
    
    // Account Management Actions
    static expandAccount(accountId) {
        return {
            type: this.Types.ACCOUNT_EXPANDED,
            payload: { accountId },
            timestamp: Date.now()
        };
    }
    
    static collapseAccount(accountId) {
        return {
            type: this.Types.ACCOUNT_COLLAPSED,
            payload: { accountId },
            timestamp: Date.now()
        };
    }
    
    static showMoreSignalsForAccount(accountId) {
        return {
            type: this.Types.SHOW_MORE_SIGNALS,
            payload: { accountId },
            timestamp: Date.now()
        };
    }
    
    static showLessSignalsForAccount(accountId) {
        return {
            type: this.Types.SHOW_LESS_SIGNALS,
            payload: { accountId },
            timestamp: Date.now()
        };
    }
}

// Make Actions globally available
window.Actions = Actions;