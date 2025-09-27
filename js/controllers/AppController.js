// AppController - Main application controller for Flux architecture
class AppController {
    constructor() {
        this.currentTab = 'whitespace';
        this.isInitialized = false;
        this.controllers = new Map();
        
        console.log('🚀 Initializing AppController with Flux architecture...');
    }

    async init() {
        try {
            // Subscribe to store changes FIRST so we can respond to loading events
            this.subscribeToStore();
            
            // Initialize Flux store with data
            console.log('📡 Loading initial data through Flux actions...');
            dispatcher.dispatch(Actions.dataLoadRequested());
            
            // Load all data through SignalsRepository (which uses Flux actions)
            await SignalsRepository.loadAllData();
            
            // Initialize focused controllers
            this.initializeControllers();
            
            // Set up tab navigation and event listeners
            this.setupTabNavigation();
            this.setupEventListeners();
            
            // Render initial tab
            this.renderCurrentTab();
            
            console.log('✅ AppController initialization complete!');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize AppController:', error);
            this.hideLoading();
            this.showErrorMessage('Failed to load application. Please refresh the page.');
        }
    }
    
    initializeControllers() {
        // Create focused controllers for different app areas
        this.controllers.set('signals', new SignalsController());
        this.controllers.set('portfolio', new PortfolioController());
        this.controllers.set('feedback', new FeedbackController());
        this.controllers.set('comments', new CommentsController());
        
        console.log('🎯 Focused controllers initialized');
    }
    
    setupTabNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            const handleTabSwitch = (e) => {
                e.preventDefault();
                // Use closest to ensure we get the tab element even if clicking on child elements
                const tabElement = e.target.closest('.nav-tab');
                const tabName = tabElement?.getAttribute('data-tab');
                if (tabName) {
                    // Use action dispatch instead of direct method call
                    dispatcher.dispatch(Actions.switchTab(tabName));
                }
            };

