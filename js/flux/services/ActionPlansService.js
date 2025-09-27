// ActionPlansService - Handles action plans through Flux actions
class ActionPlansService {
    
    /**
     * Get global dispatcher safely with robust error handling
     */
    static getDispatcher() {
        if (typeof window.dispatcher !== 'undefined' && window.dispatcher) {
            return window.dispatcher;
        }
        console.warn('⚠️ Dispatcher not available - Flux architecture may not be initialized');
        return null;
    }
    
    /**
     * Get global signals store safely with robust error handling
     */
    static getSignalsStore() {
        if (typeof window.signalsStore !== 'undefined' && window.signalsStore) {
            return window.signalsStore;
        }
        console.warn('⚠️ SignalsStore not available - Flux architecture may not be initialized');
        return null;
    }
    
    /**
     * Store action plan locally as fallback
     */
    static storeActionPlanLocally(plan) {
        try {
            const existingPlans = this.getLocalActionPlans();
            existingPlans[plan.id] = plan;
            localStorage.setItem('signalsai_action_plans', JSON.stringify(existingPlans));
            console.log('✅ Action plan stored locally:', plan.id);
        } catch (error) {
            console.warn('Could not store action plan locally:', error);
        }
    }
    
    /**
     * Get locally stored action plans
     */
    static getLocalActionPlans() {
        try {
            const stored = localStorage.getItem('signalsai_action_plans');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Could not load local action plans:', error);
            return {};
        }
    }
    
    /**
     * Clear timestamp for failed action plan creation with robust accountId handling
     */
    static clearPlanCreationTimestamp(accountId) {
        if (!accountId) {
            console.warn('⚠️ Cannot clear plan timestamp: accountId is null or undefined');
            return;
        }
        
        try {
            const planTimestamps = JSON.parse(localStorage.getItem('signalsai_plan_timestamps') || '{}');
            if (planTimestamps[accountId]) {
                delete planTimestamps[accountId];
                localStorage.setItem('signalsai_plan_timestamps', JSON.stringify(planTimestamps));
                console.log(`🧹 Cleared plan timestamp for account ${accountId}`);
            } else {
                console.log(`ℹ️ No timestamp to clear for account ${accountId}`);
            }
        } catch (error) {
            console.warn('Could not clear plan timestamp:', error);
        }
    }
    
