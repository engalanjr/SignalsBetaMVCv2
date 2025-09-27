// Store - Base class for Flux stores with optimistic updates and rollback capability
class Store {
    
    constructor(storeId) {
        this.storeId = storeId;
        this.state = {};
        this.listeners = new Map();
        this.snapshots = new Map(); // For optimistic rollback
        this.isInitialized = false;
        
        // Register with dispatcher
        dispatcher.register(storeId, this.dispatch.bind(this));
        
        console.log(`🏪 Store ${storeId} initialized`);
    }
    
    /**
     * Get current state
     * @returns {Object} - Current store state
     */
    getState() {
        return this.state;
    }
    
    /**
     * Set initial state
     * @param {Object} initialState - Initial state object
     */
    setInitialState(initialState) {
        this.state = { ...initialState };
        this.isInitialized = true;
        this.emitChange();
    }
    
    /**
     * Update state with new data
     * @param {Object} newState - State updates to apply
     */
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.emitChange();
    }
    
    /**
     * Main dispatch method - routes actions to reducers
     * @param {Object} action - Action to handle
     */
    dispatch(action) {
        // Override in subclasses to handle specific actions
        console.log(`Store ${this.storeId} received action: ${action.type}`);
    }
    
    /**
     * Subscribe to store changes
     * @param {string} eventType - Type of change to listen for
     * @param {Function} callback - Function to call when change occurs
     * @returns {Function} - Unsubscribe function
     */
    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        
        this.listeners.get(eventType).add(callback);
        
        // Return unsubscribe function
        return () => {
            const eventListeners = this.listeners.get(eventType);
            if (eventListeners) {
                eventListeners.delete(callback);
                if (eventListeners.size === 0) {
                    this.listeners.delete(eventType);
                }
            }
        };
    }
    
    /**
     * Emit change event to all listeners
     * @param {string} eventType - Type of change that occurred
     * @param {Object} data - Optional data to pass to listeners
     */
    emitChange(eventType = 'change', data = null) {
        const eventListeners = this.listeners.get(eventType);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(this.state, data);
                } catch (error) {
                    console.error(`Error in ${eventType} listener:`, error);
                }
            });
        }
        
        // Always emit generic 'change' event as well
        if (eventType !== 'change') {
            const changeListeners = this.listeners.get('change');
            if (changeListeners) {
                changeListeners.forEach(callback => {
                    try {
                        callback(this.state, { eventType, data });
                    } catch (error) {
                        console.error('Error in change listener:', error);
                    }
                });
            }
        }
    }
    
    /**
     * Create snapshot for optimistic updates
     * @param {string} operationId - Unique ID for this operation
     */
    createSnapshot(operationId) {
        this.snapshots.set(operationId, this.deepCloneState(this.state));
        console.log(`📸 Created snapshot for operation: ${operationId}`);
    }
    
    /**
     * Deep clone state that preserves Map and Set objects
     * @param {any} obj - Object to clone
     * @returns {any} - Deep cloned object
     */
    deepCloneState(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Map) {
            const clonedMap = new Map();
            for (let [key, value] of obj) {
                clonedMap.set(key, this.deepCloneState(value));
            }
            return clonedMap;
        }
        
        if (obj instanceof Set) {
            const clonedSet = new Set();
            for (let value of obj) {
                clonedSet.add(this.deepCloneState(value));
            }
            return clonedSet;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepCloneState(item));
        }
        
        // Handle regular objects
        const clonedObj = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepCloneState(obj[key]);
            }
        }
        return clonedObj;
    }
    
    /**
     * Commit optimistic changes (remove snapshot)
     * @param {string} operationId - Operation ID to commit
     */
    commitSnapshot(operationId) {
        if (this.snapshots.has(operationId)) {
            this.snapshots.delete(operationId);
            console.log(`✅ Committed operation: ${operationId}`);
        }
    }
    
    /**
     * Rollback to snapshot (restore previous state)
     * @param {string} operationId - Operation ID to rollback
     */
    rollback(operationId) {
        const snapshot = this.snapshots.get(operationId);
        if (snapshot) {
            this.state = snapshot;
            this.snapshots.delete(operationId);
            this.emitChange('rollback', { operationId });
            console.log(`🔄 Rolled back operation: ${operationId}`);
        } else {
            console.warn(`No snapshot found for operation: ${operationId}`);
        }
    }
    
    /**
     * Get all active snapshots (for debugging)
     * @returns {Array} - Array of snapshot operation IDs
     */
    getActiveSnapshots() {
        return Array.from(this.snapshots.keys());
    }
    
    /**
     * Clear all snapshots
     */
    clearSnapshots() {
        this.snapshots.clear();
        console.log(`🧹 Cleared all snapshots for store: ${this.storeId}`);
    }
    
    /**
     * Destroy store and cleanup
     */
    destroy() {
        // Clear all listeners
        this.listeners.clear();
        
        // Clear all snapshots
        this.clearSnapshots();
        
        // Unregister from dispatcher
        dispatcher.unregister(this.storeId);
        
        console.log(`💥 Destroyed store: ${this.storeId}`);
    }
}

// Utility function to create selectors (memoized getters)
class Selector {
    constructor(selector, dependencies = []) {
        this.selector = selector;
        this.dependencies = dependencies;
        this.cache = new Map();
    }
    
    get(state) {
        // Simple memoization based on state reference
        const stateKey = JSON.stringify(this.dependencies.map(dep => dep(state)));
        
        if (this.cache.has(stateKey)) {
            return this.cache.get(stateKey);
        }
        
        const result = this.selector(state);
        this.cache.set(stateKey, result);
        
        // Keep cache size manageable
        if (this.cache.size > 10) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        return result;
    }
    
    clearCache() {
        this.cache.clear();
    }
}

// Helper function to create selectors
function createSelector(selector, dependencies = []) {
    return new Selector(selector, dependencies);
}

// Make Store and createSelector globally available
window.Store = Store;
window.createSelector = createSelector;