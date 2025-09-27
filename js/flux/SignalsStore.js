// SignalsStore - Normalized Relational Model with Backward Compatibility
class SignalsStore extends Store {
    
    constructor() {
        super('SignalsStore');
        
        // Initialize normalized entity stores
        this.normalizedData = {
            accounts: new Map(),
            signals: new Map(),
            recommendedActions: new Map(),
            interactions: new Map(),
            comments: new Map(),
            actionPlans: new Map()
        };
        
        // Initialize relationship indexes
        this.indexes = {
            signalsByAccount: new Map(),
            signalsByAction: new Map(),
            actionsByAccount: new Map(),
            interactionsBySignal: new Map(),
            commentsBySignal: new Map(),
            commentsByAccount: new Map(),
            plansByAccount: new Map(),
            plansByAction: new Map()
        };
        
        // Initialize state structure (for backward compatibility)
        this.setInitialState({
            // Core data (denormalized for backward compatibility)
            signals: [],
            accounts: new Map(),
            comments: new Map(),
            interactions: new Map(),
            actionPlans: new Map(),
            userInfo: {},
            
            // Pagination state
            pagination: {
                currentPage: 0,
                pageSize: 200,
                totalSignals: 0,
                loadedSignals: 0,
                hasMore: false,
                isLoading: false
            },
            
            // Cache for fast tab switching
            viewCache: {
                signalFeed: null,
                portfolio: null,
                whitespace: null,
                lastUpdate: 0
            },
            
            // Indexes for performance
            signalsById: new Map(),
            signalsByAccount: new Map(),
            interactionsByUser: new Map(),
            actionPlansByAccount: new Map(),
            
            // UI state
            currentTab: 'whitespace',
            selectedSignal: null,
            filteredSignals: [],
            loading: false,
            message: null,
            
            // View state with filters
            viewState: {
                filters: {
                    signalType: 'all',
                    category: 'all',
                    searchText: '',
                    priority: 'all',
                    polarity: 'all',
                    riskCategory: 'all'
                },
                pagination: {
                    page: 1,
                    pageSize: 20
                },
                viewedSignals: new Set() // 🔧 CRITICAL FIX: Initialize viewedSignals set
            },
            
            // Modal/Drawer state
            modal: { isOpen: false, type: null, data: null },
            drawer: { isOpen: false, type: null, data: null }
        });
    }
    
    /**
     * Main dispatch handler - routes actions to reducers
     */
    dispatch(action) {
        const { type, payload } = action;
        
        switch (type) {
            // App Lifecycle
            case Actions.Types.APP_INITIALIZED:
                this.handleAppInitialized(payload);
                break;
            case Actions.Types.TAB_CHANGED:
                this.handleTabChanged(payload);
                break;
                
            // Data Loading
            case Actions.Types.DATA_LOAD_REQUESTED:
                this.handleDataLoadRequested();
                break;
            case Actions.Types.DATA_LOAD_STARTED:
                this.handleDataLoadStarted();
                break;
            case Actions.Types.DATA_LOAD_SUCCESS:
                this.handleDataLoadSuccess(payload);
                break;
            case Actions.Types.DATA_LOAD_FAILED:
                this.handleDataLoadFailed(payload);
                break;
            case Actions.Types.DATA_PAGE_LOADED:
                this.handleDataPageLoaded(payload);
                break;
            case Actions.Types.LOAD_NEXT_PAGE:
                this.handleLoadNextPage();
                break;
                
            // Signal Management
            case Actions.Types.SIGNALS_FILTERED:
                this.handleSignalsFiltered(payload);
                break;
            case Actions.Types.SIGNAL_VIEWED:
                this.handleSignalViewed(payload);
                break;
            case Actions.Types.SIGNAL_SELECTED:
                this.handleSignalSelected(payload);
                break;
            case Actions.Types.SIGNAL_REMOVED:
                this.handleSignalRemoved(payload);
                break;
            case Actions.Types.SIGNAL_DETAILS_OPENED:
                this.handleSignalDetailsOpened(payload);
                break;
                
            // Feedback (Optimistic Updates)
            case Actions.Types.FEEDBACK_REQUESTED:
                this.handleFeedbackRequested(payload);
                break;
            case Actions.Types.FEEDBACK_SUCCEEDED:
                this.handleFeedbackSucceeded(payload);
                break;
            case Actions.Types.FEEDBACK_FAILED:
                this.handleFeedbackFailed(payload);
                break;
            case Actions.Types.FEEDBACK_REMOVED:
                this.handleFeedbackRemoved(payload);
                break;
                
            // Comments
            case Actions.Types.COMMENT_REQUESTED:
                this.handleCommentRequested(payload);
                break;
            case Actions.Types.COMMENT_SUCCEEDED:
                this.handleCommentSucceeded(payload);
                break;
            case Actions.Types.COMMENT_FAILED:
                this.handleCommentFailed(payload);
                break;
                
            // Action Plans
            case Actions.Types.ACTION_PLAN_REQUESTED:
                this.handleActionPlanRequested(payload);
                break;
            case Actions.Types.ACTION_PLAN_SUCCEEDED:
                this.handleActionPlanSucceeded(payload);
                break;
            case Actions.Types.ACTION_PLAN_FAILED:
                this.handleActionPlanFailed(payload);
                break;
            case Actions.Types.ACTION_PLAN_UPDATED:
                this.handleUpdateActionPlan(payload);
                break;
            case Actions.Types.ACTION_PLAN_DELETED:
                this.handleDeleteActionPlan(payload);
                break;
                
            // UI State
            case Actions.Types.LOADING_SHOWN:
                this.handleLoadingShown();
                break;
            case Actions.Types.LOADING_HIDDEN:
                this.handleLoadingHidden();
                break;
            case Actions.Types.MESSAGE_SHOWN:
                this.handleMessageShown(payload);
                break;
            case Actions.Types.MESSAGE_HIDDEN:
                this.handleMessageHidden();
                break;
            case Actions.Types.PLAN_DRAWER_CLOSED:
                this.handlePlanDrawerClosed();
                break;
            case Actions.Types.SIGNAL_DRAWER_CLOSED:
                this.handleSignalDrawerClosed();
                break;
            case Actions.Types.PORTFOLIO_FILTERED:
                this.handlePortfolioFiltered(payload);
                break;
                
            // Account Management
            case Actions.Types.ACCOUNT_EXPANDED:
                this.handleAccountExpanded(payload);
                break;
            case Actions.Types.ACCOUNT_COLLAPSED:
                this.handleAccountCollapsed(payload);
                break;
            case Actions.Types.SHOW_MORE_SIGNALS:
                this.handleShowMoreSignals(payload);
                break;
            case Actions.Types.SHOW_LESS_SIGNALS:
                this.handleShowLessSignals(payload);
                break;
                
            // Modal/Drawer
            case Actions.Types.MODAL_OPENED:
                this.handleModalOpened(payload);
                break;
            case Actions.Types.MODAL_CLOSED:
                this.handleModalClosed();
                break;
            case Actions.Types.DRAWER_OPENED:
                this.handleDrawerOpened(payload);
                break;
            case Actions.Types.DRAWER_CLOSED:
                this.handleDrawerClosed();
                break;
                
            default:
                console.log(`Unhandled action type: ${type}`);
        }
    }
    