    /**
     * Create a new action plan with optimistic updates
     * @param {string} actionId - Action ID (recommended action ID)
     * @param {string} accountId - Account ID (required for direct association)
     * @param {string} title - Plan title
     * @param {string} description - Plan description
     * @param {Array} plays - Array of plays (strings or objects)
     * @param {number} userId - User ID (numeric)
     * @param {string} userName - User name
     * @param {string} planTitle - Plan title with date
     * @param {string} dueDate - Due date in YYYY-MM-DD format
     * @param {string} priority - Priority (High, Medium, Low)
     * @param {string} signalPolarity - Signal polarity (Enrichment, Risk, Opportunities)
     */
    static async createActionPlan(actionId, accountId, title, description, plays = [], userId = null, userName = null, planTitle = null, dueDate = null, priority = 'Medium', signalPolarity = 'Enrichment') {
        const dispatcher = this.getDispatcher();
        const signalsStore = this.getSignalsStore();
        
        // Guard against missing dependencies
        if (!dispatcher) {
            console.error('❌ Cannot create action plan: Dispatcher not available');
            return null;
        }
        
        if (!signalsStore) {
            console.error('❌ Cannot create action plan: SignalsStore not available');
            return null;
        }
        
        // Validate required parameters
        if (!accountId) {
            console.error('❌ Cannot create action plan: accountId is required');
            dispatcher.dispatch(Actions.showMessage('Account ID is required for action plan creation', 'error'));
            return null;
        }
        
        // Get current user if not provided
        if (!userId) {
            const userInfo = signalsStore.getState().userInfo;
            userId = parseInt(userInfo?.userId) || 621623466; // Ensure numeric ID
            userName = userName || userInfo?.userName || 'Current User';
        }
    
        if (!title || title.trim().length === 0) {
            dispatcher.dispatch(Actions.showMessage('Action plan title cannot be empty', 'error'));
            return null;
        }
    
        console.log(`🎯 ActionPlansService: Creating action plan for action ${actionId}`);
        
        // Dispatch optimistic request action
        const requestAction = Actions.requestActionPlan(actionId, title.trim(), description?.trim() || '', plays, userId, accountId);
        dispatcher.dispatch(requestAction);
        
        const operationId = requestAction.payload.operationId; // Store in broader scope for catch block
        
        try {
            // 🎯 ENHANCE PLAYS: Convert strings to enhanced objects with task management fields
            const normalizedPriority = SignalsRepository.normalizeSignalPriority(priority);
            const enhancedPlays = (plays || []).map((play, index) => {
                return SignalsRepository.enhancePlayWithTaskManagement(play, normalizedPriority, index);
            });
            
            // Create plan object matching exact database model
            const now = new Date();
            const planData = {
                id: `plan-${Date.now()}`, // Format: plan-timestamp
                actionId,  // Recommended action ID
                accountId, // Account ID
                title: title.trim(),
                description: description?.trim() || '',
                plays: enhancedPlays, // ✅ Use enhanced plays with task management fields
                status: 'pending', // Initial status
                priority: priority || 'Medium', // Capitalized priority
                dueDate: dueDate || now.toISOString().split('T')[0], // YYYY-MM-DD format
                assignee: userId, // Numeric user ID
                createdDate: now.toISOString(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                planTitle: planTitle || `Action Plan - ${now.toLocaleDateString('en-US')}`,
                createdBy: userName || 'Current User',
                createdByUserId: userId,
                signalPolarity: signalPolarity || 'Enrichment' // NEW FIELD
            };
            
            // Make API call in background
            const result = await SignalsRepository.saveActionPlan(planData);
            
            // SignalsRepository always returns success:true for optimistic updates
            // but we still implement local persistence as fallback
            if (result && result.success) {
                // Store locally as fallback persistence
                this.storeActionPlanLocally(result.data || planData);
                
                // Dispatch success action with real plan data
                dispatcher.dispatch(Actions.actionPlanSucceeded(result.data || planData, operationId));
                
                // Show success message
                dispatcher.dispatch(Actions.showMessage('Action plan created successfully', 'success'));
                
                console.log('✅ Action plan created successfully:', result.data || planData);
                return result.data || planData;
                
            } else {
                // Clear any optimistic timestamps from UI with robust handling
                this.clearPlanCreationTimestamp(accountId); // Now handles undefined accountId gracefully
                
                // Dispatch failure action
                dispatcher.dispatch(Actions.actionPlanFailed(operationId, result?.error || 'Unknown error'));
                
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to save action plan - changes reverted', 'error'));
                
                console.error('❌ Action plan creation failed:', result?.error);
                return null;
            }
            
        } catch (error) {
            console.error('❌ ActionPlansService: Critical error in action plan creation:', error);
            
            try {
                const dispatcher = this.getDispatcher();
                
                // Clear any optimistic timestamps from UI using directly passed accountId
                this.clearPlanCreationTimestamp(accountId); // Use directly passed accountId instead of fragile inference
                
                // Use the preserved operationId from the original request action for proper rollback correlation
                dispatcher.dispatch(Actions.actionPlanFailed(operationId, error.message));
                
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to save action plan - changes reverted', 'error'));
                
            } catch (cleanupError) {
                console.error('❌ Additional error during cleanup:', cleanupError);
            }
            
            return null;
        }
    }
    
    /**
     * Update an existing action plan with optimistic updates
     * @param {string} planId - Plan ID
     * @param {Object} updates - Plan updates
     */
    static async updateActionPlan(planId, updates) {
        console.log(`🎯 ActionPlansService: Updating action plan ${planId}`);
        
        try {
            const dispatcher = this.getDispatcher();
            
            // OPTIMISTIC UPDATE: Immediately update local data and UI
            const existingPlans = this.getLocalActionPlans();
            const updatedPlan = existingPlans[planId] ? 
                { ...existingPlans[planId], ...updates, updatedAt: new Date().toISOString() } : 
                { id: planId, ...updates, updatedAt: new Date().toISOString() };
            
            // Store optimistic update locally
            this.storeActionPlanLocally(updatedPlan);
            
            // Dispatch optimistic update action immediately
            dispatcher.dispatch(Actions.updateActionPlan(planId, updates));
            
            console.log(`✅ Optimistic update applied for plan ${planId}`);
            
            // Make API call in background
            const result = await SignalsRepository.updateActionPlan(planId, updates);
            
            if (result && result.success) {
                console.log(`✅ Server update successful for plan ${planId}`);
                // Server update successful - show success message
                dispatcher.dispatch(Actions.showMessage('Action plan updated successfully', 'success'));
                
                return { success: true, data: updatedPlan, plan: updatedPlan };
                
            } else {
                console.warn(`⚠️ Server update failed for plan ${planId}, but optimistic update remains`);
                // Server failed but optimistic update already applied - show warning but don't revert
                dispatcher.dispatch(Actions.showMessage('Changes saved locally (server sync failed)', 'warning'));
                
                return { success: true, data: updatedPlan, plan: updatedPlan };
            }
            
        } catch (error) {
            console.error('❌ ActionPlansService: Failed to update action plan:', error);
            
            // Even if there's an error, the optimistic update was already applied
            // Don't revert unless it's a critical validation error
            try {
                const dispatcher = this.getDispatcher();
                dispatcher.dispatch(Actions.showMessage('Changes saved locally (sync error)', 'warning'));
                
                // Return success since optimistic update worked
                const existingPlans = this.getLocalActionPlans();
                const updatedPlan = existingPlans[planId];
                
                return { success: true, data: updatedPlan, plan: updatedPlan };
                
            } catch (dispatchError) {
                console.error('❌ Failed to dispatch error message:', dispatchError);
                return { success: false, error: error.message };
            }
        }
    }
    
    /**
     * Delete an action plan
     * @param {string} planId - Plan ID
     */
    static async deleteActionPlan(planId) {
        console.log(`🎯 ActionPlansService: Deleting action plan ${planId}`);
        
        try {
            const dispatcher = this.getDispatcher();
            
            // Make API call
            const result = await SignalsRepository.deleteActionPlan(planId);
            
            if (result && result.success) {
                // Remove from local storage
                const existingPlans = this.getLocalActionPlans();
                delete existingPlans[planId];
                localStorage.setItem('signalsai_action_plans', JSON.stringify(existingPlans));
                
                // Dispatch delete action
                dispatcher.dispatch(Actions.deleteActionPlan(planId));
                
                // Show success message
                dispatcher.dispatch(Actions.showMessage('Action plan deleted successfully', 'success'));
                
                return true;
                
            } else {
                // Show error message
                dispatcher.dispatch(Actions.showMessage('Failed to delete action plan', 'error'));
                
                return false;
            }
            
        } catch (error) {
            console.error('❌ ActionPlansService: Failed to delete action plan:', error);
            try {
                const dispatcher = this.getDispatcher();
                dispatcher.dispatch(Actions.showMessage('Failed to delete action plan', 'error'));
            } catch (dispatchError) {
                console.error('❌ Failed to dispatch error message:', dispatchError);
            }
            return false;
        }
    }
    
    /**
     * Get action plans for an account
     * @param {string} accountId - Account ID
     * @returns {Array} - Array of action plans
     */
    static getActionPlansForAccount(accountId) {
        try {
            const signalsStore = this.getSignalsStore();
            const state = signalsStore.getState();
            return state.actionPlansByAccount.get(accountId) || [];
        } catch (error) {
            console.warn('Could not get action plans from store, checking local storage:', error);
            // Fallback to local storage
            const localPlans = this.getLocalActionPlans();
            return Object.values(localPlans).filter(plan => plan.accountId === accountId);
        }
    }
    
    /**
     * Get an action plan by ID
     * @param {string} planId - Plan ID
     * @returns {Object|null} - Action plan or null
     */
    static getActionPlanById(planId) {
        try {
            const signalsStore = this.getSignalsStore();
            const state = signalsStore.getState();
            return state.actionPlans.get(planId) || null;
        } catch (error) {
            console.warn('Could not get action plan from store, checking local storage:', error);
            // Fallback to local storage
            const localPlans = this.getLocalActionPlans();
            return localPlans[planId] || null;
        }
    }
    
    /**
     * Add a task to an action plan
     * @param {string} planId - Plan ID
     * @param {Object} task - Task object
     */
    static async addTaskToPlan(planId, task) {
        const plan = this.getActionPlanById(planId);
        if (!plan) {
            try {
                const dispatcher = this.getDispatcher();
                dispatcher.dispatch(Actions.showMessage('Action plan not found', 'error'));
            } catch (error) {
                console.error('Could not show error message:', error);
            }
            return;
        }
        
        const updatedTasks = [...(plan.tasks || []), task];
        await this.updateActionPlan(planId, { tasks: updatedTasks });
    }
    
    /**
     * Remove a task from an action plan
     * @param {string} planId - Plan ID
     * @param {number} taskIndex - Task index to remove
     */
    static async removeTaskFromPlan(planId, taskIndex) {
        const plan = this.getActionPlanById(planId);
        if (!plan) {
            try {
                const dispatcher = this.getDispatcher();
                dispatcher.dispatch(Actions.showMessage('Action plan not found', 'error'));
            } catch (error) {
                console.error('Could not show error message:', error);
            }
            return;
        }
        
        const updatedTasks = [...(plan.tasks || [])];
        if (taskIndex >= 0 && taskIndex < updatedTasks.length) {
            updatedTasks.splice(taskIndex, 1);
            await this.updateActionPlan(planId, { tasks: updatedTasks });
        }
    }
}

// Make globally available
window.ActionPlansService = ActionPlansService;