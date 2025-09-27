// PortfolioController - Handles portfolio tab and account management
class PortfolioController {
    constructor() {
        this.subscribeToStore();
        this.setupEventListeners();
        console.log('🎯 PortfolioController initialized');
    }
    
    subscribeToStore() {
        // Subscribe to store changes relevant to portfolio
        console.log('🔌 PortfolioController: Setting up store subscription');
        
        signalsStore.subscribe('accounts-updated', (state, data) => {
            console.log(`📡 PortfolioController: Received accounts-updated event`);
            this.render();
        });
        
        signalsStore.subscribe('action-plans-updated', (state, data) => {
            console.log(`📡 PortfolioController: Received action-plans-updated event`);
            this.render();
        });
        
        signalsStore.subscribe('comments-updated', (state, data) => {
            console.log(`📡 PortfolioController: Received comments-updated event`);
            console.log(`💬 PortfolioController: Comments updated, total comments in store:`, state.comments?.size || 0);
            this.render();
        });
        
        signalsStore.subscribe('data:loaded', (state, data) => {
            console.log(`📡 PortfolioController: Received data:loaded event`);
            this.render();
        });
    }
    
    setupEventListeners() {
        // Set up delegated event handling for portfolio interactions - scoped to portfolio only
        const portfolioContainer = document.getElementById('my-portfolio');
        if (portfolioContainer) {
            portfolioContainer.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                const accountId = target.getAttribute('data-account-id');
                const signalId = target.getAttribute('data-signal-id');
                
                console.log('💬 PortfolioController: Click event captured:', { action, accountId, signalId, target });
                
                // Only handle portfolio-related actions (excluding comments and view-signal)
                if (this.isPortfolioAction(action)) {
                    console.log('💬 PortfolioController: Handling portfolio action:', action);
                    e.preventDefault();
                    e.stopPropagation();
                    this.handlePortfolioAction(action, accountId, signalId, target);
                } else {
                    console.log('💬 PortfolioController: Action not handled:', action);
                }
            });
        }
        
        // Portfolio filter buttons
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Dispatch filter action
                const filterType = e.target.getAttribute('data-filter');
                dispatcher.dispatch(Actions.applyPortfolioFilter(filterType));
            });
        });
    }
    
    isPortfolioAction(action) {
        const portfolioActions = [
            'toggle-account-signals', 'show-more-signals', 'show-less-signals', 'view-signal', 'add-account-comment'
        ];
        return portfolioActions.includes(action);
    }
    
    handlePortfolioAction(action, accountId, signalId, target) {
        switch (action) {
            case 'toggle-account-signals':
                this.toggleAccountSignals(accountId);
                break;
                
            case 'show-more-signals':
                this.showMoreSignalsForAccount(accountId);
                break;
                
            case 'show-less-signals':
                this.showLessSignalsForAccount(accountId);
                break;
                
            case 'view-signal':
                // Handle view-signal from portfolio context only
                if (signalId) {
                    dispatcher.dispatch(Actions.markSignalAsViewed(signalId));
                    dispatcher.dispatch(Actions.openSignalDetails(signalId));
                }
                break;
                
            case 'add-account-comment':
                this.handleAddAccountComment(accountId, target);
                break;
                
            default:
                console.warn(`Unknown portfolio action: ${action}`);
        }
    }
    
    toggleAccountSignals(accountId) {
        const signalsContainer = document.getElementById(`signals-${accountId}`);
        const chevron = document.getElementById(`chevron-${accountId}`);
        
        if (signalsContainer && chevron) {
            const isExpanded = signalsContainer.classList.contains('expanded');
            
            if (isExpanded) {
                signalsContainer.classList.remove('expanded');
                chevron.classList.remove('rotated');
                dispatcher.dispatch(Actions.collapseAccount(accountId));
            } else {
                signalsContainer.classList.add('expanded');
                chevron.classList.add('rotated');
                dispatcher.dispatch(Actions.expandAccount(accountId));
            }
        }
    }
    
    showMoreSignalsForAccount(accountId) {
        dispatcher.dispatch(Actions.showMoreSignalsForAccount(accountId));
        // Re-render just this account card
        this.updateSingleAccount(accountId);
    }
    
    showLessSignalsForAccount(accountId) {
        dispatcher.dispatch(Actions.showLessSignalsForAccount(accountId));
        // Re-render just this account card
        this.updateSingleAccount(accountId);
    }
    
    handleAddAccountComment(accountId, target) {
        console.log('💬 PortfolioController.handleAddAccountComment called:', { accountId, target });
        
        const inputElement = document.getElementById(`accountCommentInput-${accountId}`);
        if (inputElement && inputElement.value.trim()) {
            const commentText = inputElement.value.trim();
            console.log('💬 Adding account comment:', { accountId, commentText });
            
            const state = signalsStore.getState();
            const userId = state.currentUser?.id || 1; // Default user ID
            console.log('💬 Dispatching addAccountComment:', { accountId, commentText, userId });
            
            dispatcher.dispatch(Actions.addAccountComment(accountId, commentText, userId));
            inputElement.value = '';
        } else {
            console.log('💬 No comment text or input element not found');
        }
    }
    
    async render(state = null) {
        if (!state) {
            state = signalsStore.getState();
        }
        
        // Check if we're on the portfolio tab
        if (document.getElementById('my-portfolio')?.classList.contains('active')) {
            
            // Check if we need to load action plans data
            if (!state.actionPlans || state.actionPlans.size === 0) {
                console.log('🔄 PortfolioController: No action plans in state, loading fallback data...');
                await this.loadFallbackActionPlans();
                // Get updated state after loading
                state = signalsStore.getState();
            }
            
            // Call the pure PortfolioRenderer with store data
            PortfolioRenderer.renderMyPortfolio(
                state.accounts,
                state.actionPlans,
                state.comments,
                state
            );
            
                // Initialize call tooltips after rendering
                PortfolioRenderer.initializeCallTooltips();
                
                // Initialize hero card filters
                PortfolioRenderer.initializeHeroFilters();
                
                // 🎯 Initialize button states for optimistic UI
                setTimeout(() => {
                    PortfolioRenderer.initializePlanButtonStates(state);
                }, 50); // Small delay to ensure DOM is updated
            
            console.log(`🎨 Rendered ${state.accounts.size} accounts in portfolio`);
        }
    }

    async loadFallbackActionPlans() {
        try {
            console.log('📋 Loading fallback action plans...');
            const response = await fetch('/action-plans-fallback.json');
            const fallbackData = await response.json();
            
            if (fallbackData && fallbackData.length > 0) {
                console.log(`📦 Loaded ${fallbackData.length} action plans from fallback`);
                console.log('📋 Fallback data sample:', fallbackData[0]);
                
                // Process and store the action plans
                const actionPlans = new Map();
                fallbackData.forEach((record, index) => {
                    // Extract the actual plan data from the nested content structure
                    const content = record.content || record;
                    const planId = content.id || `plan-${Date.now()}-${index}`;
                    const planData = {
                        id: planId,
                        actionId: content.actionId,
                        accountId: content.accountId,
                        title: content.title,
                        status: content.status || 'pending',
                        priority: content.priority || 'Medium',
                        dueDate: content.dueDate,
                        assignee: content.assignee,
                        createdDate: content.createdDate || content.createdAt || new Date().toISOString(),
                        createdAt: content.createdAt || content.createdDate,
                        updatedAt: content.updatedAt,
                        planTitle: content.planTitle,
                        createdBy: content.createdBy,
                        createdByUserId: content.createdByUserId,
                        signalPolarity: content.signalPolarity,
                        description: content.description,
                        accountName: `Account ${content.accountId}`, // Fallback name
                        // Add plays data if available
                        plays: content.plays || []
                    };
                    actionPlans.set(planId, planData);
                    console.log(`📋 Processed plan ${index}:`, {
                        id: planData.id,
                        actionId: planData.actionId,
                        accountId: planData.accountId,
                        title: planData.title
                    });
                });
                
                // Update the state with the loaded action plans
                signalsStore.setState({ actionPlans: actionPlans });
                console.log(`✅ Updated state with ${actionPlans.size} action plans`);
            }
        } catch (error) {
            console.error('❌ Failed to load fallback action plans:', error);
        }
    }
    
    updateSingleAccount(accountId) {
        const state = signalsStore.getState();
        
        // Use the pure PortfolioRenderer method with store data
        PortfolioRenderer.updateSingleAccount(
            accountId,
            state.accounts,
            state.actionPlans,
            state.comments
        );
    }
    
    // Helper methods for external usage
    createActionPlanForAccount(accountId) {
        const state = signalsStore.getState();
        const account = state.accounts.get(accountId);
        
        if (account && account.signals.length > 0) {
            // Use the highest priority signal from this account, or the most recent one
            const highPrioritySignals = account.signals.filter(s => s.priority === 'High');
            const selectedSignal = highPrioritySignals.length > 0
                ? highPrioritySignals.sort((a, b) => new Date(b.created_date || Date.now()) - new Date(a.created_date || Date.now()))[0]
                : account.signals.sort((a, b) => new Date(b.created_date || Date.now()) - new Date(a.created_date || Date.now()))[0];

            dispatcher.dispatch(Actions.createActionPlanForAccount(accountId, selectedSignal.id));
        } else {
            dispatcher.dispatch(Actions.createActionPlanForAccount(accountId, null));
        }
    }
    
    selectActionPlanToEdit(accountId) {
        const state = signalsStore.getState();
        
        // Get all plans for this account
        const accountPlans = Array.from(state.actionPlans.values())
            .filter(plan => plan.accountId === accountId);
        
        if (accountPlans.length === 1) {
            // Only one plan, edit it directly
            dispatcher.dispatch(Actions.editActionPlan(accountPlans[0].id));
        } else if (accountPlans.length > 1) {
            // Multiple plans, show selection modal
            dispatcher.dispatch(Actions.showPlanSelectionModal(accountId, accountPlans));
        } else {
            // No plans found, create new one
            this.createActionPlanForAccount(accountId);
        }
    }
    
    refreshPortfolio() {
        this.render();
    }
}

// Make globally available
window.PortfolioController = PortfolioController;