    // ========== NORMALIZED DATA HANDLERS ==========
    
    /**
     * Handle data page loaded (pagination)
     */
    handleDataPageLoaded(payload) {
        console.log('📄 SignalsStore: handleDataPageLoaded');
        const { data } = payload;
        
        // Add new signals to normalized data
        if (data.signals) {
            data.signals.forEach((signal, id) => {
                this.normalizedData.signals.set(id, signal);
            });
        }
        
        // Add new accounts if any
        if (data.accounts) {
            data.accounts.forEach((account, id) => {
                if (!this.normalizedData.accounts.has(id)) {
                    this.normalizedData.accounts.set(id, account);
                }
            });
        }
        
        // Add new recommended actions if any
        if (data.recommendedActions) {
            data.recommendedActions.forEach((action, id) => {
                if (!this.normalizedData.recommendedActions.has(id)) {
                    this.normalizedData.recommendedActions.set(id, action);
                }
            });
        }
        
        // Update pagination state
        if (data.pagination) {
            this.state.pagination = { ...this.state.pagination, ...data.pagination };
        }
        
        // Update denormalized signals array for backward compatibility
        this.state.signals = Array.from(this.normalizedData.signals.values());
        
        // 🔧 CRITICAL FIX: Update filtered signals to include new page data
        const updatedFilteredSignals = this.applyFilters(this.state.viewState.filters);
        this.setState({ 
            filteredSignals: updatedFilteredSignals 
        });
        
        // Clear cache to force re-render
        this.state.viewCache.lastUpdate = Date.now();
        
        this.emitChange('data:page-loaded');
    }
    
    /**
     * Handle load next page request
     */
    async handleLoadNextPage() {
        if (this.state.pagination.isLoading || !this.state.pagination.hasMore) {
            return;
        }
        
        this.state.pagination.isLoading = true;
        this.emit('loading:page');
        
        try {
            const result = await SignalsRepository.loadNextPage();
            this.state.pagination.isLoading = false;
            
            if (!result.hasMore) {
                console.log('✅ All signals loaded');
            }
        } catch (error) {
            console.error('❌ Failed to load next page:', error);
            this.state.pagination.isLoading = false;
            this.emit('error:page-load');
        }
    }
    
    handleDataLoadSuccess(payload) {
        console.log('📦 SignalsStore: handleDataLoadSuccess with normalized data');
        
        const normalizedData = payload.data;
        
        // Store normalized entities
        this.normalizedData = {
            accounts: normalizedData.accounts || new Map(),
            signals: normalizedData.signals || new Map(),
            recommendedActions: normalizedData.recommendedActions || new Map(),
            interactions: normalizedData.interactions || new Map(),
            comments: normalizedData.comments || new Map(),
            actionPlans: normalizedData.actionPlans || new Map()
        };
        
        // Store relationship indexes
        this.indexes = {
            signalsByAccount: normalizedData.signalsByAccount || new Map(),
            signalsByAction: normalizedData.signalsByAction || new Map(),
            actionsByAccount: normalizedData.actionsByAccount || new Map(),
            interactionsBySignal: normalizedData.interactionsBySignal || new Map(),
            commentsBySignal: normalizedData.commentsBySignal || new Map(),
            commentsByAccount: normalizedData.commentsByAccount || new Map(),
            plansByAccount: normalizedData.plansByAccount || new Map(),
            plansByAction: normalizedData.plansByAction || new Map()
        };
        
        // Store user info
        const userInfo = normalizedData.userInfo || { userId: 'user-1', userName: 'Current User' };
        
        // Create denormalized data for backward compatibility
        const denormalizedSignals = this.getDenormalizedSignals();
        const denormalizedAccounts = this.getDenormalizedAccounts();
        
        this.setState({
            loading: false,
            userInfo: userInfo,
            signals: denormalizedSignals,
            accounts: denormalizedAccounts,
            filteredSignals: denormalizedSignals,
            signalsById: this.createSignalsById(denormalizedSignals),
            signalsByAccount: this.indexes.signalsByAccount,
            interactionsByUser: new Map(),
            actionPlansByAccount: this.indexes.plansByAccount,
            comments: this.normalizedData.comments,
            interactions: this.normalizedData.interactions,
            actionPlans: this.normalizedData.actionPlans
        });
        
        console.log('🔔 SignalsStore: Emitting data:loaded event');
        this.emitChange('data:loaded');
    }
    