            tab.addEventListener('click', handleTabSwitch);
            tab.addEventListener('touchend', handleTabSwitch, { passive: false });
        });
    }
    
    handleTabChanged(tabName) {
        if (this.currentTab === tabName) return;
        
        console.log(`🔄 Handling tab change from ${this.currentTab} to ${tabName}`);
        
        // Update active tab in UI
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            }
        });
        
        // Update content containers
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName)?.classList.add('active');
        
        this.currentTab = tabName;
        this.renderCurrentTab();
    }
    
    setupEventListeners() {
        // Drawer close events
        const closePlanDrawer = document.getElementById('closePlanDrawer');
        if (closePlanDrawer) {
            closePlanDrawer.addEventListener('click', () => {
                dispatcher.dispatch(Actions.closePlanDrawer());
            });
        }
        
        const closeSignalDrawer = document.getElementById('closeSignalDrawer');
        if (closeSignalDrawer) {
            closeSignalDrawer.addEventListener('click', () => {
                dispatcher.dispatch(Actions.closeSignalDrawer());
            });
        }
        
        const createPlan = document.getElementById('createPlan');
        if (createPlan) {
            createPlan.addEventListener('click', () => {
                dispatcher.dispatch(Actions.createActionPlan());
            });
        }
        
        const cancelPlan = document.getElementById('cancelPlan');
        if (cancelPlan) {
            cancelPlan.addEventListener('click', () => {
                dispatcher.dispatch(Actions.closePlanDrawer());
            });
        }
        
        // Drawer backdrop and close button handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('drawer-close') || e.target.id === 'closePlanDrawer') {
                dispatcher.dispatch(Actions.closePlanDrawer());
            }
            if (e.target.classList.contains('drawer-close') || e.target.id === 'closeSignalDrawer') {
                dispatcher.dispatch(Actions.closeSignalDrawer());
            }
            if (e.target.id === 'createPlanDrawerBackdrop') {
                dispatcher.dispatch(Actions.closePlanDrawer());
            }
        });
        
        // Confidence slider - optional element
        const confidenceSlider = document.getElementById('signalConfidence');
        if (confidenceSlider) {
            confidenceSlider.addEventListener('input', (e) => {
                const confidenceDisplay = document.querySelector('.confidence-display');
                if (confidenceDisplay) {
                    confidenceDisplay.textContent = e.target.value + '%';
                }
            });
        }
    }
    
    subscribeToStore() {
        console.log('🔌 AppController: Setting up store subscriptions');
        
        // Subscribe to store changes for app-level updates
        signalsStore.subscribe('app-controller', () => {
            this.updateSummaryStats();
        });
        
        // Subscribe to data loading states
        signalsStore.subscribe('data:loaded', () => {
            console.log('📊 AppController received data:loaded event, hiding loading spinner');
            this.hideLoading();
            this.updateSummaryStats();
            this.renderCurrentTab();
        });
        
        signalsStore.subscribe('data:load_failed', () => {
            console.log('❌ AppController received data:load_failed event, hiding loading spinner');
            this.hideLoading();
            this.showErrorMessage('Failed to load data. Please refresh the page.');
        });
        
        signalsStore.subscribe('loading:started', () => {
            console.log('⏳ AppController received loading:started event, showing spinner');
            this.showLoading();
        });
        
        // Subscribe to tab changes to update DOM
        signalsStore.subscribe('tab:changed', (state, tabName) => {
            this.handleTabChanged(tabName);
        });
        
        // Check if data is already loaded (in case we missed the event)
        const state = signalsStore.getState();
        if (!state.loading && state.signals && state.signals.length > 0) {
            console.log('📊 Data already loaded, hiding spinner immediately');
            this.hideLoading();
            this.updateSummaryStats();
            this.renderCurrentTab();
        }
    }
    
    // switchTab method removed - now using handleTabChanged via store subscription
    
    renderCurrentTab() {
        const state = signalsStore.getState();
        
        // Hide all tab contents first
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        switch (this.currentTab) {
            case 'whitespace':
                // Handle whitespace tab if WhitespaceRenderer exists
                if (typeof WhitespaceRenderer !== 'undefined') {
                    console.log('📊 Rendering Whitespace tab');
                    const state = signalsStore.getState();
                    WhitespaceRenderer.renderWhitespace(state).catch(error => {
                        console.error('🚨 ERROR rendering whitespace:', error);
                    });
                    // Show the whitespace tab after rendering
                    setTimeout(() => {
                        const whitespaceTab = document.getElementById('whitespace');
                        if (whitespaceTab) whitespaceTab.classList.add('active');
                    }, 100);
                } else {
                    console.error('🚨 CRITICAL: WhitespaceRenderer not available');
                }
                break;
            case 'signal-feed':
                const signalFeedTab = document.getElementById('signal-feed');
                if (signalFeedTab) signalFeedTab.classList.add('active');
                this.controllers.get('signals')?.render(state);
                break;
            case 'my-portfolio':
                const portfolioTab = document.getElementById('my-portfolio');
                if (portfolioTab) portfolioTab.classList.add('active');
                this.controllers.get('portfolio')?.render(state).catch(error => {
                    console.error('🚨 ERROR rendering portfolio:', error);
                });
                break;
            case 'actions':
                // Handle actions tab if ActionsRenderer exists
                if (typeof ActionsRenderer !== 'undefined') {
                    console.log('📋 Rendering Actions tab');
                    const state = signalsStore.getState();
                    ActionsRenderer.renderActions(state).catch(error => {
                        console.error('🚨 ERROR rendering actions:', error);
                    });
                    // Show the actions tab
                    const actionsTab = document.getElementById('actions');
                    if (actionsTab) actionsTab.classList.add('active');
                } else {
                    console.error('🚨 CRITICAL: ActionsRenderer not available');
                }
                break;
            default:
                console.warn(`Unknown tab: ${this.currentTab}`);
        }
    }
    
    updateSummaryStats() {
        try {
            const state = signalsStore.getState();
            
            // Update dashboard stats from store state
            // signals is an array, not a Map
            const allSignals = state.signals || [];
            const highPrioritySignals = allSignals.filter(s => s.priority === 'High');
            
            // Get unique accounts from signals
            const uniqueAccountIds = new Set(allSignals.map(s => s.account_id).filter(id => id));
            const accountsWithSignals = uniqueAccountIds.size;
            
            // Update Requires Attention count (accounts without action plans)
            const planAccountIds = new Set(
                Array.from(state.actionPlans.values())
                    .map(plan => plan.accountId)
                    .filter(accountId => accountId)
            );
            
            // Count accounts that have signals but no action plans
            const accountsWithoutPlans = Array.from(uniqueAccountIds).filter(accountId => 
                !planAccountIds.has(accountId)
            ).length;
            
            // Update DOM elements
            const updateElement = (id, value) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            };
            
            updateElement('requiresAttentionCount', accountsWithoutPlans);
            updateElement('highPriorityDashboard', highPrioritySignals.length);
            updateElement('activeAccountsCount', accountsWithSignals);
        } catch (error) {
            console.error('Error updating summary stats:', error);
        }
    }
    
    showLoading() {
        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.style.display = 'flex';
    }
    
    hideLoading() {
        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.style.display = 'none';
    }
    
    showErrorMessage(message) {
        // Use the notification service for consistent error display
        if (window.NotificationService) {
            window.NotificationService.showNotification(message, 'error');
        } else {
            console.error(message);
            alert(message); // Fallback
        }
    }
    
    showSuccessMessage(message) {
        if (window.NotificationService) {
            window.NotificationService.showNotification(message, 'success');
        } else {
            console.log(message);
        }
    }
}

// AppController is now initialized from HTML bootstrap code
// Make class globally available for debugging
window.AppController = AppController;