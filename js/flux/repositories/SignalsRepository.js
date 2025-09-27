// SignalsRepository - Handles all data operations with normalized relational model
class SignalsRepository {
    
    // Pagination configuration
    static PAGE_SIZE = 200; // Signals per page
    static currentPage = 0;
    static totalSignals = 0;
    static allRawSignals = []; // Cache all raw signals
    static isInitialLoadComplete = false;
    static signalDimensionService = null; // Cache signal dimension service
    
    /**
     * Load all application data and normalize into relational structure
     * @returns {Promise} - Promise that resolves with normalized data
     */
    static async loadAllData() {
        // Dispatch loading started action
        dispatcher.dispatch(Actions.startDataLoad());
        
        try {
            console.log('🚀 SignalsRepository: Starting data load and normalization...');
            const startTime = performance.now();
            
            // Load raw data from all sources
            const [
                rawSignalsResult,
                interactionsResult, 
                commentsResult,
                actionPlansResult,
                userInfoResult,
                signalDimensionServiceResult
            ] = await Promise.allSettled([
                this.loadRawSignals(),
                this.loadInteractions(),
                this.loadComments(),
                this.loadActionPlans(),
                this.loadUserInfo(),
                this.loadSignalDimensionService()
            ]);

            // Process raw results
            const rawSignals = this.processResult(rawSignalsResult, 'signals', []);
            const interactions = this.processResult(interactionsResult, 'interactions', []);
            const comments = this.processResult(commentsResult, 'comments', []);
            const actionPlans = this.processResult(actionPlansResult, 'action plans', []);
            console.log(`🔍 [DEBUG] Loaded ${actionPlans.length} action plans from loadActionPlans:`, actionPlans.map(p => p.id));
            const userInfo = this.processResult(userInfoResult, 'user info', { userId: 'user-1', userName: 'Current User' });
            const signalDimensionService = this.processResult(signalDimensionServiceResult, 'signal dimension service', null);
            
            // Store signal dimension service for pagination
            this.signalDimensionService = signalDimensionService;

            // Filter out signals without action_id before caching
            const signalsWithActionId = rawSignals.filter(signal => {
                const hasActionId = signal.action_id && signal.action_id.trim() !== '';
                if (!hasActionId) {
                    console.log(`⚠️ Filtering out signal without action_id during initial load: ${signal.id || signal.name || 'unknown'}`);
                }
                return hasActionId;
            });
            
            // Cache filtered signals for pagination
            this.allRawSignals = signalsWithActionId;
            this.totalSignals = signalsWithActionId.length;
            
            console.log(`📊 Initial load filtered signals: ${signalsWithActionId.length} of ${rawSignals.length} signals have action_id`);
            
            // For initial load, only process first page of signals
            const firstPageSignals = signalsWithActionId.slice(0, this.PAGE_SIZE);
            console.log(`📄 Loading first page: ${firstPageSignals.length} of ${this.totalSignals} total signals`);
            
            // NORMALIZE THE DATA INTO RELATIONAL STRUCTURE
            console.log(`🔍 [DEBUG] About to normalize ${actionPlans.length} action plans`);
            const normalizedData = this.normalizeData(firstPageSignals, interactions, comments, actionPlans, signalDimensionService);
            console.log(`🔍 [DEBUG] After normalization: ${normalizedData.actionPlans.size} action plans in store`);
            
            // Store metadata for pagination
            normalizedData.pagination = {
                currentPage: 0,
                pageSize: this.PAGE_SIZE,
                totalSignals: this.totalSignals,
                loadedSignals: firstPageSignals.length,
                hasMore: this.totalSignals > this.PAGE_SIZE
            };
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Data load and normalization completed in ${loadTime.toFixed(2)}ms`);
            
            console.log('📊 Normalized data summary:', {
                accounts: normalizedData.accounts.size,
                signals: normalizedData.signals.size,
                recommendedActions: normalizedData.recommendedActions.size,
                interactions: normalizedData.interactions.size,
                comments: normalizedData.comments.size,
                actionPlans: normalizedData.actionPlans.size,
                userInfo: userInfo.userName
            });
            
            // Add userInfo to normalized data
            normalizedData.userInfo = userInfo;
            
            // Dispatch success action with normalized data
            dispatcher.dispatch(Actions.dataLoadSuccess(normalizedData));
            
            return normalizedData;
            
        } catch (error) {
            console.error('❌ SignalsRepository: Failed to load data:', error);
            dispatcher.dispatch(Actions.dataLoadFailed(error));
            throw error;
        }
    }
    
    /**
     * Load the next page of signals
     * @returns {Promise} - Promise that resolves with the next page of normalized signals
     */
    static async loadNextPage() {
        try {
            this.currentPage++;
            const startIdx = this.currentPage * this.PAGE_SIZE;
            const endIdx = startIdx + this.PAGE_SIZE;
            
            // Check if we have more signals to load
            if (startIdx >= this.totalSignals) {
                console.log('📭 No more signals to load');
                return { hasMore: false, signals: [] };
            }
            
            // Get next page of signals
            const nextPageSignals = this.allRawSignals.slice(startIdx, endIdx);
            
            // Filter out signals without action_id
            const filteredNextPageSignals = nextPageSignals.filter(signal => {
                const hasActionId = signal.action_id && signal.action_id.trim() !== '';
                if (!hasActionId) {
                    console.log(`⚠️ Filtering out signal without action_id in pagination: ${signal.id || signal.name || 'unknown'}`);
                }
                return hasActionId;
            });
            
            console.log(`📄 Loading page ${this.currentPage + 1}: ${filteredNextPageSignals.length} signals (${startIdx}-${Math.min(endIdx, this.totalSignals)} of ${this.totalSignals})`);
            
            // Normalize just the new signals
            const normalizedSignals = new Map();
            const newAccounts = new Map();
            const newActions = new Map();
            
            // Process new signals
            filteredNextPageSignals.forEach(rawSignal => {
                // Extract account if new
                const accountId = rawSignal.account_id;
                if (accountId && !signalsStore.getAccount(accountId)) {
                    const account = this.extractAccountFromSignal(rawSignal);
                    newAccounts.set(accountId, account);
                }
                
                // Extract action if new
                const actionId = rawSignal.action_id;
                if (actionId && !signalsStore.getRecommendedAction(actionId)) {
                    const action = this.extractRecommendedActionFromSignal(rawSignal);
                    newActions.set(actionId, action);
                }
                
                // Extract normalized signal
                const signal = this.extractNormalizedSignal(rawSignal, this.signalDimensionService);
                normalizedSignals.set(signal.signal_id, signal);
            });
            
            // Dispatch action to add new page to store
            dispatcher.dispatch(Actions.dataPageLoaded({
                signals: normalizedSignals,
                accounts: newAccounts,
                recommendedActions: newActions,
                pagination: {
                    currentPage: this.currentPage,
                    pageSize: this.PAGE_SIZE,
                    totalSignals: this.totalSignals,
                    loadedSignals: Math.min(endIdx, this.totalSignals),
                    hasMore: endIdx < this.totalSignals
                }
            }));
            
            return {
                hasMore: endIdx < this.totalSignals,
                signals: Array.from(normalizedSignals.values()),
                loadedCount: Math.min(endIdx, this.totalSignals)
            };
            
        } catch (error) {
            console.error('❌ Failed to load next page:', error);
            throw error;
        }
    }
    
    /**
     * Reset pagination state
     */
    static resetPagination() {
        this.currentPage = 0;
        this.totalSignals = 0;
        this.allRawSignals = [];
        this.isInitialLoadComplete = false;
    }
    
    /**
     * Normalize raw data into relational structure
     */
    static normalizeData(rawSignals, interactions, comments, actionPlans, signalDimensionService = null) {
        console.log('🔄 Starting data normalization process...');
        
        // Note: rawSignals are already filtered for action_id in loadAllData
        const signalsWithActionId = rawSignals;
        
        // Initialize normalized stores
        const accounts = new Map();
        const signals = new Map();
        const recommendedActions = new Map();
        const normalizedInteractions = new Map();
        const normalizedComments = new Map();
        const normalizedActionPlans = new Map();
        
        // Initialize relationship indexes
        const signalsByAccount = new Map();
        const signalsByAction = new Map();
        const actionsByAccount = new Map();
        const interactionsBySignal = new Map();
        const commentsBySignal = new Map();
        const commentsByAccount = new Map();
        const plansByAccount = new Map();
        const plansByAction = new Map();
        
        // Step 1: Extract and normalize Accounts
        console.log('📦 Extracting unique accounts...');
        signalsWithActionId.forEach(rawSignal => {
            const accountId = rawSignal.account_id;
            if (!accountId) return;
            
            if (!accounts.has(accountId)) {
                const account = this.extractAccountFromSignal(rawSignal);
                accounts.set(accountId, account);
                signalsByAccount.set(accountId, new Set());
                actionsByAccount.set(accountId, new Set());
                plansByAccount.set(accountId, new Set());
                commentsByAccount.set(accountId, new Set());
            }
        });
        console.log(`✅ Extracted ${accounts.size} unique accounts`);
        
        // Step 2: Extract and normalize RecommendedActions
        console.log('📦 Extracting unique recommended actions...');
        signalsWithActionId.forEach(rawSignal => {
            const actionId = rawSignal.action_id;
            if (!actionId) return;
            
            if (!recommendedActions.has(actionId)) {
                const action = this.extractRecommendedActionFromSignal(rawSignal);
                recommendedActions.set(actionId, action);
                signalsByAction.set(actionId, new Set());
                plansByAction.set(actionId, new Set());
                
                // Track action to account relationship
                if (action.account_id && actionsByAccount.has(action.account_id)) {
                    actionsByAccount.get(action.account_id).add(actionId);
                }
            }
        });
        console.log(`✅ Extracted ${recommendedActions.size} unique recommended actions`);
        
        // Step 3: Normalize Signals (remove embedded data)
        console.log('📦 Normalizing signals...');
        signalsWithActionId.forEach(rawSignal => {
            const signal = this.extractNormalizedSignal(rawSignal, signalDimensionService);
            signals.set(signal.signal_id, signal);
            
            // Update relationship indexes
            if (signal.account_id && signalsByAccount.has(signal.account_id)) {
                signalsByAccount.get(signal.account_id).add(signal.signal_id);
            }
            if (signal.action_id && signalsByAction.has(signal.action_id)) {
                signalsByAction.get(signal.action_id).add(signal.signal_id);
            }
            
            // Initialize interaction index for this signal
            interactionsBySignal.set(signal.signal_id, new Set());
            commentsBySignal.set(signal.signal_id, new Set());
        });
        console.log(`✅ Normalized ${signals.size} signals`);
        
        // Step 4: Process Interactions
        console.log('📦 Processing interactions...');
        interactions.forEach(interaction => {
            const interactionId = interaction.id || `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            normalizedInteractions.set(interactionId, interaction);
            
            // Update index
            if (interaction.signalId && interactionsBySignal.has(interaction.signalId)) {
                interactionsBySignal.get(interaction.signalId).add(interactionId);
            }
        });
        console.log(`✅ Processed ${normalizedInteractions.size} interactions`);
        