    // ========== DENORMALIZATION HELPERS ==========
    
    getDenormalizedSignals() {
        const signals = Array.from(this.normalizedData.signals.values());
        return signals.map(signal => this.denormalizeSignal(signal));
    }
    
    denormalizeSignal(signal) {
        const account = this.normalizedData.accounts.get(signal.account_id);
        const action = this.normalizedData.recommendedActions.get(signal.action_id);
        const interactions = this.getSignalInteractions(signal.signal_id);
        
        // Check if user has interacted
        const hasUserInteraction = interactions.some(i => 
            i.interactionType === 'like' || 
            i.interactionType === 'not-accurate' ||
            i.interactionType === 'signal_viewed'
        );
        
        const userFeedback = interactions.find(i => 
            i.interactionType === 'like' || i.interactionType === 'not-accurate'
        );
        
        // Calculate feedback counts
        const likeCount = interactions.filter(i => i.interactionType === 'like').length;
        const notAccurateCount = interactions.filter(i => i.interactionType === 'not-accurate').length;
        
        return {
            ...signal,
            id: signal.signal_id,
            action_id: signal.action_id, // Explicitly preserve action_id
            
            // Merge account data (for backward compatibility)
            account_name: account?.account_name || signal.account_name,
            account_action_context: account?.account_action_context,
            account_action_context_rationale: account?.account_action_context_rationale,
            account_metrics: account?.account_metrics,
            usage_metrics: account?.usage_metrics,
            financial: account?.financial,
            ownership: account?.ownership,
            at_risk_cat: account?.at_risk_cat,
            account_gpa: account?.account_gpa,
            health_score: account?.health_score,
            daily_active_users: account?.daily_active_users,
            weekly_active_users: account?.weekly_active_users,
            monthly_active_users: account?.monthly_active_users,
            total_lifetime_billings: account?.total_lifetime_billings,
            bks_renewal_baseline_usd: account?.bks_renewal_baseline_usd,
            
            // Merge action data
            recommended_action: action?.recommended_action,
            signal_rationale: action?.signal_rationale || signal.signal_rationale,
            plays: action?.plays || [],
            
            // UI state
            isViewed: hasUserInteraction || signal.isViewed,
            currentUserFeedback: userFeedback?.interactionType,
            feedback: userFeedback?.interactionType,
            
            // Feedback counts
            likeCount: likeCount,
            notAccurateCount: notAccurateCount
        };
    }
    
    getDenormalizedAccounts() {
        const accountsMap = new Map();
        
        this.normalizedData.accounts.forEach((account, accountId) => {
            const signalIds = this.indexes.signalsByAccount.get(accountId) || new Set();
            const signals = Array.from(signalIds)
                .map(id => this.normalizedData.signals.get(id))
                .filter(s => s)
                .map(s => this.denormalizeSignal(s));
            
            accountsMap.set(accountId, {
                ...account,
                id: accountId,
                name: account.account_name,
                signals: signals
            });
        });
        
        return accountsMap;
    }
    
    getSignalInteractions(signalId) {
        const interactionIds = this.indexes.interactionsBySignal.get(signalId) || new Set();
        return Array.from(interactionIds)
            .map(id => this.normalizedData.interactions.get(id))
            .filter(interaction => interaction !== null);
    }
    
    createSignalsById(signals) {
        const signalsById = new Map();
        signals.forEach(signal => {
            signalsById.set(signal.id, signal);
        });
        return signalsById;
    }
    
    // ========== PUBLIC API METHODS ==========
    
    getSignals() {
        // Return denormalized signals for backward compatibility
        return this.getDenormalizedSignals();
    }
    
    getAccounts() {
        return this.getDenormalizedAccounts();
    }
    
    getAccount(accountId) {
        const account = this.normalizedData.accounts.get(accountId);
        if (!account) return null;
        
        const signalIds = this.indexes.signalsByAccount.get(accountId) || new Set();
        const signals = Array.from(signalIds)
            .map(id => this.normalizedData.signals.get(id))
            .filter(s => s)
            .map(s => this.denormalizeSignal(s));
        
        return {
            ...account,
            id: accountId,
            name: account.account_name,
            signals: signals
        };
    }
    
    getSignal(signalId) {
        const signal = this.normalizedData.signals.get(signalId);
        return signal ? this.denormalizeSignal(signal) : null;
    }
    
