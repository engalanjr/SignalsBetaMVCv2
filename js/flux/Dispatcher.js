// Dispatcher - Central hub for routing actions to stores
class Dispatcher {
    
    constructor() {
        this.stores = new Map();
        this.isDispatching = false;
        this.dispatchQueue = [];
        this.actionHistory = [];
        this.maxHistorySize = 100; // For debugging
    }
    
    /**
     * Register a store to receive actions
     * @param {string} storeId - Unique identifier for the store
     * @param {Function} storeHandler - Function that handles actions (store.dispatch method)
     */
    register(storeId, storeHandler) {
        if (this.stores.has(storeId)) {
            console.warn(`Store ${storeId} is already registered`);
            return;
        }
        
        this.stores.set(storeId, storeHandler);
        console.log(`✅ Registered store: ${storeId}`);
    }
    
    /**
     * Unregister a store
     * @param {string} storeId - Store identifier to unregister
     */
    unregister(storeId) {
        if (this.stores.has(storeId)) {
            this.stores.delete(storeId);
            console.log(`❌ Unregistered store: ${storeId}`);
        }
    }
    
    /**
     * Dispatch an action to all registered stores
     * @param {Object} action - The action object to dispatch
     */
    dispatch(action) {
        // Validate action format
        if (!this.isValidAction(action)) {
            console.error('Invalid action format:', action);
            return;
        }
        
        // Prevent nested dispatching (common Flux rule)
        if (this.isDispatching) {
            this.dispatchQueue.push(action);
            return;
        }
        
        this.isDispatching = true;
        
        try {
            // Add to history for debugging
            this.addToHistory(action);
            
            // Log action for debugging
            console.log(`🎯 Dispatching action: ${action.type}`, action.payload || '');
            
            // Send action to all registered stores
            this.stores.forEach((storeHandler, storeId) => {
                try {
                    storeHandler(action);
                } catch (error) {
                    console.error(`Error in store ${storeId} handling action ${action.type}:`, error);
                }
            });
            
        } catch (error) {
            console.error('Error during dispatch:', error);
        } finally {
            this.isDispatching = false;
            
            // Process any queued actions
            if (this.dispatchQueue.length > 0) {
                const nextAction = this.dispatchQueue.shift();
                // Use setTimeout to break the call stack
                setTimeout(() => this.dispatch(nextAction), 0);
            }
        }
    }
    
    /**
     * Validate that an action has the required structure
     * @param {Object} action - Action to validate
     * @returns {boolean} - Whether the action is valid
     */
    isValidAction(action) {
        return action && 
               typeof action === 'object' && 
               typeof action.type === 'string' && 
               action.type.length > 0;
    }
    
    /**
     * Add action to history for debugging
     * @param {Object} action - Action to add to history
     */
    addToHistory(action) {
        this.actionHistory.push({
            ...action,
            dispatchedAt: new Date().toISOString()
        });
        
        // Keep history size manageable
        if (this.actionHistory.length > this.maxHistorySize) {
            this.actionHistory.shift();
        }
    }
    
    /**
     * Get action history for debugging
     * @returns {Array} - Array of dispatched actions
     */
    getActionHistory() {
        return [...this.actionHistory];
    }
    
    /**
     * Clear action history
     */
    clearActionHistory() {
        this.actionHistory = [];
    }
    
    /**
     * Get list of registered stores
     * @returns {Array} - Array of store IDs
     */
    getRegisteredStores() {
        return Array.from(this.stores.keys());
    }
    
    /**
     * Check if currently dispatching
     * @returns {boolean} - Whether dispatch is in progress
     */
    isCurrentlyDispatching() {
        return this.isDispatching;
    }
}

// Create singleton instance
const dispatcher = new Dispatcher();

// Make available globally
window.Dispatcher = Dispatcher;
window.dispatcher = dispatcher;