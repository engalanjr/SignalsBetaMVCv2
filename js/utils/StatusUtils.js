/**
 * Centralized status normalization utilities for SignalsAI
 * Handles all status variants (spaces, hyphens, underscores, capitalization)
 */

class StatusUtils {
    // ⚡ Canonical status normalization - handles ALL variants
    static normalizeStatusToCanonical(status) {
        if (!status) return 'pending';
        
        const normalized = status.toString().toLowerCase().trim();
        
        // Map all possible status variants to canonical forms
        const statusMap = {
            'pending': 'pending',
            'in progress': 'in_progress', 
            'in_progress': 'in_progress',
            'in-progress': 'in_progress',
            'active': 'in_progress',
            'complete': 'complete',
            'completed': 'complete',
            'done': 'complete',
            'cancelled': 'cancelled',
            'canceled': 'cancelled',
            'on hold': 'on_hold',
            'on_hold': 'on_hold',
            'on-hold': 'on_hold',
            'paused': 'on_hold'
        };
        
        return statusMap[normalized] || 'pending';
    }

    // Convert canonical status to human-readable display label
    static getStatusDisplayLabel(canonicalStatus) {
        const displayMap = {
            'pending': 'Pending',
            'in_progress': 'In Progress',
            'complete': 'Complete', 
            'cancelled': 'Cancelled',
            'on_hold': 'On Hold'
        };
        
        return displayMap[canonicalStatus] || 'Pending';
    }

    // Convert canonical status to CSS class (for badges)
    static getStatusCSSClass(canonicalStatus) {
        // Convert underscores to hyphens for CSS classes
        return `status-${canonicalStatus.replace('_', '-')}`;
    }

    // Get all canonical status values (for validation/filtering)
    static getCanonicalStatuses() {
        return ['pending', 'in_progress', 'complete', 'cancelled', 'on_hold'];
    }

    // Validate if a status is canonical
    static isCanonicalStatus(status) {
        return this.getCanonicalStatuses().includes(status);
    }
}

// Export for use across the application
window.StatusUtils = StatusUtils;