    getActionPlans() {
        const plans = Array.from(this.normalizedData.actionPlans.values());
        
        // Enrich with account names
        return plans.map(plan => {
            const account = this.normalizedData.accounts.get(plan.accountId);
            return {
                ...plan,
                accountName: account?.account_name || plan.accountId
            };
        });
    }
    
    getRecommendedAction(actionId) {
        return this.normalizedData.recommendedActions.get(actionId);
    }
    
    getRecommendedActions() {
        return Array.from(this.normalizedData.recommendedActions.values());
    }
    
    getComments(targetId) {
        // Check both signal and account comments
        const signalCommentIds = this.indexes.commentsBySignal.get(targetId) || new Set();
        const accountCommentIds = this.indexes.commentsByAccount.get(targetId) || new Set();
        
        const allCommentIds = new Set([...signalCommentIds, ...accountCommentIds]);
        
        return Array.from(allCommentIds)
            .map(id => this.normalizedData.comments.get(id))
            .filter(comment => comment !== null);
    }
    
    getInteractions(signalId) {
        return this.getSignalInteractions(signalId);
    }
    
    getUserInfo() {
        return this.getState().userInfo;
    }
    
    getFilteredSignals() {
        let signals = this.getDenormalizedSignals();
        const filters = this.getState().viewState.filters;
        
        // Apply filters
        if (filters.priority !== 'all') {
            signals = signals.filter(s => s.priority === filters.priority);
        }
        if (filters.category !== 'all') {
            signals = signals.filter(s => s.category === filters.category);
        }
        if (filters.polarity !== 'all') {
            signals = signals.filter(s => s.signal_polarity === filters.polarity);
        }
        if (filters.riskCategory !== 'all') {
            signals = signals.filter(s => s.at_risk_cat === filters.riskCategory);
        }
        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            signals = signals.filter(s => 
                s.name?.toLowerCase().includes(searchLower) ||
                s.summary?.toLowerCase().includes(searchLower) ||
                s.account_name?.toLowerCase().includes(searchLower)
            );
        }
        
