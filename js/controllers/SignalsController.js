// SignalsController - Handles signal feed tab and signal interactions
class SignalsController {
    constructor() {
        this.subscribeToStore();
        this.setupEventListeners();
        console.log('🎯 SignalsController initialized');
    }
    
    subscribeToStore() {
        // Subscribe to store changes relevant to signals
        signalsStore.subscribe('feedback-updated', (state, data) => {
            console.log(`🎯 SignalsController received feedback-updated event`);
            this.render();
        });
        
        signalsStore.subscribe('signals-updated', (state, data) => {
            console.log(`🎯 SignalsController received signals-updated event`);
            this.render();
        });
        
        signalsStore.subscribe('comments-updated', (state, data) => {
            console.log(`🎯 SignalsController received comments-updated event`, data);
            console.log(`🎯 Current state.comments size:`, state.comments?.size || 0);
            this.render();
        });
        
        signalsStore.subscribe('signal-viewed', (state, data) => {
            console.log(`🎯 SignalsController received signal-viewed event`);
            this.render();
        });
        
        signalsStore.subscribe('signals:filtered', (state, data) => {
            console.log(`🎯 SignalsController received signals:filtered event`);
            this.render();
        });
        
        signalsStore.subscribe('signal-removed', (state, data) => {
            console.log(`🎯 SignalsController received signal-removed event`);
            this.render();
        });
        
        signalsStore.subscribe('accounts-updated', (state, data) => {
            console.log(`🎯 SignalsController received accounts-updated event`);
            this.render();
        });
    }
    
    setupEventListeners() {
        // Set up delegated event handling for signal interactions - scoped to signal feed only
        const signalFeedContainer = document.getElementById('signal-feed');
        if (signalFeedContainer) {
            signalFeedContainer.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                const signalId = target.getAttribute('data-signal-id');
                
                // Only handle signal-related actions (excluding comments)
                if (this.isSignalAction(action)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleSignalAction(action, signalId, target);
                }
            });
        }
        
        // Filter events for signal feed
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                const signalType = document.getElementById('signalTypeFilter')?.value || 'all';
                const category = categoryFilter.value;
                dispatcher.dispatch(Actions.applyFilters({ signalType, category }));
            });
        }
        
        const signalTypeFilter = document.getElementById('signalTypeFilter');
        if (signalTypeFilter) {
            signalTypeFilter.addEventListener('change', () => {
                const category = document.getElementById('categoryFilter')?.value || 'all';
                const signalType = signalTypeFilter.value;
                dispatcher.dispatch(Actions.applyFilters({ signalType, category }));
            });
        }
    }
    
    isSignalAction(action) {
        const signalActions = [
            'remove-signal', 'view-signal'
        ];
        return signalActions.includes(action);
    }
    
    handleSignalAction(action, signalId, target) {
        const commentId = target.getAttribute('data-comment-id');
        
        switch (action) {
            case 'remove-signal':
                if (confirm('Are you sure you want to remove this signal from your feed?')) {
                    dispatcher.dispatch(Actions.removeSignalFromFeed(signalId));
                }
                break;
                
            case 'view-signal':
                dispatcher.dispatch(Actions.markSignalAsViewed(signalId));
                dispatcher.dispatch(Actions.openSignalDetails(signalId));
                break;
                
            default:
                console.warn(`Unknown signal action: ${action}`);
        }
    }
    
    handleEditComment(commentId, signalId) {
        const commentElement = document.getElementById(`comment-text-${commentId}`);
        if (!commentElement) return;
        
        const currentText = commentElement.textContent;
        const newText = prompt('Edit comment:', currentText);
        
        if (newText !== null && newText.trim() !== currentText) {
            dispatcher.dispatch(Actions.updateComment(commentId, signalId, newText.trim()));
        }
    }
    
    render(state = null) {
        if (!state) {
            state = signalsStore.getState();
        }
        
        // Check if we're on the signal feed tab
        if (document.getElementById('signal-feed')?.classList.contains('active')) {
            
            // Update signal feed summary
            this.updateSignalFeedSummary(state);
            
            // Use the centralized filteredSignals from the store
            // The store already manages filtering based on viewState.filters
            const filteredSignals = state.filteredSignals || [];
            
            // Create comments map for SignalRenderer
            const commentsMap = new Map();
            filteredSignals.forEach(signal => {
                const signalComments = signalsStore.getComments(signal.id);
                commentsMap.set(signal.id, signalComments);
                if (signalComments.length > 0) {
                    console.log(`💬 Comments for signal ${signal.id}:`, signalComments);
                }
            });
            
            // Call the pure SignalRenderer with store data
            SignalRenderer.renderSignalFeed(
                filteredSignals,
                state.viewState,
                commentsMap,
                state.interactions,
                state.actionPlans
            );
            
            console.log(`🎨 Rendered ${filteredSignals.length} signals in feed`);
        }
    }
    
    updateSignalFeedSummary(state) {
        try {
            const allSignals = state.signals || [];
            const accounts = state.accounts || new Map();
            
            // Filter for high priority signals
            const highPrioritySignals = allSignals.filter(signal => 
                signal.priority === 'High' || signal.priority === 'high'
            );
            
            // Get unique account IDs from high priority signals
            const uniqueAccountIds = new Set(
                highPrioritySignals.map(signal => signal.account_id).filter(id => id)
            );
            
            // Calculate total renewal baseline for unique accounts
            let totalRenewalBaseline = 0;
            const processedAccountIds = new Set();
            
            for (const signal of highPrioritySignals) {
                if (signal.account_id && !processedAccountIds.has(signal.account_id)) {
                    const account = accounts.get(signal.account_id);
                    if (account) {
                        const renewalBaseline = account.bks_baseline_renewal_usd || 
                                             account.bks_renewal_baseline_usd || 
                                             account['Renewal Baseline USD'] || 
                                             0;
                        totalRenewalBaseline += parseFloat(renewalBaseline) || 0;
                        processedAccountIds.add(signal.account_id);
                    }
                }
            }
            
            // Format the summary text
            const count = uniqueAccountIds.size;
            const formattedAmount = FormatUtils.formatCurrency(totalRenewalBaseline);
            const summaryText = `${count} High priority signal${count !== 1 ? 's' : ''} identified representing ${formattedAmount} of Renewal Baseline`;
            
            // Update the DOM
            const summaryElement = document.getElementById('signal-feed-summary');
            if (summaryElement) {
                summaryElement.textContent = summaryText;
            }
            
            console.log(`📊 Signal Feed Summary: ${count} unique accounts, $${totalRenewalBaseline.toLocaleString()} total renewal baseline`);
            
        } catch (error) {
            console.error('Error updating signal feed summary:', error);
            const summaryElement = document.getElementById('signal-feed-summary');
            if (summaryElement) {
                summaryElement.textContent = 'Error calculating signal summary';
            }
        }
    }
    
    // DEPRECATED: Filtering is now centralized in SignalsStore
    // Use state.filteredSignals directly instead of calling this method
    getFilteredSignals(state) {
        console.warn('getFilteredSignals is deprecated. Use state.filteredSignals directly.');
        return state.filteredSignals || [];
    }
    
    applyFilters(priority = 'all', category = 'all', searchText = '') {
        dispatcher.dispatch(Actions.applyFilters({
            priority,
            category,
            searchText
        }));
    }
    
    markSignalAsViewed(signalId) {
        dispatcher.dispatch(Actions.markSignalAsViewed(signalId));
    }
    
    // Helper method for external usage
    refreshSignalFeed() {
        this.render();
    }
}

// Make globally available
window.SignalsController = SignalsController;