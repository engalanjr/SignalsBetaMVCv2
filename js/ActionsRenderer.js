// Actions Renderer - Handle action plans tab rendering
class ActionsRenderer {

    static async renderActions(app) {
        const container = document.getElementById('actionsList');
        if (!container) return;
        
        // Guard against undefined app/state
        if (!app) {
            console.error('ActionsRenderer.renderActions called without state/app');
            return;
        }

        // Update overview statistics
        this.updateActionsOverview(app);

        // Get action plans and convert to display format
        const actionPlans = await this.getFormattedActionPlans(app);

        if (actionPlans.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Apply current filter
        const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
        const filteredPlans = this.filterActionPlans(actionPlans, activeFilter);

        // Render as project management table
        container.innerHTML = this.renderProjectManagementTable(filteredPlans, app);
        
        // 🔒 SECURITY FIX: Set up delegated event listeners after rendering
        this.setupDelegatedEventListeners(container);
    }

    static updateActionsOverview(app) {
        // Ensure actionPlans Map exists before accessing
        if (!app.actionPlans || !(app.actionPlans instanceof Map)) {
            console.warn('⚠️ app.actionPlans not initialized as Map, using empty array');
            app.actionPlans = new Map();
        }
        const actionPlans = Array.from(app.actionPlans.values());

        // Update total actions count
        const totalElement = document.getElementById('totalActions');
        if (totalElement) {
            totalElement.textContent = actionPlans.length;
        }

        // Update pending actions count (using normalized status)
        const pendingElement = document.getElementById('pendingActions');
        if (pendingElement) {
            const pendingCount = actionPlans.filter(plan => {
                const normalizedStatus = StatusUtils.normalizeStatusToCanonical(plan.status);
                return normalizedStatus === 'pending';
            }).length;
            pendingElement.textContent = pendingCount;
        }

        // Update in progress actions count (using normalized status)
        const inProgressElement = document.getElementById('inProgressActions');
        if (inProgressElement) {
            const inProgressCount = actionPlans.filter(plan => {
                const normalizedStatus = StatusUtils.normalizeStatusToCanonical(plan.status);
                return normalizedStatus === 'in_progress';
            }).length;
            inProgressElement.textContent = inProgressCount;
        }

        // Update completed count
        const completedElement = document.getElementById('projectedImpact');
        if (completedElement) {
            // Count completed action plans (using normalized status)
            const completedCount = actionPlans.filter(plan => {
                const normalizedStatus = StatusUtils.normalizeStatusToCanonical(plan.status);
                return normalizedStatus === 'complete';
            }).length;
            completedElement.textContent = completedCount;
        }

        // Debug logging to verify status values
        console.log('Action Plans for KPI calculation:', actionPlans.map(plan => ({
            accountId: plan.accountId,
            accountName: plan.accountName,
            status: plan.status,
            title: plan.title
        })));
    }

    static async getFormattedActionPlans(app) {
        const actionPlans = [];

        // Ensure actionPlans Map exists before accessing - PRESERVE EXISTING DATA
        if (!app.actionPlans) {
            console.warn('⚠️ app.actionPlans not initialized, creating new Map');
            app.actionPlans = new Map();
        } else if (!(app.actionPlans instanceof Map)) {
            console.warn('⚠️ app.actionPlans exists but not a Map, converting to Map while preserving data');
            // Preserve existing data when converting to Map
            const existingData = app.actionPlans;
            app.actionPlans = new Map();
            
            // If it was an object or array with action plan data, try to preserve it
            if (existingData && typeof existingData === 'object') {
                console.log('🔧 [CRITICAL FIX] Preserving existing action plan data during Map conversion');
                
                // Handle different data structures
                if (Array.isArray(existingData)) {
                    // If it's an array, assume each item has an id
                    existingData.forEach(item => {
                        if (item && item.id) {
                            app.actionPlans.set(item.id, item);
                        }
                    });
                } else {
                    // If it's an object, iterate over its properties
                    Object.entries(existingData).forEach(([key, value]) => {
                        if (value && typeof value === 'object') {
                            app.actionPlans.set(key, value);
                        }
                    });
                }
                console.log(`🔧 [CRITICAL FIX] Preserved ${app.actionPlans.size} action plans during conversion`);
            }
        } else {
            // app.actionPlans is already a Map - don't touch it!
            console.log(`🔧 [CRITICAL FIX] app.actionPlans is already a Map with ${app.actionPlans.size} entries - preserving existing data`);
        }

        // First, process any action plans loaded from Domo API during initialization
        console.log(`Processing ${app.actionPlans.size} action plans from app state...`);
        
        // 🔧 FIX: Ensure DataService.actionPlans is synchronized (if available)
        if (window.DataService && Array.isArray(window.DataService.actionPlans)) {
            DataService.actionPlans.length = 0; // Clear existing
        }
        
        for (let [planId, planData] of app.actionPlans) {
            //  DEBUG: Log the plan data being processed
            console.log(`🔍 [DEBUG] Processing plan with key: ${planId}`);
            console.log(`🔍 [DEBUG] Plan data:`, planData);
            console.log(`🔍 [DEBUG] Plan actionId:`, planData.actionId);
            console.log(` [DEBUG] Plan accountId:`, planData.accountId);
            
            // Extract account ID from plan data (since map key is now planId, not accountId)
            const accountId = planData.accountId;
            
            // Handle missing app.accounts gracefully - use fallback from planData
            const account = (app.accounts && app.accounts.get) ? app.accounts.get(accountId) : null;
            
            // 🔧 FIX: Try to get account from signalsStore if not found in app.accounts
            let accountName = null;
            if (account) {
                accountName = account.name || account.account_name;
            } else if (window.signalsStore) {
                const storeAccount = window.signalsStore.getAccount(accountId);
                if (storeAccount) {
                    accountName = storeAccount.name || storeAccount.account_name;
                }
            }
            
            // 🔧 FIX: Allow plans to proceed even without account data - we have fallback logic at line 200
            if (!accountName && !planData.accountName) {
                console.log(`⚠️ Processing plan ${planId} without account data for ${accountId} - using fallback name`);
                // Don't skip - let the fallback logic handle this
            }

            // Handle missing account.signals gracefully
            const highPrioritySignals = (account && account.signals) ? account.signals.filter(s => s.priority === 'High') : [];
            
            // 🔧 FIX: Normalize planData to include canonical ID
            const normalizedPlanData = {
                ...planData,
                id: planId // Ensure ID matches the Map key
            };
            
            // 🔧 FIX: Sync to DataService.actionPlans for auto-save (if available)
            if (window.DataService && Array.isArray(window.DataService.actionPlans)) {
                DataService.actionPlans.push(normalizedPlanData);
            }

            actionPlans.push({
                accountId: accountId,
                accountName: accountName || planData.accountName || `Account ${accountId}`,
                accountHealth: this.getHealthFromRiskCategory(account?.at_risk_cat || 'Unknown'),
                signalsCount: (account && account.signals) ? account.signals.length : 0,
                highPriorityCount: highPrioritySignals.length,
                renewalBaseline: this.getRandomRenewalValue(),
                status: planData.status || 'Pending',
                urgency: highPrioritySignals.length > 1 ? 'critical' : highPrioritySignals.length === 1 ? 'high' : 'normal',
                planData: normalizedPlanData,
                lastUpdated: planData.updatedAt || planData.createdAt,
                nextAction: this.getNextAction(planData),
                daysUntilRenewal: Math.floor(Math.random() * 300) + 30
            });
        }

        // If we have Domo action plans, return them
        if (actionPlans.length > 0) {
            console.log(`Using ${actionPlans.length} action plans from app state`);
            if (window.DataService && Array.isArray(window.DataService.actionPlans)) {
                console.log(`🔧 [FIX] Synced ${DataService.actionPlans.length} plans to DataService for auto-save`);
            }
            return actionPlans.sort((a, b) => {
                // Sort by urgency first, then by last updated
                const urgencyOrder = { critical: 0, high: 1, normal: 2 };
                if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                }
                return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
            });
        }

        // Only if no Domo action plans exist, try loading fallback JSON
        try {
            console.log('No action plans from Domo, loading fallback data...');
            const fallbackPlans = await this.loadFallbackActionPlans(app);
            if (fallbackPlans.length > 0) {
                console.log(`Loaded ${fallbackPlans.length} action plans from fallback JSON`);
                
                // Store the fallback plans in the app's action plans map
                console.log('Storing loaded action plans in app state...');
                
                // Clear DataService array first to avoid duplicates (if available)
                if (window.DataService && Array.isArray(window.DataService.actionPlans)) {
                    DataService.actionPlans.length = 0;
                }
                fallbackPlans.forEach(plan => {
                    if (plan.accountId && app.actionPlans) {
                        // Use unique plan ID as key instead of accountId to avoid overwrites
                        const planId = plan.planData.originalPlanContent.id || plan.planData.id || `plan-${Date.now()}-${Math.random()}`;
                        
                        // Store the actual plan data with necessary account info, not the wrapper
                        const actualPlanData = {
                            ...plan.planData,
                            accountId: plan.accountId,
                            accountName: plan.accountName,
                            title: plan.planData.originalPlanContent.title,
                            description: plan.planData.originalPlanContent.description,
                            plays: plan.planData.originalPlanContent.plays || [],
                            actionId: plan.planData.originalPlanContent.actionId,
                            priority: plan.planData.originalPlanContent.priority || 'medium',
                            status: plan.planData.originalPlanContent.status || 'pending',  // Preserve status field
                            dueDate: plan.planData.originalPlanContent.dueDate,
                            createdDate: plan.planData.originalPlanContent.createdDate,
                            signalId: plan.planData.originalPlanContent.signalId,
                            planTitle: plan.planData.originalPlanContent.planTitle,
                            createdBy: plan.planData.originalPlanContent.createdBy,
                            createdByUserId: plan.planData.originalPlanContent.createdByUserId
                        };
                        
                        app.actionPlans.set(planId, actualPlanData);
                        
                        // CRITICAL: Synchronize with DataService.actionPlans array
                        // Ensure the plan has the correct ID structure for DataService
                        const dataServicePlan = {
                            ...actualPlanData,
                            id: planId // Ensure ID is set for DataService array lookup
                        };
                        if (window.DataService && Array.isArray(window.DataService.actionPlans)) {
                            DataService.actionPlans.push(dataServicePlan);
                        }
                        
                        console.log(`Stored action plan with ID ${planId} for account: ${plan.accountName} (${plan.accountId})`);
                    }
                });
                
                // 🔧 CRITICAL FIX: Return same wrapper structure as Domo path
                // Instead of returning raw fallbackPlans, rebuild from app.actionPlans for consistency
                // 🔧 CRITICAL FIX: Update SignalsStore state with fallback data
                if (window.signalsStore) {
                    console.log('Updating SignalsStore state with fallback action plans...');
                    const currentState = window.signalsStore.getState();
                    const updatedActionPlans = new Map(currentState.actionPlans);
                    
                    // Add fallback plans to the state
                    for (let [planId, planData] of app.actionPlans) {
                        updatedActionPlans.set(planId, planData);
                    }
                    
                    // Update the state
                    window.signalsStore.setState({ actionPlans: updatedActionPlans });
                    console.log(`Updated SignalsStore with ${updatedActionPlans.size} action plans`);
                    
        // Trigger re-render of Portfolio view
        console.log('🔔 Emitting action-plans-updated event to trigger Portfolio re-render');
        window.signalsStore.emitChange('action-plans-updated', 'action-plans-updated');
                }
                
                console.log('Rebuilding formatted plans from app.actionPlans for consistent structure...');
                
                const formattedFallbackPlans = [];
                for (let [planId, planData] of app.actionPlans) {
                    const accountId = planData.accountId;
                    
                    // Handle missing app.accounts gracefully 
                    const account = (app.accounts && app.accounts.get) ? app.accounts.get(accountId) : null;
                    if (!account && !planData.accountName) {
                        console.warn(`Skipping plan ${planId} - no account data available for ${accountId}`);
                        continue;
                    }
                    
                    // Handle missing account.signals gracefully
                    const highPrioritySignals = (account && account.signals) ? account.signals.filter(s => s.priority === 'High') : [];
                    
                    // Try to get account name from signalsStore if not found in app.accounts
                    let fallbackAccountName = null;
                    if (account) {
                        fallbackAccountName = account.name || account.account_name;
                    } else if (window.signalsStore) {
                        const storeAccount = window.signalsStore.getAccount(accountId);
                        if (storeAccount) {
                            fallbackAccountName = storeAccount.name || storeAccount.account_name;
                        }
                    }
                    
                    formattedFallbackPlans.push({
                        accountId: accountId,
                        accountName: fallbackAccountName || planData.accountName || `Account ${accountId}`,
                        accountHealth: this.getHealthFromRiskCategory(account?.at_risk_cat || 'Unknown'),
                        signalsCount: (account && account.signals) ? account.signals.length : 0,
                        highPriorityCount: highPrioritySignals.length,
                        renewalBaseline: this.getRandomRenewalValue(),
                        status: planData.status || 'Pending',
                        urgency: highPrioritySignals.length > 1 ? 'critical' : highPrioritySignals.length === 1 ? 'high' : 'normal',
                        planData: { ...planData, id: planId }, // Ensure consistent ID
                        lastUpdated: planData.updatedAt || planData.createdAt,
                        nextAction: this.getNextAction(planData),
                        daysUntilRenewal: Math.floor(Math.random() * 300) + 30
                    });
                }
                
                console.log(`🔧 [CRITICAL FIX] Built ${formattedFallbackPlans.length} formatted fallback plans with consistent structure`);
                return formattedFallbackPlans.sort((a, b) => {
                    // Same sorting as Domo path
                    const urgencyOrder = { critical: 0, high: 1, normal: 2 };
                    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                    }
                    return new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0);
                });
            }
        } catch (error) {
            console.error('🚨 Failed to load fallback action plans:', error);
            console.log('🔍 In production without fallback file - action plans unavailable for modal');
        }

        // 🚨 PRODUCTION ISSUE: If no action plans from any source, return empty array
        console.log('⚠️ No action plans available - returning empty array');
        return [];
    }

    static filterActionPlans(actionPlans, filter) {
        switch (filter) {
            case 'pending':
                return actionPlans.filter(plan => StatusUtils.normalizeStatusToCanonical(plan.status) === 'pending');
            case 'in-progress':
                return actionPlans.filter(plan => StatusUtils.normalizeStatusToCanonical(plan.status) === 'in_progress');
            case 'completed':
                return actionPlans.filter(plan => StatusUtils.normalizeStatusToCanonical(plan.status) === 'complete');
            default:
                return actionPlans;
        }
    }

    static renderProjectManagementTable(actionPlans, app) {
        // Group plans by account for proper rendering
        const plansByAccount = new Map();
        actionPlans.forEach(plan => {
            const accountId = plan.accountId;
            if (!plansByAccount.has(accountId)) {
                plansByAccount.set(accountId, []);
            }
            plansByAccount.get(accountId).push(plan);
        });
        
        console.log(`Rendering ${plansByAccount.size} account groups with ${actionPlans.length} total plans`);
        
        return `
            <div class="project-management-container">
                <div class="pm-table-header">
                    <div class="pm-header-cell checkbox-col"></div>
                    <div class="pm-header-cell task-col">Action Plan</div>
                    <div class="pm-header-cell due-date-col">Due Date</div>
                    <div class="pm-header-cell status-col">Status</div>
                    <div class="pm-header-cell priority-col">Priority</div>
                    <div class="pm-header-cell assignee-col">Assignee</div>
                </div>
                
                ${Array.from(plansByAccount.values()).map(accountPlans => 
                    this.renderAccountGroup(accountPlans, app)
                ).join('')}
            </div>
        `;
    }

    static renderAccountGroup(accountPlans, app) {
        // accountPlans is now an array of plans for the same account
        if (!Array.isArray(accountPlans) || accountPlans.length === 0) {
            return '';
        }
        
        // Use the first plan for account-level information
        const firstPlan = accountPlans[0];
        
        // Get all tasks from all plans for this account
        const allActionPlans = [];
        accountPlans.forEach(plan => {
            const tasks = this.getActionPlansFromPlan(plan, app);
            allActionPlans.push(...tasks);
        });
        
        console.log(`Account ${firstPlan.accountName}: Generated ${allActionPlans.length} tasks from ${accountPlans.length} plans`);
        
        // 🔒 SECURITY FIX: Create HTML template and then safely set untrusted content
        const html = `
            <div class="account-group">
                <div class="account-group-header">
                    <div class="account-group-title">
                        <i class="fas fa-chevron-down group-toggle" data-action="toggle-group"></i>
                        <span class="account-name"></span>
                        <span class="task-count">${allActionPlans.length} action plans</span>
                        <span class="account-health health-${firstPlan.accountHealth}"></span>
                        <span class="renewal-value"></span>
                    </div>
                </div>
                
                <div class="account-action-plans">
                    ${allActionPlans.map(task => this.renderTaskRow(task, app)).join('')}
                </div>
            </div>
        `;
        
        // Set account info safely via DOM manipulation
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Set account name safely
        const accountNameSpan = tempDiv.querySelector('.account-name');
        if (accountNameSpan) {
            accountNameSpan.textContent = firstPlan.accountName || 'Unknown Account';
        }
        
        // Set account health safely
        const accountHealthSpan = tempDiv.querySelector('.account-health');
        if (accountHealthSpan) {
            accountHealthSpan.textContent = firstPlan.accountHealth || 'Unknown';
        }
        
        // Set renewal value safely
        const renewalValueSpan = tempDiv.querySelector('.renewal-value');
        if (renewalValueSpan) {
            renewalValueSpan.textContent = FormatUtils.formatCurrency(firstPlan.renewalBaseline || 0);
        }
        
        return tempDiv.innerHTML;
    }

    static renderTaskRow(task, app) {
        const isComplete = StatusUtils.normalizeStatusToCanonical(task.status) === 'complete';
        
        // 🔒 SECURITY FIX: Create DOM elements safely instead of HTML interpolation
        const row = document.createElement('div');
        row.className = `pm-table-row action-plan-row clickable-task ${isComplete ? 'task-completed' : ''}`;
        row.setAttribute('data-task-id', task.id || '');
        row.setAttribute('data-action-id', task.actionId || '');
        row.setAttribute('data-selectable', 'true');
        
        // Create checkbox column
        const checkboxCol = document.createElement('div');
        checkboxCol.className = 'pm-cell checkbox-col';
        // Checkbox click handling will be managed by delegation
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'action-plan-checkbox';
        checkbox.checked = isComplete; // Set initial state
        
        checkboxCol.appendChild(checkbox);
        
        // Create task column
        const taskCol = document.createElement('div');
        taskCol.className = 'pm-cell task-col';
        
        const actionPlanContent = document.createElement('div');
        actionPlanContent.className = 'action-plan-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'action-plan-title';
        titleDiv.textContent = task.title || ''; // Safe text content
        
        actionPlanContent.appendChild(titleDiv);
        
        if (task.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'action-plan-description';
            descDiv.textContent = task.description; // Safe text content
            actionPlanContent.appendChild(descDiv);
        }
        
        taskCol.appendChild(actionPlanContent);
        
        // Create due date column
        const dueDateCol = document.createElement('div');
        dueDateCol.className = 'pm-cell due-date-col';
        
        const dueDateSpan = document.createElement('span');
        dueDateSpan.className = `due-date ${task.overdue ? 'overdue' : ''}`;
        dueDateSpan.textContent = task.dueDate || ''; // Safe text content
        
        dueDateCol.appendChild(dueDateSpan);
        
        // Create status column with whitelisted values
        const statusCol = document.createElement('div');
        statusCol.className = 'pm-cell status-col';
        
        const statusSpan = document.createElement('span');
        const safeStatus = StatusUtils.normalizeStatusToCanonical(task.status) || 'pending';
        const safeStatusDisplay = StatusUtils.getStatusDisplayLabel ? StatusUtils.getStatusDisplayLabel(safeStatus) : (task.status || 'Pending');
        statusSpan.className = `status-badge ${StatusUtils.getStatusCSSClass(safeStatus)}`;
        statusSpan.textContent = safeStatusDisplay; // Safe text content
        
        statusCol.appendChild(statusSpan);
        
        // Create priority column with whitelisted values
        const priorityCol = document.createElement('div');
        priorityCol.className = 'pm-cell priority-col';
        
        const prioritySpan = document.createElement('span');
        const safePriority = ['High', 'Medium', 'Low'].includes(task.priority) ? task.priority : 'Medium';
        prioritySpan.className = `priority-badge priority-${safePriority.toLowerCase()}`;
        prioritySpan.textContent = safePriority; // Safe text content
        
        priorityCol.appendChild(prioritySpan);
        
        // Create assignee column
        const assigneeCol = document.createElement('div');
        assigneeCol.className = 'pm-cell assignee-col';
        
        const assigneeAvatar = document.createElement('div');
        assigneeAvatar.className = 'assignee-avatar';
        
        const assigneeInitials = document.createElement('span');
        assigneeInitials.className = 'assignee-initials';
        assigneeInitials.textContent = task.assigneeInitials || ''; // Safe text content
        
        assigneeAvatar.appendChild(assigneeInitials);
        assigneeCol.appendChild(assigneeAvatar);
        
        // Assemble the row
        row.appendChild(checkboxCol);
        row.appendChild(taskCol);
        row.appendChild(dueDateCol);
        row.appendChild(statusCol);
        row.appendChild(priorityCol);
        row.appendChild(assigneeCol);
        
        return row.outerHTML;
    }

    static renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <div class="empty-state-title">No Action Plans Yet</div>
                <div class="empty-state-description">
                    Action plans will appear here when you create them for accounts with signals.
                    Go to the Signal Feed or My Portfolio to create your first action plan.
                </div>
                <div class="empty-state-actions">
                    <button class="btn btn-primary" data-action="switch-tab" data-tab="signal-feed">
                        <i class="fas fa-stream"></i> View Signal Feed
                    </button>
                    <button class="btn btn-secondary" data-action="switch-tab" data-tab="my-portfolio">
                        <i class="fas fa-briefcase"></i> View Portfolio
                    </button>
                </div>
            </div>
        `;
    }

    static calculateProgress(planData) {
        if (!planData.actionItems || planData.actionItems.length === 0) {
            return 0;
        }

        // Since we don't track completion status yet, we'll base it on creation time
        const daysSinceCreated = (new Date() - new Date(planData.createdAt)) / (1000 * 60 * 60 * 24);

        if (daysSinceCreated < 1) return 25;
        if (daysSinceCreated < 3) return 50;
        if (daysSinceCreated < 7) return 75;
        return 90;
    }

    static calculatePlanStatus(planData) {
        if (!planData.actionItems || planData.actionItems.length === 0) {
            return 'Draft';
        }

        // Since we don't track completion status yet, we'll base it on creation time
        const daysSinceCreated = (new Date() - new Date(planData.createdAt)) / (1000 * 60 * 60 * 24);

        if (daysSinceCreated < 1) return 'New';
        if (daysSinceCreated < 3) return 'In Progress';
        return 'Review Needed';
    }

    static getNextAction(planData) {
        if (!planData.actionItems || planData.actionItems.length === 0) {
            return 'Add action items';
        }

        const firstAction = planData.actionItems[0];
        if (firstAction.length > 30) {
            return firstAction.substring(0, 30) + '...';
        }
        return firstAction;
    }

    static getHealthFromRiskCategory(riskCategory) {
        const healthMap = {
            'Healthy': 'healthy',
            'At Risk': 'warning',
            'Trending Risk': 'warning',
            'Extreme Risk': 'critical'
        };
        return healthMap[riskCategory] || 'healthy';
    }

    static getRandomRenewalValue() {
        // Generate a realistic renewal value between 50K and 500K
        const baseValue = Math.floor(Math.random() * 450000) + 50000;
        // Round to nearest 1000
        return Math.round(baseValue / 1000) * 1000;
    }

    // Project Management Helper Methods
    static getActionPlansFromPlan(plan, app) {
        const actionPlans = [];
        
        // Handle new single-action-per-plan data model
        // Each plan now represents one action, not multiple actionItems
        if (!plan.planData) return actionPlans;
        
        // In the new model, action data is directly in the plan, not in actionItems array
        const title = plan.title || plan.planData.title || 'Untitled Action';
        const actionId = plan.actionId || plan.planData.actionId;
        
        // Only include actions with real action IDs from CSV data
        if (!actionId) {
            console.warn(`Skipping action without actionId: ${title}`);
            return actionPlans;
        }
        
        // Get CS plays count from the plan's plays array
        let playsCount = 0;
        const plays = plan.plays || plan.planData.plays || [];
        if (Array.isArray(plays)) {
            playsCount = plays.length;
        } else {
            playsCount = this.getPlaysCountForAction(actionId, app);
        }
        
        // Debug log to see what's happening with action and plays data
        console.log(`Action "${title}" (ID: ${actionId}) has plays:`, plays, 'count:', playsCount);
        
        // Generate realistic due date
        const dueDate = this.generateDueDate(0);
        
        // Determine priority from plan data
        const priority = plan.priority || plan.planData.priority || 'Medium';
        
        // Get assignee initials from plan data or generate
        let assigneeInitials;
        const rawAssignee = plan.assignee || plan.planData.assignee || plan.createdBy || plan.planData.createdBy;
        if (rawAssignee) {
            // 🔧 FIXED: Resolve assignee name first, then get initials
            const resolvedAssignee = this.resolveAssigneeName(rawAssignee);
            assigneeInitials = resolvedAssignee === 'Current User' ? 'CU' : this.getInitialsFromName(resolvedAssignee);
        } else {
            assigneeInitials = this.generateAssigneeInitials();
        }
        
        // Create single task from the plan (new single-action-per-plan model)
        const description = plan.description || plan.planData.description || '';
        const status = plan.status || plan.planData.status || 'pending';
        
        actionPlans.push({
            id: plan.id || plan.planData.id || `${plan.accountId}-0`,
            title: title,
            description: description.length > 100 ? description.substring(0, 100) + '...' : description,
            actionId: actionId,
            dueDate: dueDate.formatted,
            overdue: dueDate.overdue,
            playsCount: playsCount,
            status: this.capitalizeFirstLetter(status),
            priority: this.capitalizeFirstLetter(priority),
            assigneeInitials: assigneeInitials,
            completed: false,
            accountId: plan.accountId,
            rawActionItem: {
                title: title,
                actionId: actionId,
                plays: plays,
                description: description,
                status: status,
                priority: priority
            },
            isAIGenerated: false // All data is now real from CSV/JSON
        });
        
        return actionPlans;
    }
    
    static capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }

    // ⚡ Use centralized status utilities
    static normalizeStatusToCanonical(status) {
        return StatusUtils.normalizeStatusToCanonical(status);
    }

    static getStatusDisplayLabel(canonicalStatus) {
        return StatusUtils.getStatusDisplayLabel(canonicalStatus);
    }
    
    // REMOVED - Do not generate fake action IDs

    static getPlaysCountForAction(actionId, app) {
        if (!actionId || !app.data) return 0;
        
        // Find signal with this action_id to get plays count
        const signal = app.data.find(s => s.action_id === actionId);
        if (!signal) return 0;

        let count = 0;
        if (signal.play_1_name && signal.play_1_name.trim()) count++;
        if (signal.play_2_name && signal.play_2_name.trim()) count++;
        if (signal.play_3_name && signal.play_3_name.trim()) count++;
        
        return count;
    }

    static getPlaysDataForAction(actionId, app) {
        if (!actionId || !app.data) return [];
        
        // Find signal with this action_id to get plays data
        const signal = app.data.find(s => s.action_id === actionId);
        if (!signal) return [];

        const plays = [];
        if (signal.play_1_name && signal.play_1_name.trim()) {
            plays.push({
                playId: `play_${actionId}_1`,
                playName: signal.play_1_name.trim(),
                playTitle: signal.play_1_name.trim()
            });
        }
        if (signal.play_2_name && signal.play_2_name.trim()) {
            plays.push({
                playId: `play_${actionId}_2`,
                playName: signal.play_2_name.trim(),
                playTitle: signal.play_2_name.trim()
            });
        }
        if (signal.play_3_name && signal.play_3_name.trim()) {
            plays.push({
                playId: `play_${actionId}_3`,
                playName: signal.play_3_name.trim(),
                playTitle: signal.play_3_name.trim()
            });
        }
        
        return plays;
    }

    static generateDueDate(index) {
        const today = new Date();
        const daysToAdd = Math.floor(Math.random() * 14) + 1; // 1-14 days
        const dueDate = new Date(today.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
        
        // Sometimes make dates overdue for realism
        const isOverdue = Math.random() < 0.15; // 15% chance of overdue
        
        if (isOverdue && index > 0) {
            dueDate.setDate(dueDate.getDate() - Math.floor(Math.random() * 5) - 1);
        }

        const formatted = dueDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });

        return {
            formatted,
            overdue: isOverdue && index > 0,
            date: dueDate
        };
    }

    static determinePriority(plan, index) {
        if (plan.urgency === 'critical') {
            return index === 0 ? 'High' : (Math.random() > 0.5 ? 'High' : 'Medium');
        } else if (plan.urgency === 'high') {
            return index === 0 ? 'High' : (Math.random() > 0.6 ? 'Medium' : 'Low');
        } else {
            return Math.random() > 0.7 ? 'Medium' : 'Low';
        }
    }

    static generateAssigneeInitials() {
        const names = ['JS', 'MK', 'AB', 'RT', 'LW', 'DM', 'SC', 'JH', 'KP', 'NR'];
        return names[Math.floor(Math.random() * names.length)];
    }

    static getInitialsFromName(fullName) {
        if (!fullName || typeof fullName !== 'string') return 'UN';
        
        const parts = fullName.trim().split(' ');
        if (parts.length === 1) {
            // Single name, use first two characters
            return parts[0].substring(0, 2).toUpperCase();
        } else {
            // Multiple parts, use first letter of first and last
            return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
        }
    }
    
    // 🔧 NEW: Resolve assignee using same logic as table view
    static resolveAssigneeName(assignee) {
        if (!assignee) return 'Current User';
        if (assignee === 'Current User') return 'Current User';
        
        // Handle user IDs (numbers) by mapping to known users
        if (typeof assignee === 'number' || /^\d+$/.test(assignee)) {
            // Map known user IDs to names (from production data)
            const userIdMap = {
                '621623466': 'Ed Engalan',
                // Add more user ID mappings as needed
            };
            return userIdMap[assignee.toString()] || 'Current User';
        }
        
        // If it's already a name, return as is
        return assignee;
    }
    
    // 🔧 NEW: Capitalize first letter (same as existing logic)
    static capitalizeFirstLetter(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Interactive Methods

    static toggleGroup(chevron) {
        const group = chevron.closest('.account-group');
        const tasks = group.querySelector('.account-action-plans');
        
        if (tasks.style.display === 'none') {
            tasks.style.display = 'block';
            chevron.classList.remove('fa-chevron-right');
            chevron.classList.add('fa-chevron-down');
        } else {
            tasks.style.display = 'none';
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-right');
        }
    }

    static async toggleTaskComplete(taskId, completed) {
        const taskRow = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskRow) return;
        
        const actionId = taskRow.dataset.actionId;
        
        // Get current status before changing it
        const statusBadge = taskRow.querySelector('.status-badge');
        const currentStatus = statusBadge ? statusBadge.textContent.trim() : 'Pending';
        
        // Store previous status on the element if we haven't already
        if (!taskRow.dataset.previousStatus && currentStatus !== 'Complete') {
            taskRow.dataset.previousStatus = currentStatus;
        }
        
        // Determine new status
        let newStatus;
        if (completed) {
            newStatus = 'Complete';
            taskRow.classList.add('action-plan-completed');
        } else {
            // Restore previous status or default to 'Pending'
            newStatus = taskRow.dataset.previousStatus || 'Pending';
            taskRow.classList.remove('action-plan-completed');
            // Clear the stored previous status since we're back to original state
            delete taskRow.dataset.previousStatus;
        }
        
        // Update the status badge immediately for responsive UI
        if (statusBadge) {
            statusBadge.textContent = newStatus;
            statusBadge.className = `status-badge ${StatusUtils.getStatusCSSClass(StatusUtils.normalizeStatusToCanonical(newStatus))}`;
        }
        
        console.log(`Task ${taskId} status changing from "${currentStatus}" to "${newStatus}"`);
        
        // Find the action plan and update it via ActionPlanService
        try {
            // Try to get app instance, but don't fail if it doesn't exist
            const app = window.app || {};
            
            // Find the plan ID associated with this task
            let planId = null;
            let planData = null;
            
            // Try to get actionPlans from multiple sources
            let actionPlansMap = null;
            
            // First try: signalsStore (most reliable)
            if (window.signalsStore) {
                const state = window.signalsStore.getState();
                if (state && state.actionPlans) {
                    actionPlansMap = state.actionPlans;
                    console.log('Using actionPlans from signalsStore');
                }
            }
            
            // Second try: app.actionPlans
            if (!actionPlansMap && app.actionPlans) {
                actionPlansMap = app.actionPlans;
                console.log('Using actionPlans from app');
            }
            
            // If still no actionPlans, try to find the plan by taskId directly
            if (!actionPlansMap) {
                console.warn('No actionPlans found in app or signalsStore, trying direct lookup');
                // Use taskId as planId as fallback
                planId = taskId;
                planData = { status: newStatus, actionId: actionId };
            } else {
                // Ensure actionPlans is iterable (Map or Object)
                if (!(actionPlansMap instanceof Map)) {
                    if (Array.isArray(actionPlansMap)) {
                        actionPlansMap = new Map(actionPlansMap.map(plan => [plan.id, plan]));
                    } else if (typeof actionPlansMap === 'object') {
                        actionPlansMap = new Map(Object.entries(actionPlansMap));
                    } else {
                        console.error('actionPlans is not iterable:', typeof actionPlansMap);
                        return;
                    }
                }
                
                // Search through action plans to find the one containing this action
                // Handle new single-action-per-plan data model where each plan represents one action
                for (let [id, plan] of actionPlansMap) {
                    // Check if this plan's actionId matches the task's actionId
                    const planActionId = plan.actionId || plan.planData?.actionId;
                    
                    if (planActionId === actionId) {
                        planId = id;
                        planData = plan;
                        break;
                    }
                }
                
                // If we didn't find by actionId, try to find by the task ID itself (fallback)
                if (!planId && actionPlansMap.has(taskId)) {
                    planId = taskId;
                    planData = actionPlansMap.get(taskId);
                }
            }
            
            if (planId && planData) {
                // Update the plan's status directly (new single-action-per-plan model)
                planData.status = newStatus;
                
                // Update the entire plan with the new status
                const updateResult = await ActionPlansService.updateActionPlan(planId, {
                    status: newStatus,
                    updatedAt: new Date().toISOString()
                }, app);
                
                if (updateResult.success) {
                    console.log(`Successfully updated action plan status for task ${taskId} to ${newStatus}`);
                    
                    // Update local data for immediate UI consistency
                    if (actionPlansMap && actionPlansMap.has(planId)) {
                        actionPlansMap.set(planId, planData);
                    }
                    
                    // Also update signalsStore if available
                    if (window.signalsStore) {
                        const state = window.signalsStore.getState();
                        if (state.actionPlans && state.actionPlans.has(planId)) {
                            const storePlan = state.actionPlans.get(planId);
                            storePlan.status = newStatus;
                            storePlan.updatedAt = new Date().toISOString();
                            state.actionPlans.set(planId, storePlan);
                        }
                    }
                } else {
                    console.error('Failed to update action plan:', updateResult.error);
                    // Revert UI changes if save failed
                    if (completed) {
                        taskRow.classList.remove('action-plan-completed');
                    } else {
                        taskRow.classList.add('action-plan-completed');
                    }
                    if (statusBadge) {
                        statusBadge.textContent = currentStatus;
                        statusBadge.className = `status-badge ${StatusUtils.getStatusCSSClass(StatusUtils.normalizeStatusToCanonical(currentStatus))}`;
                    }
                }
            } else {
                console.warn(`Could not find action plan for task ${taskId} with action ${actionId}`);
            }
        } catch (error) {
            console.error('Error updating action plan status:', error);
            // Revert UI changes if save failed
            if (completed) {
                taskRow.classList.remove('action-plan-completed');
            } else {
                taskRow.classList.add('action-plan-completed');
            }
            if (statusBadge) {
                statusBadge.textContent = currentStatus;
                statusBadge.className = `status-badge ${StatusUtils.getStatusCSSClass(StatusUtils.normalizeStatusToCanonical(currentStatus))}`;
            }
        }
    }

    // === MULTI-SELECT AND RIGHT-CLICK FUNCTIONALITY ===

    static selectedTasks = new Set();

    static handleTaskRowClick(event, taskId, actionId) {
        // Check for Ctrl/Cmd + Click for multi-selection
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.toggleTaskSelection(taskId);
            return;
        }

        // Clear selection if no modifier keys
        this.clearTaskSelection();
        
        // Open task details drawer (original functionality)
        this.openTaskDetailsDrawer(taskId, actionId);
    }

    static handleTaskRightClick(event, taskId, actionId) {
        event.preventDefault();
        
        // If right-clicking on a non-selected task, select only that task
        if (!this.selectedTasks.has(taskId)) {
            this.clearTaskSelection();
            this.toggleTaskSelection(taskId);
        }

        this.showContextMenu(event, taskId, actionId);
    }

    static toggleTaskSelection(taskId) {
        const taskRow = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskRow) return;

        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
            taskRow.classList.remove('task-selected');
        } else {
            this.selectedTasks.add(taskId);
            taskRow.classList.add('task-selected');
        }

        console.log('Selected tasks:', Array.from(this.selectedTasks));
    }

    static clearTaskSelection() {
        document.querySelectorAll('.task-row.task-selected').forEach(row => {
            row.classList.remove('task-selected');
        });
        this.selectedTasks.clear();
    }

    static showContextMenu(event, taskId, actionId) {
        // Remove existing context menu
        this.removeContextMenu();

        const menu = document.createElement('div');
        menu.id = 'taskContextMenu';
        menu.className = 'task-context-menu';
        
        const selectedCount = this.selectedTasks.size;
        const menuText = selectedCount > 1 ? `Delete ${selectedCount} Tasks` : 'Delete Task';
        const iconClass = selectedCount > 1 ? 'fa-trash-alt' : 'fa-trash';
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="ActionsRenderer.confirmDeleteTasks()">
                <i class="fas ${iconClass}"></i>
                <span>${menuText}</span>
            </div>
        `;

        // Position the menu at cursor
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';

        document.body.appendChild(menu);

        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu, { once: true });
        }, 10);
    }

    static removeContextMenu() {
        const menu = document.getElementById('taskContextMenu');
        if (menu) {
            menu.remove();
        }
    }

    static confirmDeleteTasks() {
        this.removeContextMenu();
        
        const selectedCount = this.selectedTasks.size;
        if (selectedCount === 0) return;

        this.showDeleteConfirmationModal(selectedCount);
    }

    static showDeleteConfirmationModal(taskCount) {
        // Remove existing modal if present
        this.removeDeleteModal();

        const modal = document.createElement('div');
        modal.id = 'deleteConfirmationModal';
        modal.className = 'delete-confirmation-modal';

        const taskText = taskCount === 1 ? 'task' : 'tasks';
        const deleteText = taskCount === 1 ? 'this task' : `these ${taskCount} tasks`;

        modal.innerHTML = `
            <div class="delete-modal-backdrop" onclick="ActionsRenderer.removeDeleteModal()"></div>
            <div class="delete-modal-content">
                <div class="delete-modal-header">
                    <div class="delete-modal-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h3 class="delete-modal-title">Delete ${taskText.charAt(0).toUpperCase() + taskText.slice(1)}</h3>
                </div>
                
                <div class="delete-modal-body">
                    <p>Are you sure you want to delete ${deleteText}? This action cannot be undone.</p>
                    ${taskCount > 1 ? `<p class="delete-task-count">${taskCount} ${taskText} will be permanently removed.</p>` : ''}
                </div>
                
                <div class="delete-modal-footer">
                    <button class="btn btn-secondary delete-cancel-btn" onclick="ActionsRenderer.removeDeleteModal()">
                        Cancel
                    </button>
                    <button class="btn btn-danger delete-confirm-btn" onclick="ActionsRenderer.executeTaskDeletion()">
                        <i class="fas fa-trash"></i> Delete ${taskText.charAt(0).toUpperCase() + taskText.slice(1)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
    }

    static removeDeleteModal() {
        const modal = document.getElementById('deleteConfirmationModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                }
            }, 200);
        }
    }

    static async executeTaskDeletion() {
        const selectedTaskIds = Array.from(this.selectedTasks);
        
        if (selectedTaskIds.length === 0) {
            this.removeDeleteModal();
            return;
        }

        // Close the confirmation modal
        this.removeDeleteModal();

        try {
            // Group tasks by plan for efficient processing
            const tasksByPlan = {};
            
            for (const taskId of selectedTaskIds) {
                // The taskId is actually a plan ID, we need to find which plan it belongs to
                const state = window.signalsStore ? window.signalsStore.getState() : null;
                let planData = null;
                let planId = null;
                
                if (state && state.actionPlans) {
                    // Find the plan that contains this task
                    for (const [id, plan] of state.actionPlans) {
                        if (plan && plan.actionItems) {
                            const taskIndex = plan.actionItems.findIndex(item => item.id === taskId);
                            if (taskIndex !== -1) {
                                planData = plan;
                                planId = id;
                                
                                if (!tasksByPlan[planId]) {
                                    tasksByPlan[planId] = {
                                        planData: planData,
                                        tasks: []
                                    };
                                }
                                tasksByPlan[planId].tasks.push({
                                    taskId: taskId,
                                    taskIndex: taskIndex
                                });
                                break;
                            }
                        }
                    }
                }
            }

            let deletedCount = 0;
            
            // Process each action plan
            for (const [planId, planInfo] of Object.entries(tasksByPlan)) {
                try {
                    const planData = planInfo.planData;
                    const tasksToDelete = planInfo.tasks;
                    
                    if (!planData || !planData.actionItems) {
                        console.warn(`Could not find action plan: ${planId}`);
                        continue;
                    }

                    // Sort tasks by index in descending order to avoid index shifting during deletion
                    const sortedTasks = tasksToDelete.sort((a, b) => b.taskIndex - a.taskIndex);
                    
                    // Create a copy of action items and remove the selected ones by index
                    const updatedActionItems = [...planData.actionItems];
                    
                    for (const task of sortedTasks) {
                        if (task.taskIndex >= 0 && task.taskIndex < updatedActionItems.length) {
                            updatedActionItems.splice(task.taskIndex, 1);
                            deletedCount++;
                        }
                    }

                    // Update the action plan with reduced tasks using CRUD methods
                    const updatedPlanData = {
                        ...planData,
                        actionItems: updatedActionItems,
                        updatedAt: new Date()
                    };

                    // Use ActionPlanService CRUD to update the plan
                    const result = await ActionPlansService.updateActionPlan(planData.id, updatedPlanData, window.app);
                    
                    if (result && result.success) {
                        console.log(`Successfully deleted ${sortedTasks.length} tasks from action plan ${planData.id}`);
                        
                        // Update the local data immediately for UI consistency
                        const state = window.signalsStore ? window.signalsStore.getState() : null;
                        if (state && state.actionPlans && planId) {
                            state.actionPlans.set(planId, result.plan || updatedPlanData);
                        }
                    } else {
                        console.error(`Failed to update action plan ${planData.id}:`, result ? result.error : 'No response');
                        // Revert the deleted count for failed operations
                        deletedCount -= sortedTasks.length;
                    }
                    
                } catch (error) {
                    console.error(`Error deleting tasks from account ${accountId}:`, error);
                }
            }

            // Clear selection
            this.clearTaskSelection();
            
            // Show appropriate notification and refresh
            if (deletedCount > 0) {
                const taskText = deletedCount === 1 ? 'task' : 'tasks';
                console.log(`✅ Successfully deleted ${deletedCount} ${taskText}`);
                
                // Refresh the Action Plans view to show updated data
                console.log('Refreshing Action Plans view after task deletion');
                this.renderActions();
            } else {
                console.error('Failed to delete tasks. Please try again.');
            }

        } catch (error) {
            console.error('Error during task deletion:', error);
            console.error('An error occurred while deleting tasks');
            this.clearTaskSelection();
        }
    }

    static async findActionPlanContainingTask(actionId, app) {
        // Search through action plans to find the one containing this actionId
        for (let [accountId, planData] of app.actionPlans) {
            if (planData.actionItems) {
                const foundItem = planData.actionItems.find(item => item.id === actionId);
                if (foundItem) {
                    return {
                        accountId: accountId,
                        planData: planData,
                        actionItem: foundItem
                    };
                }
            }
        }
        return null;
    }

    static openPlaysModal(actionId, taskTitle) {
        console.log(`Opening plays modal for action ${actionId}: ${taskTitle}`);
        
        // Find the action item with this actionId to get its plays
        const actionPlan = this.findActionPlanWithActionId(actionId, window.app);
        if (!actionPlan) {
            console.error('Could not find action plan for actionId:', actionId);
            return;
        }
        
        this.openPlaysDrawer(actionId, taskTitle, actionPlan.actionItem, actionPlan.planData);
    }
    
    static findActionPlanWithActionId(actionId, app) {
        // Search through action plans to find the action item with this actionId
        for (let [accountId, planData] of app.actionPlans) {
            if (planData.actionItems) {
                const actionItem = planData.actionItems.find(item => {
                    return item.actionId === actionId || (typeof item === 'object' && item.actionId === actionId);
                });
                if (actionItem) {
                    return { actionItem, planData, accountId };
                }
            }
        }
        
        // If not found in live data, search fallback data
        return this.findInFallbackData(actionId, app);
    }
    
    static async findInFallbackData(actionId, app) {
        try {
            const response = await fetch('/action-plans-fallback.json');
            const fallbackData = await response.json();
            
            for (const record of fallbackData) {
                const planContent = record.content;
                if (planContent && planContent.actionItems) {
                    const actionItem = planContent.actionItems.find(item => item.actionId === actionId);
                    if (actionItem) {
                        return { actionItem, planData: planContent, accountId: planContent.accountId };
                    }
                }
            }
        } catch (error) {
            console.error('Error searching fallback data:', error);
        }
        return null;
    }
    
    static openPlaysDrawer(actionId, taskTitle, actionItem, planData) {
        console.log('Opening plays drawer for:', { actionId, taskTitle, actionItem });
        
        // Get or create drawer elements
        let drawer = document.getElementById('playsDrawer');
        let backdrop = document.getElementById('playsDrawerBackdrop');
        
        if (!drawer) {
            this.createPlaysDrawerHTML();
            drawer = document.getElementById('playsDrawer');
            backdrop = document.getElementById('playsDrawerBackdrop');
        }
        
        // Populate drawer content
        this.populatePlaysDrawer(actionId, taskTitle, actionItem, planData);
        
        // Show drawer
        if (drawer && backdrop) {
            backdrop.classList.add('open');
            setTimeout(() => {
                drawer.classList.add('open');
            }, 10);
        }
    }
    
    static createPlaysDrawerHTML() {
        const drawerHTML = `
            <!-- Plays Drawer Backdrop -->
            <div id="playsDrawerBackdrop" class="drawer-backdrop" onclick="ActionsRenderer.closePlaysDrawer()"></div>
            
            <!-- Plays Drawer -->
            <div id="playsDrawer" class="drawer plays-drawer">
                <div class="drawer-header">
                    <h2><i class="fas fa-play-circle"></i> Manage CS Plays</h2>
                    <button class="drawer-close-btn" onclick="ActionsRenderer.closePlaysDrawer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="drawer-body">
                    <div id="playsDrawerContent">
                        <!-- Content will be populated here -->
                    </div>
                </div>
                
                <div class="drawer-footer">
                    <button class="btn btn-secondary" onclick="ActionsRenderer.closePlaysDrawer()">Close</button>
                    <button class="btn btn-primary" onclick="ActionsRenderer.savePlayUpdates()">
                        <i class="fas fa-save"></i> Save Updates
                    </button>
                </div>
            </div>
        `;
        
        // Add to body if not exists
        if (!document.getElementById('playsDrawer')) {
            document.body.insertAdjacentHTML('beforeend', drawerHTML);
        }
    }
    
    static populatePlaysDrawer(actionId, taskTitle, actionItem, planData) {
        const container = document.getElementById('playsDrawerContent');
        if (!container) return;
        
        const plays = actionItem.plays || [];
        console.log('Populating drawer with plays:', plays);
        
        let html = `
            <div class="plays-drawer-section">
                <h3><i class="fas fa-lightbulb"></i> Action Plan Task</h3>
                <div class="action-task-card">
                    <div class="action-task-title">${taskTitle}</div>
                    <div class="action-task-meta">
                        <span class="action-id-badge">ID: ${actionId}</span>
                    </div>
                </div>
            </div>
            
            <div class="plays-drawer-section">
                <div class="subtasks-header">
                    <h3><i class="fas fa-tasks"></i> Subtasks & Plays</h3>
                    <div class="subtasks-progress">
                        <div class="progress-info">
                            <span class="completed-count">${plays.filter(p => p.status === 'complete').length}</span>
                            <span class="total-count">of ${plays.length} completed</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${plays.length > 0 ? Math.round((plays.filter(p => p.status === 'complete').length / plays.length) * 100) : 0}%"></div>
                        </div>
                        <span class="progress-percentage">${plays.length > 0 ? Math.round((plays.filter(p => p.status === 'complete').length / plays.length) * 100) : 0}%</span>
                    </div>
                </div>
                
                <div class="subtasks-list">
        `;
        
        if (plays.length === 0) {
            html += `
                <div class="no-subtasks-message">
                    <div class="empty-state">
                        <i class="fas fa-tasks empty-state-icon"></i>
                        <div class="empty-state-title">No subtasks defined</div>
                        <div class="empty-state-description">This action plan doesn't have any associated plays or subtasks yet.</div>
                    </div>
                </div>
            `;
        } else {
            plays.forEach((play, index) => {
                // Handle both string plays and enhanced object plays
                const playTitle = typeof play === 'string' ? play : (play.title || play.name || play.playTitle || play.playName || `Play ${index + 1}`);
                const playId = typeof play === 'string' ? `play_${index + 1}` : (play.id || play.playId || `play_${index + 1}`);
                const playDescription = typeof play === 'string' ? '' : (play.description || play.full_description || '');
                
                // 🎯 Enhanced task management fields
                const status = play.status || 'pending';
                const priority = play.priority || 'medium';
                const dueDate = play.dueDate || '';
                const assignee = play.assignee || play.executingRole || play.executing_role || '';
                
                // Status and priority styling
                const statusClass = status.replace('-', '');
                const priorityClass = priority.toLowerCase();
                const isCompleted = status === 'complete';
                const isOverdue = dueDate && new Date(dueDate) < new Date() && !isCompleted;
                
                // Status icon mapping
                const statusIcon = {
                    'pending': '📋',
                    'in-progress': '🔄', 
                    'complete': '✅',
                    'cancelled': '❌',
                    'on-hold': '⏸️'
                }[status] || '📋';
                
                html += `
                    <div class="subtask-card ${statusClass} ${isOverdue ? 'overdue' : ''}" 
                         data-action-id="${actionId}" 
                         data-play-id="${playId}" 
                         data-play-index="${index}">
                        
                        <div class="subtask-main">
                            <div class="subtask-status-indicator">
                                <span class="status-icon">${statusIcon}</span>
                            </div>
                            
                            <div class="subtask-content">
                                <div class="subtask-title-row">
                                    <div class="subtask-title ${isCompleted ? 'completed' : ''}" data-title="${playTitle}"></div>
                                    <div class="subtask-badges">
                                        <span class="priority-badge priority-${priorityClass}" title="${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority">
                                            ${priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'}
                                        </span>
                                        <span class="play-id-badge" title="Play ID">${playId}</span>
                                    </div>
                                </div>
                                
                                ${playDescription ? `<div class="subtask-description" data-description="${playDescription}"></div>` : ''}
                                
                                <div class="subtask-meta">
                                    ${assignee ? `
                                        <div class="subtask-assignee">
                                            <i class="fas fa-user-circle"></i>
                                            <span class="assignee-name">${assignee}</span>
                                        </div>
                                    ` : ''}
                                    
                                    ${dueDate ? `
                                        <div class="subtask-due-date ${isOverdue ? 'overdue' : ''}">
                                            <i class="fas fa-calendar-alt"></i>
                                            <span class="due-date-text">${ActionsRenderer.formatDueDate(dueDate)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="subtask-controls">
                            <div class="subtask-control-row">
                                <div class="control-group compact">
                                    <select class="subtask-status-select" 
                                            data-play-id="${playId}" 
                                            data-action-id="${actionId}"
                                            onchange="ActionsRenderer.updatePlayStatus('${actionId}', '${playId}', this.value)"
                                            title="Change Status">
                                        <option value="pending" ${status === 'pending' ? 'selected' : ''}>Pending</option>
                                        <option value="in-progress" ${status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="complete" ${status === 'complete' ? 'selected' : ''}>Complete</option>
                                        <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                        <option value="on-hold" ${status === 'on-hold' ? 'selected' : ''}>On Hold</option>
                                    </select>
                                </div>
                                
                                <div class="control-group compact">
                                    <select class="subtask-priority-select" 
                                            data-play-id="${playId}" 
                                            data-action-id="${actionId}"
                                            onchange="ActionsRenderer.updatePlayPriority('${actionId}', '${playId}', this.value)"
                                            title="Change Priority">
                                        <option value="low" ${priority === 'low' ? 'selected' : ''}>Low</option>
                                        <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Medium</option>
                                        <option value="high" ${priority === 'high' ? 'selected' : ''}>High</option>
                                    </select>
                                </div>
                                
                                <div class="control-group compact">
                                    <input type="date" 
                                           class="subtask-due-date-input" 
                                           data-play-id="${playId}" 
                                           data-action-id="${actionId}"
                                           value="${dueDate}"
                                           onchange="ActionsRenderer.updatePlayDueDate('${actionId}', '${playId}', this.value)"
                                           title="Set Due Date">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }
    
    static closePlaysDrawer() {
        const drawer = document.getElementById('playsDrawer');
        const backdrop = document.getElementById('playsDrawerBackdrop');
        
        if (drawer) {
            drawer.classList.remove('open');
        }
        
        if (backdrop) {
            setTimeout(() => {
                backdrop.classList.remove('open');
            }, 300);
        }
    }
    
    static togglePlayCompletion(actionId, playId, playIndex, isCompleted) {
        console.log(`Toggle play completion: actionId=${actionId}, playId=${playId}, index=${playIndex}, completed=${isCompleted}`);
        
        // Update the visual state immediately
        const playItem = document.querySelector(`[data-action-id="${actionId}"][data-play-index="${playIndex}"]`);
        
        if (!playItem) {
            console.warn(`Could not find play item with actionId=${actionId} and playIndex=${playIndex}`);
            // Continue with data update even if visual update fails
        } else {
            const playTitle = playItem.querySelector('.play-title');
            const statusBadge = playItem.querySelector('.status-badge');
            
            if (playTitle && statusBadge) {
                if (isCompleted) {
                    playTitle.classList.add('completed');
                    statusBadge.textContent = 'Completed';
                    statusBadge.className = 'status-badge completed';
                } else {
                    playTitle.classList.remove('completed');
                    statusBadge.textContent = 'Pending';
                    statusBadge.className = 'status-badge pending';
                }
            }
        }
        
        // Store the update for later saving
        if (!window.playUpdates) {
            window.playUpdates = new Map();
        }
        
        if (!window.playUpdates.has(actionId)) {
            window.playUpdates.set(actionId, new Map());
        }
        
        window.playUpdates.get(actionId).set(playId, {
            playIndex: playIndex,
            completed: isCompleted,
            timestamp: new Date().toISOString()
        });
        
        console.log('Stored play update:', window.playUpdates.get(actionId).get(playId));
    }
    
    static async savePlayUpdates() {
        if (!window.playUpdates || window.playUpdates.size === 0) {
            this.closePlaysDrawer();
            return;
        }
        
        console.log('Saving play updates:', window.playUpdates);
        
        try {
            // Update action plans data with play completion status
            for (let [actionId, playUpdates] of window.playUpdates) {
                await this.updateActionPlanPlayStatus(actionId, playUpdates);
            }
            
            // Clear updates and refresh the Action Plans view
            window.playUpdates.clear();
            this.closePlaysDrawer();
            
            // Refresh the Action Plans view to show updated play counts
            if (window.app && typeof window.app.renderActions === 'function') {
                window.app.renderActions();
            }
            
            // Show success message
            this.showPlayUpdateSuccess();
            
        } catch (error) {
            console.error('Error saving play updates:', error);
            this.showPlayUpdateError(error.message);
        }
    }
    
    // ========== ENHANCED PLAY TASK MANAGEMENT METHODS ==========
    
    /**
     * Update the status of a specific play
     */
    static async updatePlayStatus(actionId, playId, status) {
        try {
            console.log(`🎯 Updating play ${playId} status to: ${status}`);
            
            // Get the current action plan ID (we need the plan ID, not action ID)
            const planId = await this.findPlanIdForAction(actionId);
            if (!planId) {
                throw new Error(`Could not find plan for action: ${actionId}`);
            }
            
            // Use the new repository method
            const result = await window.SignalsRepository.updatePlayStatus(planId, playId, status);
            
            if (result.success) {
                // Update visual state immediately
                this.updatePlayVisualState(actionId, playId, 'status', status);
                
                // Show success notification
                this.showNotification('Play status updated successfully', 'success');
                
                // Refresh the action plans view
                if (window.app && typeof window.app.renderActions === 'function') {
                    window.app.renderActions();
                }
                
                console.log(`✅ Play ${playId} status updated to: ${status}`);
            } else {
                throw new Error(result.error || 'Failed to update play status');
            }
            
        } catch (error) {
            console.error('❌ Failed to update play status:', error);
            this.showNotification('Failed to update play status: ' + error.message, 'error');
        }
    }
    
    /**
     * Update the priority of a specific play
     */
    static async updatePlayPriority(actionId, playId, priority) {
        try {
            console.log(`🎯 Updating play ${playId} priority to: ${priority}`);
            
            const planId = await this.findPlanIdForAction(actionId);
            if (!planId) {
                throw new Error(`Could not find plan for action: ${actionId}`);
            }
            
            const result = await window.SignalsRepository.updatePlayPriority(planId, playId, priority);
            
            if (result.success) {
                this.updatePlayVisualState(actionId, playId, 'priority', priority);
                this.showNotification('Play priority updated successfully', 'success');
                
                if (window.app && typeof window.app.renderActions === 'function') {
                    window.app.renderActions();
                }
                
                console.log(`✅ Play ${playId} priority updated to: ${priority}`);
            } else {
                throw new Error(result.error || 'Failed to update play priority');
            }
            
        } catch (error) {
            console.error('❌ Failed to update play priority:', error);
            this.showNotification('Failed to update play priority: ' + error.message, 'error');
        }
    }
    
    /**
     * Update the due date of a specific play
     */
    static async updatePlayDueDate(actionId, playId, dueDate) {
        try {
            console.log(`🎯 Updating play ${playId} due date to: ${dueDate}`);
            
            const planId = await this.findPlanIdForAction(actionId);
            if (!planId) {
                throw new Error(`Could not find plan for action: ${actionId}`);
            }
            
            const result = await window.SignalsRepository.updatePlayDueDate(planId, playId, dueDate);
            
            if (result.success) {
                this.updatePlayVisualState(actionId, playId, 'dueDate', dueDate);
                this.showNotification('Play due date updated successfully', 'success');
                
                if (window.app && typeof window.app.renderActions === 'function') {
                    window.app.renderActions();
                }
                
                console.log(`✅ Play ${playId} due date updated to: ${dueDate}`);
            } else {
                throw new Error(result.error || 'Failed to update play due date');
            }
            
        } catch (error) {
            console.error('❌ Failed to update play due date:', error);
            this.showNotification('Failed to update play due date: ' + error.message, 'error');
        }
    }
    
    /**
     * Helper method to find plan ID for a given action ID
     */
    static async findPlanIdForAction(actionId) {
        try {
            if (window.signalsStore) {
                const state = window.signalsStore.getState();
                if (state.actionPlans) {
                    for (let [planId, plan] of state.actionPlans) {
                        if (plan.actionId === actionId) {
                            return planId;
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding plan ID for action:', error);
            return null;
        }
    }
    
    /**
     * Update visual state of a play item immediately
     */
    static updatePlayVisualState(actionId, playId, property, value) {
        try {
            const playItem = document.querySelector(`[data-action-id="${actionId}"][data-play-id="${playId}"]`);
            if (!playItem) return;
            
            if (property === 'status') {
                const statusSelect = playItem.querySelector('.play-status-select');
                const statusBadge = playItem.querySelector('.status-badge');
                const playTitle = playItem.querySelector('.play-title');
                
                if (statusSelect) statusSelect.value = value;
                if (statusBadge) {
                    statusBadge.textContent = this.getStatusDisplayText(value);
                    statusBadge.className = `status-badge ${value.replace('-', '')}`;
                }
                if (playTitle) {
                    if (value === 'complete') {
                        playTitle.classList.add('completed');
                    } else {
                        playTitle.classList.remove('completed');
                    }
                }
            } else if (property === 'priority') {
                const prioritySelect = playItem.querySelector('.play-priority-select');
                const priorityBadge = playItem.querySelector('.priority-badge');
                
                if (prioritySelect) prioritySelect.value = value;
                if (priorityBadge) {
                    priorityBadge.textContent = value.toUpperCase();
                    priorityBadge.className = `priority-badge ${value.toLowerCase()}`;
                }
            } else if (property === 'dueDate') {
                const dueDateInput = playItem.querySelector('.play-due-date-input');
                const dueDateBadge = playItem.querySelector('.due-date-badge');
                
                if (dueDateInput) dueDateInput.value = value;
                if (dueDateBadge) {
                    if (value) {
                        dueDateBadge.innerHTML = `<i class="fas fa-calendar"></i> ${this.formatDueDate(value)}`;
                        dueDateBadge.style.display = 'inline-block';
                    } else {
                        dueDateBadge.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error updating play visual state:', error);
        }
    }
    
    /**
     * Get display text for status values
     */
    static getStatusDisplayText(status) {
        const statusMap = {
            'pending': 'Pending',
            'in-progress': 'In Progress',
            'complete': 'Complete',
            'cancelled': 'Cancelled',
            'on-hold': 'On Hold'
        };
        return statusMap[status] || status;
    }
    
    /**
     * Format due date for display
     */
    static formatDueDate(dueDate) {
        if (!dueDate) return '';
        
        try {
            const date = new Date(dueDate);
            const today = new Date();
            const diffTime = date - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
                return `${Math.abs(diffDays)} day(s) overdue`;
            } else if (diffDays === 0) {
                return 'Due today';
            } else if (diffDays === 1) {
                return 'Due tomorrow';
            } else {
                return `Due in ${diffDays} day(s)`;
            }
        } catch (error) {
            return dueDate; // Fallback to raw date
        }
    }
    
    /**
     * Show notification to user
     */
    static showNotification(message, type = 'info') {
        if (window.Actions && window.Actions.showMessage) {
            window.Actions.showMessage(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    static async updateActionPlanPlayStatus(actionId, playUpdates) {
        // Find and update the action plan data
        const app = window.app;
        
        // Update in live action plans
        for (let [accountId, planData] of app.actionPlans) {
            if (planData.actionItems) {
                const actionItem = planData.actionItems.find(item => item.actionId === actionId);
                if (actionItem && actionItem.plays) {
                    for (let [playId, updateData] of playUpdates) {
                        const playIndex = updateData.playIndex;
                        if (actionItem.plays[playIndex]) {
                            actionItem.plays[playIndex].completed = updateData.completed;
                            actionItem.plays[playIndex].lastUpdated = updateData.timestamp;
                        }
                    }
                    return; // Found and updated
                }
            }
        }
        
        console.log(`Action plan for actionId ${actionId} updated with play completion status`);
    }
    
    static showPlayUpdateSuccess() {
        const message = document.createElement('div');
        message.className = 'update-notification success';
        message.innerHTML = `
            <i class="fas fa-check-circle"></i>
            Play completion status updated successfully!
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('show');
            setTimeout(() => {
                message.classList.remove('show');
                setTimeout(() => message.remove(), 300);
            }, 3000);
        }, 100);
    }
    
    static showPlayUpdateError(errorMessage) {
        const message = document.createElement('div');
        message.className = 'update-notification error';
        message.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            Error updating plays: ${errorMessage}
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('show');
            setTimeout(() => {
                message.classList.remove('show');
                setTimeout(() => message.remove(), 300);
            }, 5000);
        }, 100);
    }
    
    // Task Details Drawer Methods
    static async openTaskDetailsDrawer(taskId, actionId) {
        console.log(`Opening task details drawer for taskId: ${taskId}, actionId: ${actionId}`);
        
        try {
            // 🔧 CRITICAL FIX: Use same state object as rendering to ensure cached action plans are available
            const state = window.signalsStore.getState();
            const actionPlanData = await this.findTaskData(taskId, actionId, state); 
            if (!actionPlanData) {
                console.error('Could not find task data for:', { taskId, actionId });
                this.showTaskUpdateError('Task data not found');
                return;
            }
            
            console.log('Found action plan data:', actionPlanData);
            
            // Create or get drawer elements
            let drawer = document.getElementById('taskDetailsDrawer');
            let backdrop = document.getElementById('taskDetailsDrawerBackdrop');
            
            if (!drawer) {
                this.createTaskDetailsDrawerHTML();
                drawer = document.getElementById('taskDetailsDrawer');
                backdrop = document.getElementById('taskDetailsDrawerBackdrop');
            }
            
            // Populate drawer content
            this.populateTaskDetailsDrawer(actionPlanData);
            
            // Show drawer
            if (drawer && backdrop) {
                backdrop.classList.add('open');
                setTimeout(() => {
                    drawer.classList.add('open');
                }, 10);
            }
        } catch (error) {
            console.error('Error opening task details drawer:', error);
            this.showTaskUpdateError('Failed to open task details');
        }
    }
    
    static createTaskDetailsDrawerHTML() {
        const drawerHTML = `
            <!-- Task Details Drawer Backdrop -->
            <div id="taskDetailsDrawerBackdrop" class="drawer-backdrop" onclick="ActionsRenderer.closeTaskDetailsDrawer()"></div>
            
            <!-- Task Details Drawer -->
            <div id="taskDetailsDrawer" class="drawer task-details-drawer">
                <div class="drawer-header">
                    <h2><i class="fas fa-tasks"></i> Task Details</h2>
                    <button class="drawer-close-btn" onclick="ActionsRenderer.closeTaskDetailsDrawer()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="drawer-body">
                    <div id="taskDetailsContent">
                        <!-- Content will be populated here -->
                    </div>
                </div>
                
                <div class="drawer-footer">
                    <button class="btn btn-primary" onclick="ActionsRenderer.closeTaskDetailsDrawer()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            </div>
        `;
        
        // Add to body if not exists
        if (!document.getElementById('taskDetailsDrawer')) {
            document.body.insertAdjacentHTML('beforeend', drawerHTML);
        }
    }
    
    static async findTaskData(taskId, actionId, app) {
        // 🔧 PRODUCTION FIX: Use cached action plans from app state if available
        console.log('🔍 [FIXED] Finding task using correct plan structure:', { taskId, actionId });
        
        // First try to use cached action plans from app state  
        let formattedActionPlans = [];
        if (app.actionPlans && app.actionPlans.size > 0) {
            console.log('🎯 Using cached action plans from app state for modal');
            
            // Convert cached app.actionPlans Map to formatted structure
            for (let [planId, planData] of app.actionPlans) {
                const accountId = planData.accountId;
                const account = (app.accounts && app.accounts.get) ? app.accounts.get(accountId) : null;
                
                // Try to get account name from signalsStore if not found in app.accounts
                let modalAccountName = null;
                if (account) {
                    modalAccountName = account.name || account.account_name;
                } else if (window.signalsStore) {
                    const storeAccount = window.signalsStore.getAccount(accountId);
                    if (storeAccount) {
                        modalAccountName = storeAccount.name || storeAccount.account_name;
                    }
                }
                
                formattedActionPlans.push({
                    accountId: accountId,
                    accountName: modalAccountName || planData.accountName || `Account ${accountId}`,
                    planData: { ...planData, id: planId }
                });
            }
        } else {
            // Fallback: Try to fetch action plans (will fail in production without fallback file)
            console.log('⚠️ No cached action plans, attempting to fetch (likely to fail in production)');
            formattedActionPlans = await this.getFormattedActionPlans(app);
        }
        
        console.log('🔍 [FIXED] Using plans for modal:', formattedActionPlans.map(p => ({ 
            planDataId: p.planData?.id, 
            actionId: p.planData?.actionId, 
            accountId: p.accountId 
        })));
        
        // Find the specific task by matching the plan data structure
        for (const plan of formattedActionPlans) {
            const planDataId = plan.planData?.id;
            const planActionId = plan.planData?.actionId;
            
            if (planDataId === taskId && planActionId === actionId) {
                console.log('🔍 [FIXED] Found matching task:', plan);
                
                // Create action item structure from the plan data
                const actionItem = {
                    title: plan.planData.title || plan.planData.planTitle || 'Untitled Action',
                    actionId: plan.planData.actionId,
                    status: plan.planData.status || 'pending',
                    priority: plan.planData.priority || 'Medium',
                    dueDate: plan.planData.dueDate,
                    plays: plan.planData.plays || []
                };
                
                // Use the plan data directly
                const planData = {
                    ...plan.planData,
                    id: plan.planData.id,
                    accountId: plan.accountId,
                    assignee: plan.planData.assignee || plan.planData.createdBy || 'Current User'
                };
                
                return {
                    taskId,
                    actionId,
                    actionItem,
                    planData,
                    accountId: plan.accountId
                };
            }
        }
        
        console.error('🔍 [FIXED] Task not found in formatted plans:', { taskId, actionId });
        console.log('🔍 [FIXED] Available task/action IDs:', formattedActionPlans.map(p => ({ 
            planId: p.planData?.id, 
            actionId: p.planData?.actionId 
        })));
        return null;
    }
    
    // 🧹 CLEANED UP: Removed complex fallback functions - now using simple grid data source
    
    static populateTaskDetailsDrawer(actionPlanData) {
        const container = document.getElementById('taskDetailsContent');
        if (!container) return;
        
        console.log('Populating action plan details drawer with data:', actionPlanData);
        
        const { taskId, actionId, actionItem, planData } = actionPlanData;
        
        // Store globally for auto-save functions with canonical planId
        window.currentActionPlanData = {
            ...actionPlanData,
            planId: actionPlanData.planData.id // Canonical plan ID for auto-save
        };
        
        // Safely access plays with fallback - handle both string and object actionItem
        const plays = (typeof actionItem === 'object' && actionItem.plays) ? actionItem.plays : [];
        
        console.log('🔍 [MAPPING] Action item:', actionItem);
        console.log('🔍 [MAPPING] Plan data:', planData);
        console.log('🔍 [MAPPING] Plays found:', plays);
        
        // Use the actual action title, handle both string and object cases
        const actionTitle = typeof actionItem === 'string' ? actionItem : (actionItem.title || actionItem.name || 'Action Details');
        
        // 🔧 FIXED: Apply consistent field mapping like the table view
        const currentTitle = actionItem.title || 'No Title';
        const currentStatus = this.normalizeStatusToCanonical(actionItem.status || 'pending');
        
        // Get current plan details (description)
        const currentPlanDetails = planData.description || '';
        
        // 🔧 FIXED: Format due date consistently 
        const currentDueDate = actionItem.dueDate ? new Date(actionItem.dueDate).toISOString().split('T')[0] : '';
        const currentPriority = this.capitalizeFirstLetter(actionItem.priority || 'Medium');
        const accountId = planData.accountId || actionPlanData.accountId;
        
        console.log('🔍 [MAPPING] Extracted values (FIXED):', {
            currentTitle,
            currentStatus,
            currentPlanDetails,
            currentDueDate,
            currentPriority,
            accountId
        });
        
        let html = `
            <div class="task-details-section">
                <h3><i class="fas fa-lightbulb"></i> Recommended Action</h3>
                <div class="action-display-card">
                    <div class="action-title">${actionTitle}</div>
                    <div class="action-id">Action ID: ${actionId}</div>
                </div>
            </div>
            
            <div class="task-details-section">
                <h3><i class="fas fa-edit"></i> Task Properties</h3>
                <div class="task-properties-grid">
                    <div class="property-field">
                        <label for="taskDueDate">Due Date</label>
                        <input type="date" id="taskDueDate" class="form-input" value="${currentDueDate}" onchange="ActionsRenderer.debouncedAutoSave('dueDate', this.value)">
                    </div>
                    
                    <div class="property-field">
                        <label for="taskPriority">Priority</label>
                        <select id="taskPriority" class="form-select" onchange="ActionsRenderer.debouncedAutoSave('priority', this.value)">
                            <option value="High" ${currentPriority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Medium" ${currentPriority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="Low" ${currentPriority === 'Low' ? 'selected' : ''}>Low</option>
                        </select>
                    </div>
                    
                    <div class="property-field">
                        <label for="taskStatus">Task Status</label>
                        <select id="taskStatus" class="form-select" onchange="ActionsRenderer.debouncedAutoSave('status', this.value)">
                            <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="complete" ${currentStatus === 'complete' ? 'selected' : ''}>Complete</option>
                            <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            <option value="on_hold" ${currentStatus === 'on_hold' ? 'selected' : ''}>On Hold</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="task-details-section">
                <h3><i class="fas fa-clipboard-list"></i> Plan Details</h3>
                <div class="plan-details-field">
                    <textarea id="taskPlanDetails" 
                              class="form-textarea" 
                              placeholder="Add details about this action plan..."
                              oninput="ActionsRenderer.debouncedAutoSave('description', this.value)"
                              rows="4"></textarea>
                </div>
            </div>
            
            <div class="task-details-section">
                <h3><i class="fas fa-toolbox"></i> Toolbox Plays (${plays.length})</h3>
                <div class="plays-management">
        `;
        
        if (plays.length === 0) {
            html += `
                <div class="no-plays-message">
                    <i class="fas fa-info-circle"></i>
                    No toolbox plays are associated with this action plan.
                </div>
            `;
        } else {
            html += '<div class="plays-list">';
            plays.forEach((play, index) => {
                // Handle both string plays and object plays
                const playTitle = typeof play === 'string' ? play : (play.title || play.name || play.playTitle || play.playName || `Play ${index + 1}`);
                const playId = typeof play === 'string' ? `play_${index + 1}` : (play.id || play.playId || `play_${index + 1}`);
                const isCompleted = play.completed || false;
                
                // Extract play details - handle both string and object formats
                const playDescription = typeof play === 'object' && play.description ? play.description : 
                    (typeof play === 'string' && play.includes(' - ') ? play.split(' - ').slice(1).join(' - ') : 
                    'Non-Billed, Hours-Based Consulting Offering: This play focuses on implementing best practices and strategic approaches to drive business value.');
                
                const playOwner = typeof play === 'object' && play.owner ? play.owner : 'Adoption Consulting';
                
                // Clean title - remove description if it was concatenated
                const cleanTitle = typeof play === 'string' && play.includes(' - ') ? play.split(' - ')[0] : playTitle;
                
                // 🔒 SECURITY FIX: HTML escape function to prevent XSS
                const escapeHtml = (text) => {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };
                
                html += `
                    <div class="toolbox-play-item" data-play-id="${playId}" data-play-index="${index}">
                        <div class="play-checkbox-section">
                            <input type="checkbox" class="toolbox-play-checkbox" 
                                   ${isCompleted ? 'checked' : ''}
                                   onchange="ActionsRenderer.togglePlayCompletionCheckbox('${actionId}', '${playId}', ${index}, this.checked)">
                        </div>
                        <div class="play-content-section">
                            <div class="play-title-section">
                                <h4 class="toolbox-play-title ${isCompleted ? 'completed' : ''}">${escapeHtml(cleanTitle)}</h4>
                            </div>
                            <div class="play-description-section">
                                <p class="toolbox-play-description">${escapeHtml(playDescription)}</p>
                            </div>
                            <div class="play-owner-section">
                                <span class="play-owner-label">Play Owner: <span class="play-owner-name">${escapeHtml(playOwner)}</span></span>
                            </div>
                            <div class="play-actions-section">
                                <button class="btn btn-sm btn-danger play-delete-btn" 
                                        onclick="ActionsRenderer.deletePlay('${actionId}', '${playId}', ${index})"
                                        title="Delete play">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 🔒 SECURITY FIX: Set textarea value safely via JavaScript to prevent XSS
        const planDetailsTextarea = document.getElementById('taskPlanDetails');
        if (planDetailsTextarea) {
            planDetailsTextarea.value = currentPlanDetails;
        }
        
        // Store current task data for saving with canonical planId (CRITICAL: preserve planId)
        window.currentActionPlanData = {
            ...actionPlanData,
            planId: actionPlanData.planData.id // CRITICAL: Don't overwrite the planId!
        };
    }
    
    static convertToDateValue(dateString) {
        if (!dateString || dateString === 'Not Set') return '';
        
        // Try to parse the date string and convert to YYYY-MM-DD format
        try {
            const date = new Date(dateString + ', 2025'); // Add year for better parsing
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (error) {
            console.warn('Could not parse date:', dateString);
        }
        
        return '';
    }
    
    static closeTaskDetailsDrawer() {
        const drawer = document.getElementById('taskDetailsDrawer');
        const backdrop = document.getElementById('taskDetailsDrawerBackdrop');
        
        if (drawer) {
            drawer.classList.remove('open');
        }
        
        if (backdrop) {
            setTimeout(() => {
                backdrop.classList.remove('open');
            }, 300);
        }
        
        // Auto-refresh the current tab to reflect any status changes made in the modal
        if (window.app && window.app.renderCurrentTab) {
            // Re-render the current tab to show updated task statuses
            setTimeout(() => {
                window.app.renderCurrentTab();
            }, 350); // Small delay to ensure modal close animation completes
        }
        
        // Clear stored task data
        window.currentActionPlanData = null;
    }
    
    // Helper method to update task row display immediately
    static updateTaskRowDisplay(taskId, updates) {
        const taskRow = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!taskRow) return;
        
        try {
            if (updates.dueDate) {
                const dueDateElement = taskRow.querySelector('.due-date');
                if (dueDateElement) {
                    dueDateElement.textContent = updates.dueDate || 'Not Set';
                }
            }
            
            if (updates.priority) {
                const priorityElement = taskRow.querySelector('.priority-badge');
                if (priorityElement) {
                    priorityElement.textContent = updates.priority;
                    priorityElement.className = `priority-badge priority-${updates.priority.toLowerCase()}`;
                }
            }
            
            if (updates.assignee) {
                const assigneeElement = taskRow.querySelector('.assignee-initials');
                if (assigneeElement) {
                    assigneeElement.textContent = updates.assignee;
                }
            }
            
            if (updates.status) {
                const statusElement = taskRow.querySelector('.status-badge');
                if (statusElement) {
                    const safeStatus = StatusUtils.normalizeStatusToCanonical(updates.status) || 'pending';
                    const safeStatusDisplay = StatusUtils.getStatusDisplayLabel ? StatusUtils.getStatusDisplayLabel(safeStatus) : (updates.status || 'Pending');
                    statusElement.textContent = safeStatusDisplay;
                    statusElement.className = `status-badge ${StatusUtils.getStatusCSSClass(safeStatus)}`;
                    
                    // Update completion state
                    const isComplete = safeStatus === 'complete';
                    if (isComplete) {
                        taskRow.classList.add('action-plan-completed');
                        const checkbox = taskRow.querySelector('.task-checkbox');
                        if (checkbox) checkbox.checked = true;
                    } else {
                        taskRow.classList.remove('action-plan-completed');
                        const checkbox = taskRow.querySelector('.task-checkbox');
                        if (checkbox) checkbox.checked = false;
                    }
                }
            }
            
            if (updates.description) {
                const descriptionElement = taskRow.querySelector('.action-plan-description');
                if (descriptionElement) {
                    descriptionElement.textContent = updates.description;
                } else {
                    // If no description element exists, create one
                    const contentElement = taskRow.querySelector('.action-plan-content');
                    if (contentElement && updates.description.trim()) {
                        const newDescElement = document.createElement('div');
                        newDescElement.className = 'action-plan-description';
                        newDescElement.textContent = updates.description;
                        contentElement.appendChild(newDescElement);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating task row display:', error);
        }
    }
    
    // Auto-save functionality for task properties
    static async autoSaveTaskProperty(propertyName, value) {
        if (!window.currentActionPlanData) {
            console.error('No task data available for auto-save');
            return;
        }
        
        try {
            const { taskId, actionId, planData, accountId } = window.currentActionPlanData;
            
            console.log(`🔍 [DEBUG] Auto-saving ${propertyName}:`, value);
            console.log(`🔍 [DEBUG] Current action plan data:`, {
                taskId,
                actionId,
                planId: planData?.id,
                accountId,
                planDataKeys: Object.keys(planData || {}),
                hasActionItems: !!planData?.actionItems,
                actionItemsCount: planData?.actionItems?.length || 0
            });
            
            // Update the task row display immediately for better UX
            this.updateTaskRowDisplay(taskId, { [propertyName]: value });
            
            // Prepare update data based on property name and data structure
            let updateData = {};
            
            // Get the current action item for updates
            const actionItem = window.currentActionPlanData.actionItem;
            
            console.log(`🔍 [DEBUG] Updating property ${propertyName} with value:`, value);
            console.log(`🔍 [DEBUG] Current action item:`, actionItem);
            console.log(`🔍 [DEBUG] Current plan data structure:`, planData);
            
            switch(propertyName) {
                case 'dueDate':
                    // Update both at plan level and action item level for compatibility
                    updateData.dueDate = value;
                    if (actionItem && planData.actionItems) {
                        updateData.actionItems = planData.actionItems.map(item => 
                            item.actionId === actionItem.actionId ? { ...item, dueDate: value } : item
                        );
                    }
                    break;
                case 'priority':
                    // Update both at plan level and action item level for compatibility
                    updateData.priority = value;
                    if (actionItem && planData.actionItems) {
                        updateData.actionItems = planData.actionItems.map(item => 
                            item.actionId === actionItem.actionId ? { ...item, priority: value } : item
                        );
                    }
                    break;
                case 'status':
                    // Update both at plan level and action item level for compatibility
                    updateData.status = value;
                    if (actionItem && planData.actionItems) {
                        updateData.actionItems = planData.actionItems.map(item => 
                            item.actionId === actionItem.actionId ? { ...item, status: value } : item
                        );
                    }
                    break;
                case 'assignee':
                    // Update plan level (assignee is at planData level)
                    updateData.assignee = value;
                    break;
                case 'description':
                    // Update plan details/description at plan level
                    updateData.description = value;
                    break;
                default:
                    console.warn('Unknown property for auto-save:', propertyName);
                    return;
            }
            
            console.log(`🔍 [DEBUG] Prepared update data:`, updateData);
            
            // Call the CRUD method to save changes
            console.log(`🔍 [DEBUG] Calling updateActionPlan with:`, {
                planId: planData.id,
                updateData,
                planDataType: typeof planData.id,
                planIdExists: !!planData.id
            });
            
            // 🔧 FIX: Use canonical planId from modal context
            const planId = window.currentActionPlanData.planId;
            console.log(`🔧 [FIX] Auto-saving with canonical planId: ${planId}`);
            const result = await ActionPlansService.updateActionPlan(planId, updateData);
            
            // OPTIMISTIC UPDATES: Always update UI immediately, regardless of server response
            console.log(`✅ Auto-save initiated for ${propertyName}:`, result);
            
            // Update the current modal data immediately with the new value
            if (window.currentActionPlanData && window.currentActionPlanData.planData) {
                // Apply the update to the modal data
                Object.assign(window.currentActionPlanData.planData, updateData);
                console.log(`🔄 Updated modal data for ${propertyName}`);
            }
            
            // Update the signalsStore data as well
            const state = window.signalsStore ? window.signalsStore.getState() : null;
            if (state && state.actionPlans && planId) {
                const currentPlan = state.actionPlans.get(planId);
                if (currentPlan) {
                    Object.assign(currentPlan, updateData);
                    state.actionPlans.set(planId, currentPlan);
                    console.log(`🔄 Updated signalsStore data for ${propertyName}`);
                }
            }
            
            // 🎉 IMMEDIATE UI FEEDBACK: updateTaskRowDisplay call above handles immediate updates
            // No need for full refresh - the immediate update should be sufficient
            console.log(`🎉 [OPTIMISTIC] Immediate update applied for ${propertyName}`);
            
            // Result handling (success/warning messages are handled by the service)
            if (result && result.success) {
                console.log(`✅ Auto-save completed for ${propertyName}`);
            } else {
                console.warn(`⚠️ Auto-save had issues for ${propertyName}, but optimistic update applied`);
            }
        } catch (error) {
            console.error(`Error auto-saving ${propertyName}:`, error);
            NotificationService.showError(`Error saving ${propertyName} change`);
        }
    }
    
    // 🚀 PERFORMANCE: Debounced auto-save to prevent spam writes
    static debouncedAutoSave = (function() {
        let timeout;
        return function(propertyName, value) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                ActionsRenderer.autoSaveTaskProperty(propertyName, value);
            }, 300); // 300ms debounce
        };
    })();
    
    // 🔒 SECURITY FIX: Delegated event listeners for secure interaction
    static setupDelegatedEventListeners(container) {
        // Check if already initialized to prevent duplicates
        if (container.dataset.delegatedListenersInitialized) {
            return;
        }
        
        // Add delegated listeners
        container.addEventListener('click', this.handleDelegatedClick.bind(this));
        container.addEventListener('contextmenu', this.handleDelegatedContextMenu.bind(this));
        container.addEventListener('change', this.handleDelegatedChange.bind(this));
        
        // Mark as initialized
        container.dataset.delegatedListenersInitialized = 'true';
    }
    
    static handleDelegatedClick(event) {
        // Handle empty state tab switching
        const tabButton = event.target.closest('[data-action="switch-tab"]');
        if (tabButton) {
            const tab = tabButton.getAttribute('data-tab');
            if (tab && window.app) {
                window.app.switchTab(tab);
            }
            return;
        }
        
        // Handle group toggle clicks
        if (event.target.closest('.group-toggle')) {
            this.toggleGroup(event.target.closest('.group-toggle'));
            return;
        }
        
        // Handle checkbox column clicks (stop propagation)
        if (event.target.closest('.checkbox-col')) {
            event.stopPropagation();
            return;
        }
        
        // Handle task row clicks
        const taskRow = event.target.closest('.action-plan-row');
        if (taskRow) {
            const taskId = taskRow.getAttribute('data-task-id');
            const actionId = taskRow.getAttribute('data-action-id');
            if (taskId && actionId) {
                this.handleTaskRowClick(event, taskId, actionId);
            }
        }
    }
    
    static handleDelegatedContextMenu(event) {
        const taskRow = event.target.closest('.action-plan-row');
        if (taskRow) {
            const taskId = taskRow.getAttribute('data-task-id');
            const actionId = taskRow.getAttribute('data-action-id');
            if (taskId && actionId) {
                this.handleTaskRightClick(event, taskId, actionId);
            }
        }
    }
    
    static handleDelegatedChange(event) {
        if (event.target.classList.contains('action-plan-checkbox')) {
            const taskRow = event.target.closest('.action-plan-row');
            if (taskRow) {
                const taskId = taskRow.getAttribute('data-task-id');
                this.toggleTaskComplete(taskId, event.target.checked);
            }
        }
    }
    
    // New checkbox-based play completion toggle
    static async togglePlayCompletionCheckbox(actionId, playId, playIndex, isChecked) {
        if (!window.currentActionPlanData) {
            console.error('No task data available for play completion toggle');
            return;
        }
        
        try {
            const { taskId, actionItem, planData } = window.currentActionPlanData;
            
            // Safety check for actionItem
            if (!actionItem || !actionItem.plays) {
                console.error('No actionItem or plays available in currentActionPlanData');
                return;
            }
            
            console.log(`Toggling play completion: ${playId} -> ${isChecked} (playIndex: ${playIndex})`);
            console.log('Available plays:', actionItem.plays);
            
            // Get the plays array from the action item
            const plays = [...actionItem.plays]; // Create a copy for safety
            let playUpdated = false;
            
            // Update the specific play by index since playId is generated, not stored
            if (playIndex >= 0 && playIndex < plays.length) {
                const play = plays[playIndex];
                
                // Handle both string and object plays - normalize to consistent object format
                if (typeof play === 'string') {
                    // Convert string play to normalized object with completion status
                    plays[playIndex] = {
                        playName: play,
                        playTitle: play, // Add for compatibility
                        playId: `play_${playIndex + 1}`, // Add stable playId
                        completed: isChecked
                    };
                } else if (typeof play === 'object') {
                    // Update existing object play
                    play.completed = isChecked;
                    // Ensure it has the required fields
                    if (!play.playName && !play.playTitle) {
                        play.playName = play.playTitle || `Play ${playIndex + 1}`;
                    }
                    if (!play.playId) {
                        play.playId = `play_${playIndex + 1}`;
                    }
                } else {
                    console.error('Unexpected play format:', play);
                    return;
                }
                
                playUpdated = true;
                console.log('Updated play at index', playIndex, ':', plays[playIndex]);
            }
            
            if (!playUpdated) {
                console.error('Could not find play to update at index:', playIndex);
                return;
            }
            
            // Update the visual state immediately
            const playElement = document.querySelector(`[data-play-id="${playId}"] .toolbox-play-title`);
            if (playElement) {
                if (isChecked) {
                    playElement.classList.add('completed');
                } else {
                    playElement.classList.remove('completed');
                }
            }
            
            // Save the changes using CRUD method
            const updateData = {
                plays: plays  // Update the plays array in the plan data
            };
            
            // Find the correct plan key in app.actionPlans (may not match planData.id)
            let planKey = null;
            if (window.app && window.app.actionPlans) {
                for (let [key, plan] of window.app.actionPlans) {
                    // Check multiple possible ID matches
                    if (plan.id === planData.id || 
                        key === planData.id || 
                        plan.actionId === actionId ||
                        key === taskId) {
                        planKey = key;
                        console.log(`Found plan key: ${key} for plan ID: ${planData.id}`);
                        break;
                    }
                }
            }
            
            // Fallback: use taskId as planKey if we can't find a match
            if (!planKey) {
                planKey = taskId;
                console.log(`Using taskId as fallback plan key: ${taskId}`);
            }
            
            const result = await ActionPlansService.updateActionPlan(planKey, updateData, window.app);
            
            if (result && result.success) {
                console.log('Successfully updated play completion status');
                
                // Update local data using the correct plan key
                if (window.app && window.app.actionPlans && window.app.actionPlans.has(planKey)) {
                    const plan = window.app.actionPlans.get(planKey);
                    // Update plays in both possible locations for consistency
                    plan.plays = plays;
                    if (plan.planData) {
                        plan.planData.plays = plays;
                    }
                    window.app.actionPlans.set(planKey, plan);
                    
                    // Also update signalsStore if available
                    if (window.signalsStore) {
                        const state = window.signalsStore.getState();
                        if (state.actionPlans && state.actionPlans.has(planKey)) {
                            const storePlan = state.actionPlans.get(planKey);
                            storePlan.plays = plays;
                            if (storePlan.planData) {
                                storePlan.planData.plays = plays;
                            }
                            state.actionPlans.set(planKey, storePlan);
                        }
                    }
                    
                    // Trigger cache update events for UI consistency
                    if (window.DataCache && window.DataCache.emit) {
                        window.DataCache.emit('actionPlansChanged');
                    }
                }
                
                // Show success notification
                const statusText = isChecked ? 'completed' : 'pending';
                NotificationService.showSuccess(`Play marked as ${statusText}`);
            } else {
                console.error('Failed to update play completion:', result ? result.error : 'Unknown error');
                
                // Revert the visual state on failure
                const playElement = document.querySelector(`[data-play-id="${playId}"] .toolbox-play-title`);
                if (playElement) {
                    if (isChecked) {
                        playElement.classList.remove('completed');
                    } else {
                        playElement.classList.add('completed');
                    }
                }
                
                // Revert the checkbox state
                const checkbox = document.querySelector(`[data-play-id="${playId}"] .play-checkbox`);
                if (checkbox) {
                    checkbox.checked = !isChecked;
                }
                
                NotificationService.showError('Failed to update play status');
            }
        } catch (error) {
            console.error('Error toggling play completion:', error);
            NotificationService.showError('Error updating play status');
        }
    }
    
    static async saveTaskDetails() {
        if (!window.currentActionPlanData) {
            console.error('No task data to save');
            return;
        }
        
        try {
            // Get updated values from form
            const dueDate = document.getElementById('taskDueDate').value;
            const priority = document.getElementById('taskPriority').value;
            const assignee = document.getElementById('taskAssignee').value;
            const status = document.getElementById('taskStatus').value;
            
            console.log('Saving task details:', { dueDate, priority, assignee, status });
            
            const { taskId, actionId, actionItem, planData, accountId } = window.currentActionPlanData;
            
            // Find the action item within the plan and update it
            const updatedActionItems = planData.actionItems.map((item, index) => {
                // Handle both string and object action items
                const itemActionId = typeof item === 'object' && item.actionId ? 
                    item.actionId : 
                    null; // Only use real action IDs from CSV data
                
                if (itemActionId === actionId) {
                    // Update this action item with the new task properties
                    // Preserve existing plays from the original actionItem
                    const originalPlays = actionItem && actionItem.plays ? actionItem.plays : [];
                    
                    const updatedItem = typeof item === 'string' ? 
                        { 
                            title: item, 
                            actionId: actionId,
                            dueDate: dueDate,
                            priority: priority,
                            assignee: assignee,
                            status: status,
                            plays: originalPlays  // Preserve original plays instead of empty array
                        } : 
                        { 
                            ...item, 
                            dueDate: dueDate,
                            priority: priority,
                            assignee: assignee,
                            status: status
                        };
                    
                    console.log('Updated action item:', updatedItem);
                    return updatedItem;
                }
                return item;
            });
            
            // Prepare the update data for the action plan
            const updateData = {
                ...planData,
                actionItems: updatedActionItems,
                updatedAt: new Date().toISOString()
            };
            
            console.log('Updating action plan with CRUD method:', planData.id, updateData);
            
            // Use ActionPlansService to update the action plan
            const app = window.app || { 
                actionPlans: new Map(),
                showSuccessMessage: (msg) => this.showTaskUpdateSuccess(msg),
                showErrorMessage: (msg) => this.showTaskUpdateError(msg)
            };
            
            // Import ActionPlansService dynamically if not already available
            const ActionPlansService = window.ActionPlansService || 
                (await import('./flux/services/ActionPlansService.js')).default;
            
            // Always update the visual display and local data first
            this.updateTaskRowDisplay(taskId, { dueDate, priority, assignee, status });
            
            // Update local state immediately for better UX
            if (window.app && window.app.actionPlans && window.app.actionPlans.has(accountId)) {
                const currentPlan = window.app.actionPlans.get(accountId);
                if (currentPlan) {
                    window.app.actionPlans.set(accountId, updateData);
                }
            }
            
            // Close drawer and show success message to user
            this.closeTaskDetailsDrawer();
            this.showTaskUpdateSuccess('Task details updated successfully!');
            
            // Re-render the Action Plans tab to reflect changes
            if (window.app && window.app.renderCurrentTab) {
                window.app.renderCurrentTab();
            }
            
            // Try to save to backend - log errors but don't show them to user
            try {
                const updatedPlan = await ActionPlansService.updateActionPlan(planData.id, updateData, app);
                if (updatedPlan) {
                    console.log('Task details successfully saved to backend:', updatedPlan.id);
                } else {
                    console.warn('Backend save failed but local update succeeded');
                }
            } catch (backendError) {
                console.error('Failed to save task details to Domo endpoint (local update succeeded):', backendError);
                // Don't show error to user since local update worked
            }
            
        } catch (error) {
            console.error('Error saving task details:', error);
            this.showTaskUpdateError(error.message || 'Failed to save task details');
        }
    }
    
    
    static deletePlay(actionId, playId, playIndex) {
        if (confirm('Are you sure you want to delete this CS play?')) {
            const playItem = document.querySelector(`[data-play-id="${playId}"][data-play-index="${playIndex}"]`);
            if (playItem) {
                playItem.remove();
                console.log(`Deleted play ${playId} from action ${actionId}`);
                
                // Update plays count in main view (simplified)
                this.updatePlaysCountDisplay(actionId, -1);
            }
        }
    }
    
    static updatePlaysCountDisplay(actionId, change) {
        // Find and update the plays count in the main table
        const playsButtons = document.querySelectorAll(`[data-task-id="${actionId}"]`);
        playsButtons.forEach(button => {
            const countElement = button.querySelector('.plays-count');
            if (countElement) {
                const currentCount = parseInt(countElement.textContent) || 0;
                const newCount = Math.max(0, currentCount + change);
                countElement.textContent = newCount;
            }
        });
    }
    
    static showTaskUpdateSuccess() {
        const message = document.createElement('div');
        message.className = 'update-notification success';
        message.innerHTML = `
            <i class="fas fa-check-circle"></i>
            Task details updated successfully!
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('show');
            setTimeout(() => {
                message.classList.remove('show');
                setTimeout(() => message.remove(), 300);
            }, 3000);
        }, 100);
    }
    
    static showTaskUpdateError(errorMessage) {
        const message = document.createElement('div');
        message.className = 'update-notification error';
        message.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            Error updating task: ${errorMessage}
        `;
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('show');
            setTimeout(() => {
                message.classList.remove('show');
                setTimeout(() => message.remove(), 300);
            }, 5000);
        }, 100);
    }

    // Fallback Data Loading
    static async loadFallbackActionPlans(app) {
        try {
            const response = await fetch('/action-plans-fallback.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const fallbackData = await response.json();
            const formattedPlans = [];

            console.log(`FALLBACK LOADING: Processing ${fallbackData.length} action plan records from JSON`);

            // Process each action plan from the JSON
            for (const [index, record] of fallbackData.entries()) {
                console.log(`FALLBACK RECORD ${index + 1}:`, {
                    recordId: record.id,
                    accountId: record.content?.accountId,
                    actionId: record.content?.actionId,
                    title: record.content?.title,
                    status: record.content?.status
                });
                const planContent = record.content;
                if (!planContent) {
                    continue; // Skip plans with no content
                }
                
                // Handle new single-action-per-plan data model
                // Each record represents one action plan with one action

                // Get account information - try accountId first, then signal lookup
                let accountId = planContent.accountId;
                let signal = null;
                
                if (planContent.signalId) {
                    signal = app.data.find(s => s.id === planContent.signalId);
                    if (signal && !accountId) {
                        accountId = signal.account_id;
                    }
                }
                
                // Get account name
                let accountName = this.getAccountNameFromPlan(planContent, signal, app);
                
                // If we still don't have an account ID, try to match by account name from the existing accounts
                if (!accountId && app.accounts && app.accounts.size > 0) {
                    for (let [existingAccountId, account] of app.accounts) {
                        // Try to match account names (case insensitive partial match)
                        if (account.name && accountName && 
                            (account.name.toLowerCase().includes(accountName.toLowerCase()) ||
                             accountName.toLowerCase().includes(account.name.toLowerCase()))) {
                            accountId = existingAccountId;
                            accountName = account.name; // Use the exact account name from the app
                            console.log(`Mapped action plan to existing account: ${accountName} (${accountId})`);
                            break;
                        }
                    }
                }
                
                // If still no match, use the accountId from planContent or create fallback
                if (!accountId) {
                    accountId = planContent.accountId || `fallback-${planContent.id}`;
                    console.log(`Using account ID: ${accountId} for plan: ${planContent.title}`);
                }

                // Determine urgency and health based on available data
                const urgency = this.determineFallbackUrgency(planContent, signal);
                const accountHealth = signal ? this.getHealthFromRiskCategory(signal.at_risk_cat) : 'healthy';
                
                // Get signals count for this account
                const accountSignals = accountId && signal ? 
                                     app.data.filter(s => s.account_id === accountId) : [];

                // Create single action item from the plan content
                const singleActionItem = {
                    title: planContent.title || 'Untitled Action',
                    actionId: planContent.actionId,
                    completed: false,
                    plays: planContent.plays ? planContent.plays.map(play => ({
                        playId: `play_${Math.random().toString(36).substr(2, 9)}`,
                        playName: play,
                        playTitle: play
                    })) : [],
                    description: planContent.description || '',
                    priority: planContent.priority || 'medium',
                    dueDate: planContent.dueDate,
                    status: planContent.status || 'pending'
                };

                const formattedPlan = {
                    accountId: accountId,
                    accountName: accountName,
                    accountHealth: accountHealth,
                    signalsCount: accountSignals.length,
                    highPriorityCount: accountSignals.filter(s => s.priority === 'High').length,
                    renewalBaseline: this.getFallbackRenewalValue(signal, app),
                    status: planContent.status || 'pending',
                    urgency: urgency,
                    planData: {
                        id: planContent.id,
                        actionItems: [singleActionItem], // Convert single action to array format for compatibility
                        status: planContent.status,
                        assignee: planContent.assignee,
                        createdAt: planContent.createdAt,
                        updatedAt: planContent.updatedAt,
                        notes: planContent.description || '',
                        // Store original plan content for CRUD operations
                        originalPlanContent: planContent
                    },
                    lastUpdated: planContent.updatedAt || planContent.createdAt,
                    nextAction: planContent.title || 'No actions defined'
                };

                console.log(`FORMATTED PLAN ${index + 1}:`, {
                    accountId: formattedPlan.accountId,
                    accountName: formattedPlan.accountName,
                    actionTitle: planContent.title,
                    status: formattedPlan.status
                });

                formattedPlans.push(formattedPlan);
            }

            console.log(`BEFORE GROUPING: ${formattedPlans.length} formatted plans`);
            formattedPlans.forEach((plan, i) => {
                console.log(`  Plan ${i + 1}: Account ${plan.accountId} (${plan.accountName}) - ${plan.nextAction}`);
            });

            // Group by account and merge duplicates
            const groupedPlans = this.groupFallbackPlansByAccount(formattedPlans);
            
            console.log(`AFTER GROUPING: ${groupedPlans.length} grouped plans`);
            groupedPlans.forEach((plan, i) => {
                console.log(`  Grouped Plan ${i + 1}: Account ${plan.accountId} (${plan.accountName}) - ${plan.planData.actionItems.length} actions`);
            });
            
            return groupedPlans.sort((a, b) => {
                const urgencyOrder = { critical: 0, high: 1, normal: 2 };
                if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
                }
                return new Date(b.lastUpdated) - new Date(a.lastUpdated);
            });

        } catch (error) {
            console.error('Error loading fallback action plans:', error);
            return [];
        }
    }

    static getAccountNameFromPlan(planContent, signal, app) {
        // Try to get account name from plan title first (format: "Action Plan - Account Name")
        if (planContent.planTitle && planContent.planTitle.includes(' - ')) {
            return planContent.planTitle.split(' - ').slice(1).join(' - ').trim();
        }
        
        // Try to get from signal data
        if (signal && signal.account_name) {
            return signal.account_name;
        }
        
        // Try to get from accountId if it exists and we can find the account
        if (planContent.accountId && app.accounts && app.accounts.has(planContent.accountId)) {
            const account = app.accounts.get(planContent.accountId);
            if (account && account.name) {
                return account.name;
            }
        }
        
        // Fallback to generic name
        return `Account ${planContent.id.slice(-8)}`;
    }

    static determineFallbackUrgency(planContent, signal) {
        // Determine urgency based on available information
        if (signal && signal.priority === 'High') {
            return 'high';
        }
        
        if (planContent.priority === 'high') {
            return 'high';
        }
        
        // For single action plans, check if there are multiple plays indicating complexity
        if (planContent.plays && planContent.plays.length > 2) {
            return 'high';
        }
        
        return 'normal';
    }

    static getFallbackRenewalValue(signal, app) {
        // Try to get real renewal value from signal
        if (signal && signal.bks_renewal_baseline_usd) {
            return parseFloat(signal.bks_renewal_baseline_usd) || 0;
        }
        
        // Generate realistic fallback value
        return this.getRandomRenewalValue();
    }

    static groupFallbackPlansByAccount(formattedPlans) {
        console.log('GROUPING LOGIC: Starting to group plans by account...');
        console.log(`Input: ${formattedPlans.length} individual plans`);
        
        // In the new single-action-per-plan model, each plan represents one task
        // We should NOT merge plans - instead keep them separate but group for display
        const grouped = new Map();
        
        for (const plan of formattedPlans) {
            const key = plan.accountId;
            console.log(`  Processing plan for account: ${key} (${plan.accountName})`);
            
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            
            // Add this plan to the array for this account
            grouped.get(key).push(plan);
            console.log(`    → Added plan to account ${key}. Total plans for this account: ${grouped.get(key).length}`);
        }
        
        console.log(`GROUPING COMPLETE: ${grouped.size} unique accounts`);
        
        // Convert to array format but keep all individual plans
        const result = [];
        for (const [accountId, plans] of grouped) {
            // For each account, add all its plans to the result
            result.push(...plans);
            console.log(`Account ${accountId}: Added ${plans.length} plans to result`);
        }
        
        console.log(`Final result: ${result.length} plans total`);
        return result;
    }
}