        return signals;
    }
    
    // ========== CRUD OPERATIONS ==========
    
    createActionPlan(planData) {
        const plan = {
            id: planData.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: planData.status || 'pending',
            assignee: this.getState().userInfo?.userId,
            createdBy: this.getState().userInfo?.userName,
            createdByUserId: this.getState().userInfo?.userId,
            ...planData
        };
        
        // Store in normalized structure
        this.normalizedData.actionPlans.set(plan.id, plan);
        
        // Update indexes
        if (plan.accountId) {
            if (!this.indexes.plansByAccount.has(plan.accountId)) {
                this.indexes.plansByAccount.set(plan.accountId, new Set());
            }
            this.indexes.plansByAccount.get(plan.accountId).add(plan.id);
        }
        
        if (plan.actionId) {
            if (!this.indexes.plansByAction.has(plan.actionId)) {
                this.indexes.plansByAction.set(plan.actionId, new Set());
            }
            this.indexes.plansByAction.get(plan.actionId).add(plan.id);
        }
        
        // Update state for UI
        const currentState = this.getState();
        currentState.actionPlans.set(plan.id, plan);
        this.setState({ 
            actionPlans: currentState.actionPlans,
            actionPlansByAccount: this.indexes.plansByAccount
        });
        
        this.emitChange('action_plan:created', plan);
        return plan;
    }
    
    updateActionPlan(planId, updates) {
        const plan = this.normalizedData.actionPlans.get(planId);
        if (!plan) return;
        
        const updatedPlan = {
            ...plan,
            ...updates,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: this.getState().userInfo?.userName,
            lastUpdatedByUserId: this.getState().userInfo?.userId
        };
        
        this.normalizedData.actionPlans.set(planId, updatedPlan);
        
        // Update state
        const currentState = this.getState();
        currentState.actionPlans.set(planId, updatedPlan);
        this.setState({ actionPlans: currentState.actionPlans });
        
        this.emitChange('action_plan:updated', updatedPlan);
        return updatedPlan;
    }
    
    deleteActionPlan(planId) {
        const plan = this.normalizedData.actionPlans.get(planId);
        if (!plan) return;
        
        // Remove from indexes
        if (plan.accountId && this.indexes.plansByAccount.has(plan.accountId)) {
            this.indexes.plansByAccount.get(plan.accountId).delete(planId);
        }
        if (plan.actionId && this.indexes.plansByAction.has(plan.actionId)) {
            this.indexes.plansByAction.get(plan.actionId).delete(planId);
        }
        
        // Delete from normalized store
        this.normalizedData.actionPlans.delete(planId);
        
        // Update state
        const currentState = this.getState();
        currentState.actionPlans.delete(planId);
        this.setState({ actionPlans: currentState.actionPlans });
        
        this.emitChange('action_plan:deleted', planId);
    }
    
    // ========== ACTION HANDLERS (keeping existing ones) ==========
    
    handleAppInitialized(payload) {
        this.handleDataLoadSuccess(payload);
        this.emitChange('app:initialized');
    }
    
    handleTabChanged(payload) {
        this.setState({
            currentTab: payload.tabName
        });
        this.emitChange('tab:changed', payload.tabName);
    }
    
    handleDataLoadRequested() {
        this.setState({ loading: true });
        this.emitChange('data:load-requested');
    }
    
    handleDataLoadStarted() {
        this.setState({ loading: true });
        this.emitChange('loading:started');
    }
    
    handleDataLoadFailed(payload) {
        this.setState({ 
            loading: false,
            message: { text: 'Failed to load data', type: 'error' }
        });
        this.emitChange('data:load_failed', payload.error);
    }
    
    handleSignalRemoved(payload) {
        const { signalId } = payload;
        
        // Remove from normalized store
        const signal = this.normalizedData.signals.get(signalId);
        if (signal) {
            // Update indexes
            if (signal.account_id && this.indexes.signalsByAccount.has(signal.account_id)) {
                this.indexes.signalsByAccount.get(signal.account_id).delete(signalId);
            }
            if (signal.action_id && this.indexes.signalsByAction.has(signal.action_id)) {
                this.indexes.signalsByAction.get(signal.action_id).delete(signalId);
            }
            
            // Delete signal
            this.normalizedData.signals.delete(signalId);
            
            // Update denormalized state
            const denormalizedSignals = this.getDenormalizedSignals();
            const denormalizedAccounts = this.getDenormalizedAccounts();
            
            this.setState({ 
                signals: denormalizedSignals,
                accounts: denormalizedAccounts,
                filteredSignals: this.applyFilters(this.getState().viewState.filters)
            });
        }
        
        this.emitChange('signal-removed', signalId);
        this.emitChange('accounts-updated');
    }
    
    handleSignalDetailsOpened(payload) {
        const { signalId } = payload;
        this.setState({ 
            selectedSignal: signalId,
            drawer: { isOpen: true, type: 'signal-details', data: { signalId } }
        });
        this.emitChange('signal-details-opened', signalId);
    }
    
    handlePlanDrawerClosed() {
        this.setState({ 
            drawer: { isOpen: false, type: null, data: null }
        });
        this.emitChange('plan-drawer-closed');
    }
    
    handleSignalDrawerClosed() {
        this.setState({ 
            drawer: { isOpen: false, type: null, data: null },
            selectedSignal: null
        });
        this.emitChange('signal-drawer-closed');
    }
    
    handlePortfolioFiltered(payload) {
        const { filterType } = payload;
        this.emitChange('portfolio-filtered', filterType);
    }
    
    handleAccountExpanded(payload) {
        const { accountId } = payload;
        const accounts = this.getState().accounts;
        const account = accounts.get(accountId);
        if (account) {
            account.isExpanded = true;
            this.setState({ accounts });
            this.emitChange('account-expanded', accountId);
        }
    }
    
    handleAccountCollapsed(payload) {
        const { accountId } = payload;
        const accounts = this.getState().accounts;
        const account = accounts.get(accountId);
        if (account) {
            account.isExpanded = false;
            this.setState({ accounts });
            this.emitChange('account-collapsed', accountId);
        }
    }
    
    handleShowMoreSignals(payload) {
        const { accountId } = payload;
        const accounts = this.getState().accounts;
        const account = accounts.get(accountId);
        if (account) {
            if (!account.signalsPagination) {
                account.signalsPagination = { currentPage: 0, pageSize: 3 };
            }
            account.signalsPagination.currentPage++;
            this.setState({ accounts });
            this.emitChange('accounts-updated');
        }
    }
    
    handleShowLessSignals(payload) {
        const { accountId } = payload;
        const accounts = this.getState().accounts;
        const account = accounts.get(accountId);
        if (account) {
            if (!account.signalsPagination) {
                account.signalsPagination = { currentPage: 0, pageSize: 3 };
            }
            account.signalsPagination.currentPage = 0;
            this.setState({ accounts });
            this.emitChange('accounts-updated');
        }
    }
    
    handleSignalsFiltered(payload) {
        const newViewState = {
            ...this.state.viewState,
            filters: payload.filters || this.state.viewState.filters
        };
        
        const filteredSignals = this.applyFilters(payload.filters);
        this.setState({ 
            filteredSignals,
            viewState: newViewState
        });
        this.emitChange('signals:filtered', filteredSignals);
    }
    
    async handleSignalViewed(payload) {
        const interaction = {
            id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            signalId: payload.signalId,
            interactionType: 'signal_viewed',
            timestamp: new Date().toISOString(),
            userId: this.getState().userInfo?.userId || 'user-1',
            userName: this.getState().userInfo?.userName || 'User',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Store in normalized structure
        this.normalizedData.interactions.set(interaction.id, interaction);
        
        // Update index
        if (!this.indexes.interactionsBySignal.has(interaction.signalId)) {
            this.indexes.interactionsBySignal.set(interaction.signalId, new Set());
        }
        this.indexes.interactionsBySignal.get(interaction.signalId).add(interaction.id);
        
        // 🔧 CRITICAL FIX: Save interaction to appdb
        try {
            await SignalsRepository.saveInteraction(interaction);
            console.log(`✅ Signal view interaction saved to appdb for signal ${payload.signalId}`);
        } catch (error) {
            console.error(`❌ Failed to save signal view interaction:`, error);
        }
        
        // Mark signal as viewed
        const signal = this.normalizedData.signals.get(payload.signalId);
        if (signal) {
            signal.isViewed = true;
        }
        
        // 🔧 CRITICAL FIX: Add signal to viewedSignals set
        if (!this.state.viewState.viewedSignals) {
            this.state.viewState.viewedSignals = new Set();
        }
        this.state.viewState.viewedSignals.add(payload.signalId);
        
        // 🔧 CRITICAL FIX: Update filtered signals to reflect the new viewed status
        const updatedFilteredSignals = this.applyFilters(this.getState().viewState.filters);
        this.setState({ 
            filteredSignals: updatedFilteredSignals 
        });
        
        this.emitChange('signal:viewed', payload.signalId);
    }
    
    handleSignalSelected(payload) {
        this.setState({ selectedSignal: payload.signal });
        this.emitChange('signal:selected', payload.signal);
    }
    
    handleFeedbackRequested(payload) {
        const { signalId, feedbackType, userId, operationId } = payload;
        
        // Create snapshot for rollback
        this.createSnapshot(operationId);
        
        // Get current signal
        const signal = this.state.signalsById.get(signalId);
        if (!signal) {
            console.error(`Signal ${signalId} not found for feedback update`);
            return;
        }
        
        // Add interaction
        const interaction = {
            id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            signalId: signalId,
            interactionType: feedbackType,
            timestamp: new Date().toISOString(),
            userId: userId || this.getState().userInfo?.userId,
            userName: this.getState().userInfo?.userName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Store in normalized structure
        this.normalizedData.interactions.set(interaction.id, interaction);
        
        // Update index
        if (!this.indexes.interactionsBySignal.has(interaction.signalId)) {
            this.indexes.interactionsBySignal.set(interaction.signalId, new Set());
        }
        this.indexes.interactionsBySignal.get(interaction.signalId).add(interaction.id);
        
        // OPTIMISTIC UI UPDATE: Immediately update signal state
        const currentFeedback = signal.currentUserFeedback;
        let updatedSignal = { ...signal };
        
        if (currentFeedback === feedbackType) {
            // User is removing their feedback - revert to no feedback
            updatedSignal.currentUserFeedback = null;
            
            // Decrease counts
            if (feedbackType === 'like') {
                updatedSignal.likeCount = Math.max(0, (updatedSignal.likeCount || 0) - 1);
            } else if (feedbackType === 'not-accurate') {
                updatedSignal.notAccurateCount = Math.max(0, (updatedSignal.notAccurateCount || 0) - 1);
            }
        } else {
            // User is adding new feedback
            updatedSignal.currentUserFeedback = feedbackType;
            
            // Increase counts
            if (feedbackType === 'like') {
                updatedSignal.likeCount = (updatedSignal.likeCount || 0) + 1;
            } else if (feedbackType === 'not-accurate') {
                updatedSignal.notAccurateCount = (updatedSignal.notAccurateCount || 0) + 1;
            }
            
            // If switching from one feedback type to another, decrease the old count
            if (currentFeedback === 'like' && feedbackType === 'not-accurate') {
                updatedSignal.likeCount = Math.max(0, (updatedSignal.likeCount || 0) - 1);
            } else if (currentFeedback === 'not-accurate' && feedbackType === 'like') {
                updatedSignal.notAccurateCount = Math.max(0, (updatedSignal.notAccurateCount || 0) - 1);
            }
        }
        
        // Update signal in store
        this.state.signalsById.set(signalId, updatedSignal);
        
        // Update in signalsByAccount as well
        const accountSignals = this.state.signalsByAccount.get(signal.accountId) || [];
        const updatedAccountSignals = accountSignals.map(s => 
            s.id === signalId ? updatedSignal : s
        );
        this.state.signalsByAccount.set(signal.accountId, updatedAccountSignals);
        
        console.log(`🎯 Optimistic update: Signal ${signalId} ${feedbackType} - Counts: like=${updatedSignal.likeCount}, notAccurate=${updatedSignal.notAccurateCount}`);
        
        this.emitChange('feedback:requested', { signalId, feedbackType });
        this.emitChange('feedback-updated', { signalId, feedbackType, updatedSignal });
        console.log(`🔄 Emitted feedback-updated event for signal ${signalId}`);
    }
    
    handleFeedbackSucceeded(payload) {
        const { operationId } = payload;
        this.commitSnapshot(operationId);
        this.emitChange('feedback:succeeded', payload);
    }
    
    handleFeedbackFailed(payload) {
        const { operationId, error } = payload;
        this.rollback(operationId);
        this.setState({
            message: { text: 'Failed to save feedback', type: 'error' }
        });
        this.emitChange('feedback:failed', { error });
    }
    
    handleFeedbackRemoved(payload) {
        const { signalId, userId } = payload;
        
        // Update signal to remove current user feedback
        const signal = this.state.signalsById.get(signalId);
        if (signal) {
            const updatedSignal = {
                ...signal,
                currentUserFeedback: null
            };
            
            this.state.signalsById.set(signalId, updatedSignal);
            
            // Update in signalsByAccount as well
            const accountSignals = this.state.signalsByAccount.get(signal.accountId) || [];
            const updatedAccountSignals = accountSignals.map(s => 
                s.id === signalId ? updatedSignal : s
            );
            this.state.signalsByAccount.set(signal.accountId, updatedAccountSignals);
            
            this.emitChange('feedback:removed', { signalId, userId });
        }
    }
    
    handleCommentRequested(payload) {
        const { signalId, accountId, text, userId, operationId } = payload;
        
        this.createSnapshot(operationId);
        
        const comment = {
            id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            signalId: signalId || null,
            accountId: accountId || null,
            text: text,
            author: this.getState().userInfo?.userName,
            authorId: userId || this.getState().userInfo?.userId,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isOptimistic: true
        };
        
        // Store in normalized structure
        this.normalizedData.comments.set(comment.id, comment);
        
        // Update indexes
        if (comment.signalId) {
            if (!this.indexes.commentsBySignal.has(comment.signalId)) {
                this.indexes.commentsBySignal.set(comment.signalId, new Set());
            }
            this.indexes.commentsBySignal.get(comment.signalId).add(comment.id);
        } else if (comment.accountId) {
            if (!this.indexes.commentsByAccount.has(comment.accountId)) {
                this.indexes.commentsByAccount.set(comment.accountId, new Set());
            }
            this.indexes.commentsByAccount.get(comment.accountId).add(comment.id);
        }
        
        // Update state for backward compatibility
        this.state.comments = new Map(this.normalizedData.comments);
        
        console.log('💬 Comment added optimistically:', comment);
        console.log('💬 Total comments in store:', this.normalizedData.comments.size);
        
        if (signalId) {
            console.log('💬 Comments for signal', signalId, ':', this.getComments(signalId));
        }
        if (accountId) {
            console.log('💬 Comments for account', accountId, ':', this.getComments(accountId));
        }
        
        this.emitChange('comment:requested', comment);
        this.emitChange('comments-updated', comment);
        
        // Call API to save comment
        this.saveCommentToAPI(comment, operationId);
    }
    
    handleCommentSucceeded(payload) {
        const { comment, operationId } = payload;
        
        // Update the optimistic comment
        const existingComment = this.normalizedData.comments.get(comment.id);
        if (existingComment) {
            this.normalizedData.comments.set(comment.id, { ...comment, isOptimistic: false });
        }
        
        this.commitSnapshot(operationId);
        this.emitChange('comment:succeeded', comment);
    }
    
    handleCommentFailed(payload) {
        const { operationId, error } = payload;
        this.rollback(operationId);
        this.setState({
            message: { text: 'Failed to save comment', type: 'error' }
        });
        this.emitChange('comment:failed', { error });
    }
    
    handleActionPlanRequested(payload) {
        const { signalId, title, description, tasks, userId, accountId, operationId } = payload;
        
        this.createSnapshot(operationId);
        
        // 🔧 FIX: Don't create optimistic plan here - wait for handleActionPlanSucceeded
        // This avoids ID mismatch and ensures we get the complete plan data from ActionPlansService
        this.emitChange('action_plan:requested', { operationId, signalId, title, description, tasks, userId, accountId });
    }
    
    handleActionPlanSucceeded(payload) {
        const { plan, operationId } = payload;
        
        // 🔧 DEBUG: Log the plan data to see what fields are present
        console.log('🔍 [DEBUG] handleActionPlanSucceeded received plan:', plan);
        console.log(' [DEBUG] Plan actionId:', plan.actionId);
        console.log('🔍 [DEBUG] Plan accountId:', plan.accountId);
        
        // 🔧 CRITICAL FIX: Always store the plan in normalizedData.actionPlans
        // Whether it exists or not, we need to store the complete plan data
        this.normalizedData.actionPlans.set(plan.id, { ...plan, isOptimistic: false });
        
        // Update indexes for account-based lookups
        if (plan.accountId) {
            if (!this.indexes.plansByAccount.has(plan.accountId)) {
                this.indexes.plansByAccount.set(plan.accountId, new Set());
            }
            this.indexes.plansByAccount.get(plan.accountId).add(plan.id);
        }
        
        // 🔧 CRITICAL FIX: Also add the new action plan to app.actionPlans for ActionsRenderer
        if (plan && plan.id) {
            // Ensure app.actionPlans exists
            if (!this.state.app || !this.state.app.actionPlans) {
                if (!this.state.app) this.state.app = {};
                this.state.app.actionPlans = new Map();
            }
            
            // Add the new action plan with accountName fallback
            const accountName = plan.accountName || `Account ${plan.accountId}`;
            this.state.app.actionPlans.set(plan.id, {
                ...plan,
                accountName: accountName
            });
            
            console.log(`🔧 [CRITICAL FIX] Added new action plan ${plan.id} to app.actionPlans for ActionsRenderer`);
            console.log('🔍 [DEBUG] Stored plan data:', this.state.app.actionPlans.get(plan.id));
        }
        
        this.commitSnapshot(operationId);
        this.emitChange('action_plan:succeeded', plan);
    }
    
    handleActionPlanFailed(payload) {
        const { operationId, error } = payload;
        this.rollback(operationId);
        this.setState({
            message: { text: 'Failed to save action plan', type: 'error' }
        });
        this.emitChange('action_plan:failed', { error });
    }
    
    handleUpdateActionPlan(payload) {
        const { planId, updates } = payload;
        this.updateActionPlan(planId, updates);
    }
    
    handleDeleteActionPlan(payload) {
        const { planId } = payload;
        this.deleteActionPlan(planId);
    }
    
    handleLoadingShown() {
        this.setState({ loading: true });
        this.emitChange('loading:shown');
    }
    
    handleLoadingHidden() {
        this.setState({ loading: false });
        this.emitChange('loading:hidden');
    }
    
    handleMessageShown(payload) {
        this.setState({
            message: { text: payload.message, type: payload.type }
        });
        this.emitChange('message:shown', payload);
    }
    
    handleMessageHidden() {
        this.setState({ message: null });
        this.emitChange('message:hidden');
    }
    
    handleModalOpened(payload) {
        this.setState({
            modal: { 
                isOpen: true, 
                type: payload.modalType, 
                data: payload.data 
            }
        });
        this.emitChange('modal:opened', payload);
    }
    
    handleModalClosed() {
        this.setState({
            modal: { isOpen: false, type: null, data: null }
        });
        this.emitChange('modal:closed');
    }
    
    handleDrawerOpened(payload) {
        this.setState({
            drawer: { 
                isOpen: true, 
                type: payload.drawerType, 
                data: payload.data 
            }
        });
        this.emitChange('drawer:opened', payload);
    }
    
    handleDrawerClosed() {
        this.setState({
            drawer: { isOpen: false, type: null, data: null }
        });
        this.emitChange('drawer:closed');
    }
    
    // ========== HELPER METHODS ==========
    
    applyFilters(filters) {
        let signals = this.getDenormalizedSignals();
        
        if (!filters) {
            // 🔧 CRITICAL FIX: Sort signals by viewed status even without filters
            return this.sortSignalsByViewedStatus(signals);
        }
        
        if (filters.priority && filters.priority !== 'all') {
            signals = signals.filter(s => s.priority === filters.priority);
        }
        if (filters.category && filters.category !== 'all') {
            signals = signals.filter(s => s.category === filters.category);
        }
        if (filters.signalType && filters.signalType !== 'all') {
            signals = signals.filter(s => {
                const signalPolarity = s.signal_polarity || s['Signal Polarity'] || 'Enrichment';
                const normalizedPolarity = FormatUtils.normalizePolarityKey(signalPolarity);
                return normalizedPolarity === filters.signalType.toLowerCase();
            });
        }
        if (filters.polarity && filters.polarity !== 'all') {
            signals = signals.filter(s => s.signal_polarity === filters.polarity);
        }
        if (filters.riskCategory && filters.riskCategory !== 'all') {
            signals = signals.filter(s => s.at_risk_cat === filters.riskCategory);
        }
        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            signals = signals.filter(s => 
                s.name?.toLowerCase().includes(searchLower) ||
                s.summary?.toLowerCase().includes(searchLower) ||
                s.account_name?.toLowerCase().includes(searchLower)
            );
        }
        
        // 🔧 CRITICAL FIX: Always sort by viewed status after filtering
        return this.sortSignalsByViewedStatus(signals);
    }
    
    /**
     * Sort signals to show unviewed signals first, then viewed signals
     */
    sortSignalsByViewedStatus(signals) {
        return signals.sort((a, b) => {
            const aViewed = this.isSignalViewed(a.id || a.signal_id);
            const bViewed = this.isSignalViewed(b.id || b.signal_id);
            
            // 🔧 DEBUG: Log sorting decisions for first few signals (reduced frequency)
            if (signals.indexOf(a) < 3 && Math.random() < 0.3) {
                console.log(`🔍 [SORT DEBUG] Signal ${a.id || a.signal_id}: viewed=${aViewed}, priority=${a.priority}`);
            }
            
            // Unviewed signals first (false comes before true)
            if (aViewed !== bViewed) {
                return aViewed ? 1 : -1;
            }
            
            // Within each group, sort by priority (High > Medium > Low)
            const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            // Finally, sort by date (newest first)
            const aDate = new Date(a.created_at || a.createdAt || 0);
            const bDate = new Date(b.created_at || b.createdAt || 0);
            return bDate - aDate;
        });
    }
    
    /**
     * Check if a signal has been viewed by the user
     */
    isSignalViewed(signalId) {
        // Check if signal is in viewedSignals set
        if (this.state.viewState?.viewedSignals?.has(signalId)) {
            return true;
        }
        
        // Check if user has any interaction with this signal
        const signal = this.normalizedData.signals.get(signalId);
        if (signal?.currentUserFeedback) {
            return true;
        }
        
        // Check if user has created action plans for this account
        if (signal?.account_id) {
            const hasActionPlan = Array.from(this.normalizedData.actionPlans.values())
                .some(plan => plan.accountId === signal.account_id);
            if (hasActionPlan) {
                return true;
            }
        }
        
        return false;
    }
    
    async saveCommentToAPI(comment, operationId) {
        try {
            console.log('💾 Saving comment to API:', comment);
            const result = await SignalsRepository.saveComment(comment);
            
            if (result.success) {
                // Update the comment with the API response
                const updatedComment = { ...comment, ...result.data, isOptimistic: false };
                this.normalizedData.comments.set(comment.id, updatedComment);
                this.state.comments = new Map(this.normalizedData.comments);
                
                // Dispatch success action
                dispatcher.dispatch(Actions.commentSucceeded(updatedComment, operationId));
            } else {
                throw new Error(result.error || 'Failed to save comment');
            }
        } catch (error) {
            console.error('❌ Failed to save comment to API:', error);
            // Dispatch failure action
            dispatcher.dispatch(Actions.commentFailed(operationId, error.message));
        }
    }
}

// Create singleton instance
const signalsStore = new SignalsStore();

// Make globally available
window.SignalsStore = SignalsStore;
window.signalsStore = signalsStore;