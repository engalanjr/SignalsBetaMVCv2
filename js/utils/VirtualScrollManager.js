// VirtualScrollManager - Handles efficient rendering of large lists with virtual scrolling
class VirtualScrollManager {
    constructor(options = {}) {
        this.container = null;
        this.viewport = null;
        this.scrollContainer = null;
        this.items = [];
        this.visibleItems = [];
        
        // Configuration
        this.itemHeight = options.itemHeight || 200; // Estimated height per signal card
        this.bufferSize = options.bufferSize || 5; // Extra items to render outside viewport
        this.pageSize = options.pageSize || 50; // Items per page for rendering
        this.renderCallback = options.renderCallback || (() => {});
        this.loadMoreCallback = options.loadMoreCallback || (() => {});
        
        // State
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.isLoading = false;
        this.hasMore = true;
        
        // Performance optimization
        this.scrollDebounceTimer = null;
        this.renderFrame = null;
        this.lastRenderTime = 0;
        this.isRendering = false; // Prevent concurrent renders
        this.lastScrollTop = 0; // Track scroll position changes
    }
    
    /**
     * Initialize virtual scrolling on a container
     */
    initialize(containerId, items = []) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('VirtualScrollManager: Container not found:', containerId);
            return;
        }
        
        // Create structure for virtual scrolling
        this.setupDOM();
        
        // Set initial items
        this.setItems(items);
        
        // Attach scroll listener
        this.attachScrollListener();
        
        // Initial render
        this.updateVisibleItems();
        
        console.log(`📜 Virtual scrolling initialized with ${items.length} items`);
    }
    
    /**
     * Setup DOM structure for virtual scrolling
     */
    setupDOM() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create viewport (visible area)
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-viewport';
        this.viewport.style.cssText = `
            position: relative;
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
        `;
        
        // Create scroll container (maintains scroll height)
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroll-container';
        this.scrollContainer.style.cssText = `
            position: relative;
            width: 100%;
        `;
        
        // Create content container (holds visible items)
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'virtual-content';
        this.contentContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;
        
        // Loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'loading-indicator';
        this.loadingIndicator.style.cssText = `
            display: none;
            text-align: center;
            padding: 20px;
            color: #666;
        `;
        this.loadingIndicator.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i> Loading more signals...
        `;
        
        // Assemble DOM
        this.scrollContainer.appendChild(this.contentContainer);
        this.scrollContainer.appendChild(this.loadingIndicator);
        this.viewport.appendChild(this.scrollContainer);
        this.container.appendChild(this.viewport);
    }
    
    /**
     * Update items list and re-render
     */
    setItems(items, append = false) {
        // 🔧 PERFORMANCE FIX: Store current scroll position to prevent jumping
        const currentScrollTop = this.viewport.scrollTop;
        const currentScrollPercentage = this.getScrollProgress();
        
        if (append) {
            this.items = [...this.items, ...items];
        } else {
            this.items = items;
        }
        
        // Update total height based on all items
        this.totalHeight = this.items.length * this.itemHeight;
        this.scrollContainer.style.height = `${this.totalHeight}px`;
        
        // 🔧 PERFORMANCE FIX: Maintain scroll position to prevent jumping
        if (append && currentScrollPercentage > 0) {
            // Maintain relative scroll position when appending items
            const newScrollTop = (this.totalHeight - this.containerHeight) * (currentScrollPercentage / 100);
            this.viewport.scrollTop = Math.min(newScrollTop, this.totalHeight - this.containerHeight);
        }
        
        // Update visible items
        this.updateVisibleItems();
    }
    
    /**
     * Attach scroll event listener with debouncing
     */
    attachScrollListener() {
        this.viewport.addEventListener('scroll', (e) => {
            this.scrollTop = e.target.scrollTop;
            
            // Debounce scroll updates for performance - increased timeout
            if (this.scrollDebounceTimer) {
                clearTimeout(this.scrollDebounceTimer);
            }
            
            this.scrollDebounceTimer = setTimeout(() => {
                this.handleScroll();
            }, 50); // Increased from 10ms to 50ms for better performance
        }, { passive: true }); // Use passive listener for better performance
    }
    
    /**
     * Handle scroll event
     */
    handleScroll() {
        // 🔧 PERFORMANCE FIX: Only update if scroll position actually changed significantly
        const scrollDelta = Math.abs(this.scrollTop - this.lastScrollTop);
        if (scrollDelta < 5) { // Only update if scrolled at least 5px
            return;
        }
        
        this.lastScrollTop = this.scrollTop;
        
        // Update visible items
        this.updateVisibleItems();
        
        // Check if we need to load more data (infinite scroll)
        this.checkLoadMore();
    }
    
    /**
     * Calculate and render visible items
     */
    updateVisibleItems() {
        // 🔧 PERFORMANCE FIX: Prevent concurrent renders
        if (this.isRendering) {
            return;
        }
        
        // Cancel previous render frame if pending
        if (this.renderFrame) {
            cancelAnimationFrame(this.renderFrame);
        }
        
        this.renderFrame = requestAnimationFrame(() => {
            const now = performance.now();
            
            // Skip if rendered recently (within 16ms)
            if (now - this.lastRenderTime < 16) {
                return;
            }
            
            this.containerHeight = this.viewport.clientHeight;
            
            // Calculate visible range with buffer
            const newStartIndex = Math.max(0, 
                Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize
            );
            
            const newEndIndex = Math.min(this.items.length - 1,
                Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.bufferSize
            );
            
            // 🔧 CRITICAL FIX: Only re-render if the visible range has actually changed
            if (newStartIndex !== this.startIndex || newEndIndex !== this.endIndex) {
                this.isRendering = true;
                
                this.startIndex = newStartIndex;
                this.endIndex = newEndIndex;
                
                // Get visible items
                this.visibleItems = this.items.slice(this.startIndex, this.endIndex + 1);
                
                // Render visible items
                this.render();
                
                this.lastRenderTime = now;
                this.isRendering = false;
            }
        });
    }
    
    /**
     * Render visible items to DOM
     */
    render() {
        // Calculate offset for visible items
        const offsetY = this.startIndex * this.itemHeight;
        
        // Position content container
        this.contentContainer.style.transform = `translateY(${offsetY}px)`;
        
        // Clear and render visible items
        this.contentContainer.innerHTML = '';
        
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        this.visibleItems.forEach((item, index) => {
            const element = this.renderCallback(item, this.startIndex + index);
            if (element) {
                // Create wrapper div for consistent height
                const wrapper = document.createElement('div');
                wrapper.className = 'virtual-item';
                wrapper.style.minHeight = `${this.itemHeight}px`;
                wrapper.innerHTML = element;
                fragment.appendChild(wrapper);
            }
        });
        
        this.contentContainer.appendChild(fragment);
        
        // Log performance metrics (reduced frequency to prevent spam)
        if (this.visibleItems.length > 0 && Math.random() < 0.1) { // Only log 10% of renders
            console.log(`🎯 Rendering ${this.visibleItems.length} of ${this.items.length} items (indices ${this.startIndex}-${this.endIndex})`);
        }
    }
    
    /**
     * Check if we need to load more data (infinite scroll)
     */
    checkLoadMore() {
        // Skip if already loading or no more data
        if (this.isLoading || !this.hasMore) {
            return;
        }
        
        // Check if scrolled near bottom (within 500px)
        const scrollBottom = this.scrollTop + this.containerHeight;
        const threshold = this.totalHeight - 500;
        
        if (scrollBottom >= threshold && this.endIndex >= this.items.length - 10) {
            this.loadMore();
        }
    }
    
    /**
     * Load more data
     */
    async loadMore() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.loadingIndicator.style.display = 'block';
        
        console.log('📥 Loading more signals...');
        
        try {
            // Call the load more callback
            const hasMore = await this.loadMoreCallback();
            this.hasMore = hasMore;
            
            if (!hasMore) {
                console.log('✅ All signals loaded');
            }
        } catch (error) {
            console.error('❌ Error loading more signals:', error);
        } finally {
            this.isLoading = false;
            this.loadingIndicator.style.display = 'none';
        }
    }
    
    /**
     * Scroll to a specific item
     */
    scrollToItem(index) {
        const targetScroll = index * this.itemHeight;
        this.viewport.scrollTop = targetScroll;
    }
    
    /**
     * Get current scroll percentage
     */
    getScrollProgress() {
        if (this.totalHeight === 0) return 0;
        return (this.scrollTop / (this.totalHeight - this.containerHeight)) * 100;
    }
    
    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.scrollDebounceTimer) {
            clearTimeout(this.scrollDebounceTimer);
        }
        if (this.renderFrame) {
            cancelAnimationFrame(this.renderFrame);
        }
        
        this.container.innerHTML = '';
        this.items = [];
        this.visibleItems = [];
        
        console.log('🧹 Virtual scroll manager destroyed');
    }
    
    /**
     * Update estimated item height based on actual rendered items
     * This improves scroll accuracy over time
     */
    updateItemHeight() {
        const items = this.contentContainer.querySelectorAll('.virtual-item');
        if (items.length > 0) {
            let totalHeight = 0;
            items.forEach(item => {
                totalHeight += item.offsetHeight;
            });
            
            const avgHeight = Math.round(totalHeight / items.length);
            
            // Only update if significantly different (>10% change)
            if (Math.abs(avgHeight - this.itemHeight) > this.itemHeight * 0.1) {
                console.log(`📏 Updating item height from ${this.itemHeight}px to ${avgHeight}px`);
                this.itemHeight = avgHeight;
                
                // Recalculate total height
                this.totalHeight = this.items.length * this.itemHeight;
                this.scrollContainer.style.height = `${this.totalHeight}px`;
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScrollManager;
}