        // Step 5: Process Comments (dual-context)
        console.log('📦 Processing comments...');
        comments.forEach(comment => {
            const commentId = comment.id || `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Ensure comment has either signalId or accountId
            if (comment.signalId) {
                if (commentsBySignal.has(comment.signalId)) {
                    commentsBySignal.get(comment.signalId).add(commentId);
                }
            } else if (comment.accountId) {
                if (commentsByAccount.has(comment.accountId)) {
                    commentsByAccount.get(comment.accountId).add(commentId);
                }
            }
            
            normalizedComments.set(commentId, comment);
        });
        console.log(`✅ Processed ${normalizedComments.size} comments`);
        
        // Step 6: Process ActionPlans
        console.log('📦 Processing action plans...');
        actionPlans.forEach(plan => {
            const planId = plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            normalizedActionPlans.set(planId, plan);
            
            // Update indexes
            if (plan.accountId && plansByAccount.has(plan.accountId)) {
                plansByAccount.get(plan.accountId).add(planId);
            }
            if (plan.actionId && plansByAction.has(plan.actionId)) {
                plansByAction.get(plan.actionId).add(planId);
            }
        });
        console.log(`✅ Processed ${normalizedActionPlans.size} action plans`);
        
        // Return normalized data structure
        return {
            // Entity stores
            accounts,
            signals,
            recommendedActions,
            interactions: normalizedInteractions,
            comments: normalizedComments,
            actionPlans: normalizedActionPlans,
            
            // Relationship indexes
            signalsByAccount,
            signalsByAction,
            actionsByAccount,
            interactionsBySignal,
            commentsBySignal,
            commentsByAccount,
            plansByAccount,
            plansByAction
        };
    }
    
    /**
     * Extract Account entity from raw signal data
     */
    static extractAccountFromSignal(rawSignal) {
        return {
            account_id: rawSignal.account_id || rawSignal['account id'],
            account_name: rawSignal.account_name,
            account_action_context: rawSignal.account_action_context || rawSignal['Account Action Context'] || '',
            account_action_context_rationale: rawSignal.account_action_context_rationale || rawSignal['Account Action Context Rationale'] || '',
            
            // Account metrics object
            account_metrics: rawSignal.account_metrics || {
                relationship: rawSignal['Relationship'] || '',
                content_creation: rawSignal['Content Creation'] || '',
                user_engagement: rawSignal['User Engagement'] || '',
                support: rawSignal['Support'] || '',
                commercial: rawSignal['Commercial'] || '',
                education: rawSignal['Education'] || '',
                platform_utilization: rawSignal['Platform Utilization'] || '',
                value_realization: rawSignal['Value Realization'] || '',
                
                relationship_value: parseFloat(rawSignal['Relationship - Value']) || 0,
                content_creation_value: parseFloat(rawSignal['Content Creation - Value']) || 0,
                user_engagement_value: parseFloat(rawSignal['User Engagement - Value']) || 0,
                support_value: parseFloat(rawSignal['Support - Value']) || 0,
                commercial_value: parseFloat(rawSignal['Commercial - Value']) || 0,
                education_value: parseFloat(rawSignal['Education - Value']) || 0,
                platform_utilization_value: parseFloat(rawSignal['Platform Utilization - Value']) || 0,
                value_realization_value: parseFloat(rawSignal['Value Realization - Value']) || 0,
                
                health_score: parseFloat(rawSignal['Health Score'] || rawSignal.health_score) || 0,
                at_risk_cat: rawSignal.at_risk_cat || '',
                account_gpa: rawSignal['Account GPA'] || rawSignal.account_gpa || '',
                account_gpa_numeric: parseFloat(rawSignal['Account GPA Numeric'] || rawSignal.account_gpa_numeric) || 0,
                prior_account_gpa_numeric: parseFloat(rawSignal['Prior Account GPA Numeric']) || 0,
                gpa_trend_180_day: rawSignal['180 Day GPA Trend '] || rawSignal['180 Day GPA Trend'] || '',
                
                industry: rawSignal['Industry (Domo)'] || '',
                customer_tenure_years: parseFloat(rawSignal['Customer Tenure (Years)']) || 0,
                type_of_next_renewal: rawSignal['Type of Next Renewal'] || '',
                data_source: rawSignal['Data Source'] || ''
            },
            
            // Usage metrics object
            usage_metrics: rawSignal.usage_metrics || {
                total_lifetime_billings: parseFloat(rawSignal['Total Lifetime Billings'] || rawSignal.total_lifetime_billings) || 0,
                daily_active_users: parseInt(rawSignal['Daily Active Users (DAU)'] || rawSignal.daily_active_users) || 0,
                weekly_active_users: parseInt(rawSignal['Weekly Active Users (WAU)'] || rawSignal.weekly_active_users) || 0,
                monthly_active_users: parseInt(rawSignal['Monthly Active Users (MAU)'] || rawSignal.monthly_active_users) || 0,
                total_data_sets: parseInt(rawSignal['Total Data Sets']) || 0,
                total_rows: parseInt(rawSignal['Total Rows']) || 0,
                dataflows: parseInt(rawSignal['Dataflows']) || 0,
                cards: parseInt(rawSignal['Cards']) || 0,
                is_consumption: rawSignal['is Consumption'] === 'TRUE' || rawSignal['is Consumption'] === 'true'
            },
            
            // Financial object
            financial: rawSignal.financial || {
                next_renewal_date: rawSignal['Next Renewal Date'] || '',
                bks_status_grouping: rawSignal.bks_status_grouping || '',
                bks_fq: rawSignal.bks_fq || '',
                rank: parseInt(rawSignal.rank) || 0,
                bks_renewal_baseline_usd: parseFloat(rawSignal.bks_renewal_baseline_usd) || 0,
                bks_forecast_new: parseFloat(rawSignal.bks_forecast_new) || 0,
                bks_forecast_delta: parseFloat(rawSignal.bks_forecast_delta) || 0,
                pacing_percentage: parseFloat(rawSignal['% Pacing']) || 0
            },
            
            // Ownership object
            ownership: rawSignal.ownership || {
                ae: rawSignal['AE'] || '',
                csm: rawSignal['CSM'] || '',
                ae_email: rawSignal['AE Email'] || '',
                csm_manager: rawSignal['CSM Manager'] || '',
                rvp: rawSignal['RVP'] || '',
                avp: rawSignal['AVP'] || '',
                level_3_leader: rawSignal['level 3 leader'] || '',
                account_owner: rawSignal['Account Owner'] || ''
            },
            
            // Top-level metrics for quick access
            at_risk_cat: rawSignal.at_risk_cat || '',
            account_gpa: rawSignal['Account GPA'] || rawSignal.account_gpa || '',
            health_score: parseFloat(rawSignal['Health Score'] || rawSignal.health_score) || 0,
            daily_active_users: parseInt(rawSignal['Daily Active Users (DAU)'] || rawSignal.daily_active_users) || 0,
            weekly_active_users: parseInt(rawSignal['Weekly Active Users (WAU)'] || rawSignal.weekly_active_users) || 0,
            monthly_active_users: parseInt(rawSignal['Monthly Active Users (MAU)'] || rawSignal.monthly_active_users) || 0,
            total_lifetime_billings: parseFloat(rawSignal['Total Lifetime Billings'] || rawSignal.total_lifetime_billings) || 0,
            bks_renewal_baseline_usd: parseFloat(rawSignal.bks_renewal_baseline_usd) || 0
        };
    }
    
    /**
     * Extract RecommendedAction entity from raw signal data
     */
    static extractRecommendedActionFromSignal(rawSignal) {
        const accountId = rawSignal.account_id || rawSignal['account id'];
        const actionId = rawSignal.action_id;
        
        // 🎯 Get signal priority for intelligent play defaults
        const signalPriority = this.normalizeSignalPriority(rawSignal.priority || 'medium');
        
        // Extract plays from signal
        const plays = [];
        if (rawSignal.plays && Array.isArray(rawSignal.plays)) {
            // 🔧 Enhance existing plays with new task management fields
            const enhancedPlays = rawSignal.plays.map(play => {
                return this.enhancePlayWithTaskManagement(play, signalPriority);
            });
            plays.push(...enhancedPlays);
        } else {
            // Build plays from individual fields with enhanced task management
            for (let i = 1; i <= 3; i++) {
                const playId = rawSignal[`play_${i}`];
                if (playId) {
                    plays.push({
                        id: playId,
                        name: rawSignal[`Play ${i} Name`] || '',
                        description: rawSignal[`Play ${i} Description`] || '',
                        full_description: rawSignal[`play_${i}_description`] || '',
                        play_type: rawSignal[`play_${i}_play_type`] || '',
                        initiating_role: rawSignal[`play_${i}_initiating_role`] || '',
                        executing_role: rawSignal[`play_${i}_executing_role`] || '',
                        doc_location: rawSignal[`play_${i}_doc_location`] || '',
                        
                        // 🎯 Enhanced task management fields with intelligent defaults
                        status: 'pending',           // Always start with pending
                        priority: signalPriority,    // Inherit from signal priority
                        dueDate: this.calculateDefaultDueDate(10), // Today + 10 days
                        assignee: rawSignal[`play_${i}_executing_role`] || null, // Use executing role as assignee
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }
        }
        
        return {
            action_id: actionId,
            account_id: accountId,
            recommended_action: rawSignal.recommended_action || '',
            signal_rationale: rawSignal.signal_rationale || '',
            // Use Call Scheduled Date as primary source, fallback to call_date
            call_date: rawSignal['Call Scheduled Date'] || rawSignal.call_date || '',
            // Add created_at field - when the recommended action was created
            // Due to CSV corruption, the timestamp ended up in the play_3 field
            created_at: rawSignal.play_3 || rawSignal.created_at || '',
            plays: plays
        };
    }
    
    /**
     * Enhance play object with new task management fields
     * Handles migration from old format to new enhanced format
     */
    static enhancePlayWithTaskManagement(play, signalPriority = 'medium', playIndex = 0) {
        // Handle string plays (legacy format)
        if (typeof play === 'string') {
            return {
                id: `PLAY-${String(playIndex + 1).padStart(2, '0')}`, // Generate sequential ID like PLAY-01, PLAY-02
                name: play,
                description: '', // Fixed: use empty string since we don't have description for string plays
                status: 'pending',
                priority: signalPriority, // 🎯 Use signal priority
                dueDate: this.calculateDefaultDueDate(10), // 🎯 Today + 10 days
                assignee: null, // Fixed: use null since we don't have executing_role for string plays
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }
        
        // Handle object plays - enhance with new fields if missing
        const enhancedPlay = {
            ...play,
            // Ensure ID is present - use existing or generate sequential
            id: play.id || `PLAY-${String(playIndex + 1).padStart(2, '0')}`,
            // Migrate old completed boolean to status
            status: play.status || (play.completed ? 'complete' : 'pending'),
            priority: play.priority || signalPriority, // Use signal priority as default
            dueDate: play.dueDate || this.calculateDefaultDueDate(10), // Today + 10 days
            assignee: play.executing_role || play.executingRole || play.assignee || null, // Handle both snake_case and camelCase
            createdAt: play.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Remove old completed field if it exists
        if (enhancedPlay.completed !== undefined) {
            delete enhancedPlay.completed;
        }
        
        return enhancedPlay;
    }
    
    /**
     * Normalize signal priority to play priority format
     */
    static normalizeSignalPriority(signalPriority) {
        const priorityMap = {
            'High': 'high',
            'high': 'high',
            'HIGH': 'high',
            'Medium': 'medium', 
            'medium': 'medium',
            'MEDIUM': 'medium',
            'Low': 'low',
            'low': 'low',
            'LOW': 'low'
        };
        return priorityMap[signalPriority] || 'medium';
    }
    
    /**
     * Calculate default due date (today + specified days)
     */
    static calculateDefaultDueDate(daysFromToday = 10) {
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(today.getDate() + daysFromToday);
        return dueDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    /**
     * Normalize signal polarity values to standard format
     * Maps legacy "Opportunity" to "Opportunities"
     */
    static normalizeSignalPolarity(polarity) {
        if (polarity === 'Opportunity') {
            return 'Opportunities';
        }
        return polarity;
    }

    /**
     * Extract normalized Signal entity (without embedded data)
     */
    static extractNormalizedSignal(rawSignal, signalDimensionService = null) {
        // Get polarity from signal dimension service if available
        let signalPolarity = 'Enrichment'; // Default fallback
        
        if (signalDimensionService) {
            const signalCode = rawSignal.name || rawSignal.code || '';
            const signalDimension = signalDimensionService.getSignalDimension(signalCode);
            if (signalDimension && signalDimension.polarity) {
                signalPolarity = signalDimension.polarity;
                console.log(`🔍 Signal ${signalCode} mapped to polarity: ${signalPolarity}`);
            } else {
                console.log(`⚠️ Signal ${signalCode} not found in signal dimensions, using fallback`);
            }
        }
        
        // Fallback to raw signal data if available
        if (!signalDimensionService || signalPolarity === 'Enrichment') {
            signalPolarity = rawSignal.signal_polarity || rawSignal['Signal Polarity'] || 'Enrichment';
            console.log(`🔍 Signal ${rawSignal.name || rawSignal.code} using fallback polarity: ${signalPolarity}`);
        }
        
        return {
            signal_id: rawSignal.id || rawSignal['Signal Id'] || `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            account_id: rawSignal.account_id || rawSignal['account id'],
            action_id: rawSignal.action_id || '',
            
            // Signal-specific fields only
            category: rawSignal.category || '',
            code: rawSignal.code || '',
            name: rawSignal.name || '',
            summary: rawSignal.summary || '',
            rationale: rawSignal.rationale || '',
            priority: rawSignal.priority || 'Medium',
            confidence: parseFloat(rawSignal.confidence) || 0,
            signal_confidence: parseFloat(rawSignal.signal_confidence) || 0,
            signal_polarity: this.normalizeSignalPolarity(signalPolarity),
            
            // AI context (signal-specific)
            ai_signal_context: rawSignal.ai_signal_context || rawSignal['AI Signal Context'] || '',
            ai_account_signal_context: rawSignal.ai_account_signal_context || rawSignal['AI Account Signal Context'] || '',
            ai_account_signal_context_rationale: rawSignal.ai_account_signal_context_rationale || rawSignal['AI Account Signal Context Rationale'] || '',
            
            // Call context (signal-specific)
            call_context: rawSignal.call_context || {
                call_id: rawSignal.call_id || '',
                // Use Call Scheduled Date as primary source, fallback to call_date
                call_date: rawSignal['Call Scheduled Date'] || rawSignal.call_date || '',
                call_url: rawSignal['Call URL'] || '',
                call_title: rawSignal['Call Title'] || '',
                call_scheduled_date: rawSignal['Call Scheduled Date'] || '',
                call_attendees: rawSignal['Call Attendees'] || '',
                call_recap: rawSignal['Call Recap'] || ''
            },
            
            created_at: rawSignal.created_at || rawSignal.created_date || new Date().toISOString(),
            
            // UI state (not from CSV)
            isViewed: false,
            feedback: null
        };
    }
    
    /**
     * Process Promise.allSettled result
     */
    static processResult(result, name, defaultValue) {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.warn(`⚠️ Failed to load ${name}:`, result.reason);
            return defaultValue;
        }
    }
    
    /**
     * Load raw signals from API or CSV
     */
    static async loadRawSignals() {
        try {
            console.log('📡 Loading signals...');
            const response = await domo.get('/data/v1/signals');
            
            if (response && response.length > 0) {
                console.log(`✅ Loaded ${response.length} signals from Domo API`);
                return response;
            } else {
                console.warn('⚠️ No signals from API, using CSV fallback');
                return await this.loadMasterCSV();
            }
        } catch (error) {
            console.error('❌ Failed to load signals from API:', error);
            console.warn('Falling back to master CSV data');
            return await this.loadMasterCSV();
        }
    }
    
    /**
     * Load master CSV fallback data
     */
    static async loadMasterCSV() {
        try {
            console.log('Loading master CSV data...');
            
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(`./data.csv${cacheBuster}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load CSV: ${response.status}`);
            }
            
            const csvText = await response.text();
            console.log('Master CSV loaded successfully, length:', csvText.length);
            
            const parsedData = this.parseCSV(csvText);
            console.log(`Parsed ${parsedData.length} records from master CSV`);
            
            return parsedData;
        } catch (error) {
            console.error('Error loading master CSV:', error);
            return [];
        }
    }
    
    /**
     * Parse CSV text into raw data
     */
    static parseCSV(csvText) {
        console.log('🔍 Parsing CSV with stateful tokenizer...');
        const startTime = performance.now();
        
        const rows = this.tokenizeCSV(csvText);
        
        if (rows.length === 0) {
            console.warn('⚠️ No rows found in CSV');
            return [];
        }
        
        const headers = rows[0];
        console.log(`📋 Parsed ${headers.length} header columns from CSV`);
        
        const data = [];
        
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            const row = {};

            // Build row object from headers and values
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                const value = values[j] || '';
                row[header] = value;
            }

            data.push(row);
        }
        
        const parseTime = performance.now() - startTime;
        console.log(`⚡ CSV parsing completed in ${parseTime.toFixed(2)}ms`);
        
        return data;
    }
    
    /**
     * Stateful CSV tokenizer
     */
    static tokenizeCSV(csvText) {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        let i = 0;
        
        console.log('🔄 Tokenizing CSV...');
        
        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentField);
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                currentRow.push(currentField);
                
                if (currentRow.some(field => field.trim() !== '')) {
                    rows.push(currentRow);
                }
                
                currentRow = [];
                currentField = '';
                
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
            } else {
                currentField += char;
            }
            
            i++;
        }
        
        if (currentField !== '' || currentRow.length > 0) {
            currentRow.push(currentField);
            if (currentRow.some(field => field.trim() !== '')) {
                rows.push(currentRow);
            }
        }
        
        console.log(`✅ Tokenized ${rows.length} rows`);
        return rows;
    }
    
    /**
     * Load interactions from API or fallback
     */
    static async loadInteractions() {
        try {
            console.log('👍 Loading interactions from Domo API...');
            const response = await domo.get('/domo/datastores/v1/collections/SignalAI.Interactions/documents');
            
            if (response && response.length > 0) {
                console.log(`✅ Loaded ${response.length} interactions from API`);
                // Extract content from wrapper if needed
                return response.map(item => item.content || item);
            } else {
                console.log('📦 Using default interactions (empty)');
                return [];
            }
        } catch (error) {
            console.error('❌ Failed to load interactions from API:', error);
            console.log('📁 Loading fallback interactions...');
            return this.loadFallbackInteractions();
        }
    }
    
    /**
     * Load fallback interactions
     */
    static loadFallbackInteractions() {
        console.log('📦 Using default interactions (empty)');
        return [];
    }
    
    /**
     * Load comments from API or fallback
     */
    static async loadComments() {
        try {
            console.log('💬 Loading comments from Domo API...');
            const response = await domo.get('/domo/datastores/v1/collections/SignalAI.Comments/documents');
            
            if (response && response.length > 0) {
                console.log(`✅ Loaded ${response.length} comments from API`);
                // Extract content from wrapper if needed
                return response.map(item => item.content || item);
            } else {
                console.log('📦 Using default comments (empty)');
                return [];
            }
        } catch (error) {
            console.error('❌ Failed to load comments from API:', error);
            console.log('📁 Loading fallback comments...');
            return this.loadFallbackComments();
        }
    }
    
    /**
     * Load fallback comments
     */
    static loadFallbackComments() {
        console.log('📦 Using default comments (empty)');
        return [];
    }
    
    /**
     * Load action plans from API or fallback
     */
    static async loadActionPlans() {
        try {
            console.log('📋 Loading action plans...');
            const response = await domo.get('/domo/datastores/v1/collections/SignalAI.ActionPlans/documents');
            
            if (response && response.length > 0) {
                console.log(`✅ Loaded ${response.length} action plans from API`);
                // Extract content from wrapper if needed
                return response.map(item => item.content || item);
            } else {
                throw new Error('No action plans from API');
            }
        } catch (error) {
            console.log('Failed to load action plans from API:', error);
            return await this.loadFallbackActionPlans();
        }
    }
    
    /**
     * Load fallback action plans
     */
    static async loadFallbackActionPlans() {
        try {
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(`./action-plans-fallback.json${cacheBuster}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load fallback action plans: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ Loaded ${data.length} action plans from fallback (error recovery)`);
            
            // Transform the fallback data to match expected format
            // Extract content from the wrapper document structure and preserve Domo document ID
            return data.map(planWrapper => {
                const plan = planWrapper.content || planWrapper; // Handle both wrapped and unwrapped formats
                const domoDocumentId = planWrapper.id; // Preserve Domo document ID from wrapper
                
                // 🎯 Enhance plays with new task management fields
                const normalizedPriority = this.normalizeSignalPriority(plan.priority || 'Medium');
                const enhancedPlays = (plan.plays || []).map((play, index) => {
                    return SignalsRepository.enhancePlayWithTaskManagement(play, normalizedPriority, index);
                });
                
                return {
                    id: plan.id,  // Use the actual plan ID from content, not wrapper document ID
                    domoDocumentId: domoDocumentId, // 🔧 FIX: Store Domo document ID for API updates
                    recordId: domoDocumentId, // Legacy compatibility
                    accountId: plan.accountId,
                    actionId: plan.actionId,
                    title: plan.title,
                    status: plan.status || 'pending',
                    createdAt: plan.createdAt || new Date().toISOString(),
                    updatedAt: plan.updatedAt || new Date().toISOString(),
                    planTitle: plan.planTitle || `Action Plan - ${plan.accountId}`,
                    description: plan.description || '',
                    plays: enhancedPlays,  // Use enhanced plays with task management fields
                    priority: plan.priority || 'medium',
                    dueDate: plan.dueDate,
                    actionItems: plan.actionItems || [],
                    assignee: plan.assignee,
                    createdBy: plan.createdBy,
                    createdByUserId: plan.createdByUserId,
                    lastUpdatedBy: plan.lastUpdatedBy,
                    lastUpdatedByUserId: plan.lastUpdatedByUserId
                };
            });
        } catch (error) {
            console.error('Failed to load fallback action plans:', error);
            return [];
        }
    }
    
    /**
     * Load user info from API or fallback
     */
    static async loadUserInfo() {
        try {
            console.log('👤 Loading user info from Domo API...');
            const response = await domo.env;
            
            if (response && response.userId) {
                console.log('✅ Loaded user info from Domo environment');
                return {
                    userId: response.userId,
                    userName: response.userName || 'Current User'
                };
            } else {
                throw new Error('No user info from Domo environment');
            }
        } catch (error) {
            console.error('❌ Failed to load user info from API:', error);
            console.log('📁 Loading fallback user info...');
            return this.loadFallbackUserInfo();
        }
    }
    
    /**
     * Load fallback user info
     */
    static loadFallbackUserInfo() {
        console.log('📦 Using default user info');
        return {
            userId: 'user-1',
            userName: 'Current User'
        };
    }
    
    /**
     * Load signal dimension service
     */
    static async loadSignalDimensionService() {
        try {
            console.log('📊 Loading signal dimension service...');
            const signalDimensionService = new SignalDimensionService();
            await signalDimensionService.loadSignalDimensions();
            console.log('✅ Loaded signal dimension service');
            return signalDimensionService;
        } catch (error) {
            console.error('❌ Failed to load signal dimension service:', error);
            return null;
        }
    }
    
    // ========== ACTION PLAN CRUD OPERATIONS ==========
    
    /**
     * Save a new action plan
     */
    static async saveActionPlan(planData) {
        try {
            console.log('💾 Saving action plan:', planData);
            
            // Try to save to Domo API
            try {
                const response = await domo.post('/domo/datastores/v1/collections/SignalAI.ActionPlans/documents', {
                    content: planData
                });
                
                if (response && response.id) {
                    console.log('✅ Action plan saved to Domo API');
                    // Store both internal ID and Domo document ID for proper updates
                    const planWithDomoId = { 
                        ...planData, 
                        domoDocumentId: response.id,  // Domo-generated document ID for API calls
                        recordId: response.id         // Legacy compatibility
                    };
                    return { success: true, data: planWithDomoId };
                }
            } catch (apiError) {
                console.warn('⚠️ Failed to save to Domo API, using local storage:', apiError);
            }
            
            // Fallback: Store locally and return success for optimistic update
            const storageKey = 'signalai_action_plans';
            const existingPlans = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingPlans.push(planData);
            localStorage.setItem(storageKey, JSON.stringify(existingPlans));
            
            console.log('✅ Action plan saved to local storage (fallback)');
            return { success: true, data: planData };
            
        } catch (error) {
            console.error('❌ Failed to save action plan:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update an existing action plan
     */
    static async updateActionPlan(planId, updates) {
        try {
            console.log('📝 Updating action plan:', planId, updates);
            
            // 🔧 FIX: Use fresh lookup approach (proven working pattern)
            // Step 1: Get existing plan data to merge with updates
            let existingPlan = null;
            if (window.signalsStore) {
                const state = window.signalsStore.getState();
                if (state.actionPlans && state.actionPlans.has(planId)) {
                    existingPlan = state.actionPlans.get(planId);
                }
            }
            
            if (!existingPlan) {
                throw new Error(`Plan ${planId} not found in store`);
            }
            
            // Step 2: Create merged plan with updates
            const mergedPlan = {
                ...existingPlan,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            // Step 3: Fresh lookup to find correct Domo document ID
            let documentId = null;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount < maxRetries) {
                try {
                    console.log(`🔍 Fresh lookup attempt ${retryCount + 1} for plan: ${planId}`);
                    
                    // Get all documents from Domo API
                    const response = await domo.get('/domo/datastores/v1/collections/SignalAI.ActionPlans/documents');
                    const documents = response || [];
                    
                    // Find the document containing our action plan
                    const docToUpdate = documents.find(doc => doc.content && doc.content.id === planId);
                    
                    if (!docToUpdate) {
                        throw new Error(`Action plan document not found in AppDB for plan: ${planId}`);
                    }
                    
                    documentId = docToUpdate.id;
                    console.log(`🔧 Found Domo document ID: ${documentId} for plan: ${planId}`);
                    
                    // Step 4: Update with correct document ID and full plan
                    const updateResponse = await domo.put(`/domo/datastores/v1/collections/SignalAI.ActionPlans/documents/${documentId}`, {
                        content: mergedPlan
                    });
                    
                    if (updateResponse) {
                        console.log(`✅ Action plan updated in Domo API using document ID: ${documentId}`);
                        return { success: true, data: updateResponse };
                    }
                    
                    break; // Success, exit retry loop
                    
                } catch (apiError) {
                    console.warn(`⚠️ Attempt ${retryCount + 1} failed:`, apiError);
                    retryCount++;
                    
                    if (retryCount >= maxRetries) {
                        console.error(`❌ All ${maxRetries} attempts failed for plan: ${planId}`);
                        throw apiError;
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Fallback: Update in local storage
            const storageKey = 'signalai_action_plans';
            const existingPlans = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const planIndex = existingPlans.findIndex(p => p.id === planId);
            
            if (planIndex !== -1) {
                existingPlans[planIndex] = { ...existingPlans[planIndex], ...updates };
                localStorage.setItem(storageKey, JSON.stringify(existingPlans));
                console.log('✅ Action plan updated in local storage (fallback)');
                return { success: true, data: existingPlans[planIndex] };
            }
            
            return { success: false, error: 'Plan not found' };
            
        } catch (error) {
            console.error('❌ Failed to update action plan:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Delete an action plan
     */
    static async deleteActionPlan(planId) {
        try {
            console.log('🗑️ Deleting action plan:', planId);
            
            // 🔧 FIX: Use fresh lookup approach to find correct Domo document ID
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount < maxRetries) {
                try {
                    console.log(`🔍 Fresh lookup attempt ${retryCount + 1} for deletion of plan: ${planId}`);
                    
                    // Get all documents from Domo API
                    const response = await domo.get('/domo/datastores/v1/collections/SignalAI.ActionPlans/documents');
                    const documents = response || [];
                    
                    // Find the document containing our action plan
                    const docToDelete = documents.find(doc => doc.content && doc.content.id === planId);
                    
                    if (!docToDelete) {
                        throw new Error(`Action plan document not found in AppDB for plan: ${planId}`);
                    }
                    
                    const documentId = docToDelete.id;
                    console.log(`🔧 Found Domo document ID for deletion: ${documentId} for plan: ${planId}`);
                    
                    // Delete using correct document ID
                    await domo.delete(`/domo/datastores/v1/collections/SignalAI.ActionPlans/documents/${documentId}`);
                    console.log(`✅ Action plan deleted from Domo API using document ID: ${documentId}`);
                    return { success: true };
                    
                } catch (apiError) {
                    console.warn(`⚠️ Delete attempt ${retryCount + 1} failed:`, apiError);
                    retryCount++;
                    
                    if (retryCount >= maxRetries) {
                        console.error(`❌ All ${maxRetries} delete attempts failed for plan: ${planId}`);
                        break; // Fall through to local storage fallback
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Fallback: Delete from local storage
            const storageKey = 'signalai_action_plans';
            const existingPlans = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const filteredPlans = existingPlans.filter(p => p.id !== planId);
            
            if (filteredPlans.length < existingPlans.length) {
                localStorage.setItem(storageKey, JSON.stringify(filteredPlans));
                console.log('✅ Action plan deleted from local storage (fallback)');
                return { success: true };
            }
            
            return { success: false, error: 'Plan not found' };
            
        } catch (error) {
            console.error('❌ Failed to delete action plan:', error);
            return { success: false, error: error.message };
        }
    }
    
    // ========== PLAY-LEVEL CRUD OPERATIONS ==========
    
    /**
     * Update a specific property of a play within an action plan
     */
    static async updatePlayProperty(planId, playId, property, value) {
        try {
            console.log(`🎯 Updating play ${playId} property ${property}:`, value);
            
            // Get the current action plan
            let existingPlan = null;
            if (window.signalsStore) {
                const state = window.signalsStore.getState();
                if (state.actionPlans && state.actionPlans.has(planId)) {
                    existingPlan = state.actionPlans.get(planId);
                }
            }
            
            if (!existingPlan) {
                throw new Error(`Plan ${planId} not found in store`);
            }
            
            // Find and update the specific play
            const updatedPlays = existingPlan.plays.map(play => {
                if (play.id === playId) {
                    return {
                        ...play,
                        [property]: value,
                        updatedAt: new Date().toISOString()
                    };
                }
                return play;
            });
            
            // Update the entire action plan with the modified plays
            const updates = {
                plays: updatedPlays,
                updatedAt: new Date().toISOString()
            };
            
            return await this.updateActionPlan(planId, updates);
            
        } catch (error) {
            console.error('❌ Failed to update play property:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Update the status of a specific play
     */
    static async updatePlayStatus(planId, playId, status) {
        return await this.updatePlayProperty(planId, playId, 'status', status);
    }
    
    /**
     * Update the priority of a specific play
     */
    static async updatePlayPriority(planId, playId, priority) {
        return await this.updatePlayProperty(planId, playId, 'priority', priority);
    }
    
    /**
     * Update the due date of a specific play
     */
    static async updatePlayDueDate(planId, playId, dueDate) {
        return await this.updatePlayProperty(planId, playId, 'dueDate', dueDate);
    }
    
    /**
     * Get enhanced play analytics for an action plan
     */
    static getPlayAnalytics(planId) {
        try {
            let existingPlan = null;
            if (window.signalsStore) {
                const state = window.signalsStore.getState();
                if (state.actionPlans && state.actionPlans.has(planId)) {
                    existingPlan = state.actionPlans.get(planId);
                }
            }
            
            if (!existingPlan || !existingPlan.plays) {
                return { total: 0, completed: 0, inProgress: 0, pending: 0, cancelled: 0, onHold: 0 };
            }
            
            const analytics = existingPlan.plays.reduce((acc, play) => {
                acc.total++;
                switch (play.status) {
                    case 'complete':
                        acc.completed++;
                        break;
                    case 'in-progress':
                        acc.inProgress++;
                        break;
                    case 'pending':
                        acc.pending++;
                        break;
                    case 'cancelled':
                        acc.cancelled++;
                        break;
                    case 'on-hold':
                        acc.onHold++;
                        break;
                }
                return acc;
            }, { total: 0, completed: 0, inProgress: 0, pending: 0, cancelled: 0, onHold: 0 });
            
            analytics.completionPercentage = analytics.total > 0 ? Math.round((analytics.completed / analytics.total) * 100) : 0;
            
            return analytics;
            
        } catch (error) {
            console.error('❌ Failed to get play analytics:', error);
            return { total: 0, completed: 0, inProgress: 0, pending: 0, cancelled: 0, onHold: 0, completionPercentage: 0 };
        }
    }
    
    /**
     * Save interaction (like/not accurate feedback)
     */
    static async saveInteraction(interactionData) {
        try {
            console.log('💾 Saving interaction:', interactionData);
            
            // Try to save to Domo API
            try {
                const response = await domo.post('/domo/datastores/v1/collections/SignalAI.Interactions/documents', {
                    content: interactionData
                });
                
                if (response && response.id) {
                    console.log('✅ Interaction saved to Domo API');
                    return { success: true, data: { ...interactionData, recordId: response.id } };
                }
            } catch (apiError) {
                console.warn('⚠️ Failed to save to Domo API, using local storage:', apiError);
            }
            
            // Fallback: Store locally
            const storageKey = 'signalai_interactions';
            const existingInteractions = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingInteractions.push(interactionData);
            localStorage.setItem(storageKey, JSON.stringify(existingInteractions));
            
            console.log('✅ Interaction saved to local storage (fallback)');
            return { success: true, data: interactionData };
            
        } catch (error) {
            console.error('❌ Failed to save interaction:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save feedback interaction (alias for saveInteraction used by FeedbackService)
     */
    static async saveFeedbackInteraction(signalId, interactionType, userId) {
        const interactionData = {
            id: `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            signalId: signalId,
            interactionType: interactionType,
            userId: userId || 'user-1',
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        return this.saveInteraction(interactionData);
    }
    
    /**
     * Remove feedback interaction
     */
    static async removeFeedbackInteraction(signalId, userId) {
        try {
            console.log('🗑️ Removing interaction for signal:', signalId, 'user:', userId);
            
            // Try to remove from Domo API
            try {
                // First, get the interaction to find its recordId
                const interactions = await this.getInteractions();
                const interaction = interactions.find(i => 
                    i.signalId === signalId && i.userId === userId && 
                    (i.interactionType === 'like' || i.interactionType === 'not-accurate')
                );
                
                if (interaction && interaction.recordId) {
                    await domo.delete(`/domo/datastores/v1/collections/SignalAI.Interactions/documents/${interaction.recordId}`);
                    console.log('✅ Interaction removed from Domo API');
                    return { success: true };
                }
            } catch (apiError) {
                console.warn('⚠️ Failed to remove from Domo API, using local storage:', apiError);
            }
            
            // Fallback: Remove from local storage
            const storageKey = 'signalai_interactions';
            const existingInteractions = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const filteredInteractions = existingInteractions.filter(i => 
                !(i.signalId === signalId && i.userId === userId && 
                  (i.interactionType === 'like' || i.interactionType === 'not-accurate'))
            );
            localStorage.setItem(storageKey, JSON.stringify(filteredInteractions));
            console.log('✅ Interaction removed from local storage');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to remove interaction:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save comment
     */
    static async saveComment(commentData) {
        try {
            console.log('💾 Saving comment:', commentData);
            
            // Try to save to Domo API
            try {
                const response = await domo.post('/domo/datastores/v1/collections/SignalAI.Comments/documents', {
                    content: commentData
                });
                
                if (response && response.id) {
                    console.log('✅ Comment saved to Domo API');
                    return { success: true, data: { ...commentData, recordId: response.id } };
                }
            } catch (apiError) {
                console.warn('⚠️ Failed to save to Domo API, using local storage:', apiError);
            }
            
            // Fallback: Store locally
            const storageKey = 'signalai_comments';
            const existingComments = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingComments.push(commentData);
            localStorage.setItem(storageKey, JSON.stringify(existingComments));
            
            console.log('✅ Comment saved to local storage (fallback)');
            return { success: true, data: commentData };
            
        } catch (error) {
            console.error('❌ Failed to save comment:', error);
            return { success: false, error: error.message };
        }
    }
}

// Make it globally available
window.SignalsRepository = SignalsRepository;