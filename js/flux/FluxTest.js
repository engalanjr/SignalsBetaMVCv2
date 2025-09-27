// FluxTest - Simple test to verify Flux infrastructure is working
class FluxTest {
    
    static runBasicTests() {
        console.log('🧪 Starting Flux infrastructure tests...');
        
        try {
            // Test 1: Verify globals are available
            console.log('Test 1: Checking global availability...');
            if (typeof dispatcher === 'undefined') {
                throw new Error('Dispatcher not available globally');
            }
            if (typeof Actions === 'undefined') {
                throw new Error('Actions not available globally');
            }
            if (typeof signalsStore === 'undefined') {
                throw new Error('SignalsStore not available globally');
            }
            console.log('✅ Test 1 passed: All globals available');
            
            // Test 2: Test action creation
            console.log('Test 2: Testing action creators...');
            const testAction = Actions.showMessage('Test message', 'info');
            if (!testAction || !testAction.type || !testAction.payload) {
                throw new Error('Action creator failed');
            }
            console.log('✅ Test 2 passed: Action creators working');
            
            // Test 3: Test store subscription
            console.log('Test 3: Testing store subscriptions...');
            let subscriptionCalled = false;
            const unsubscribe = signalsStore.subscribe('test', () => {
                subscriptionCalled = true;
            });
            signalsStore.emitChange('test');
            if (!subscriptionCalled) {
                throw new Error('Store subscription failed');
            }
            unsubscribe();
            console.log('✅ Test 3 passed: Store subscriptions working');
            
            // Test 4: Test basic dispatch
            console.log('Test 4: Testing action dispatch...');
            dispatcher.dispatch(Actions.showMessage('Test dispatch', 'info'));
            console.log('✅ Test 4 passed: Action dispatch working');
            
            // Test 5: Verify store state structure
            console.log('Test 5: Testing store state structure...');
            const state = signalsStore.getState();
            if (!state || typeof state !== 'object') {
                throw new Error('Store state is invalid');
            }
            if (!state.signals || !state.comments || !state.interactions) {
                throw new Error('Store state missing required properties');
            }
            console.log('✅ Test 5 passed: Store state structure correct');
            
            console.log('🎉 All Flux infrastructure tests passed!');
            return true;
            
        } catch (error) {
            console.error('❌ Flux test failed:', error.message);
            return false;
        }
    }
    
    static verifyServices() {
        console.log('🧪 Verifying Flux services...');
        
        try {
            // Check service availability
            if (typeof FeedbackService === 'undefined') {
                throw new Error('FeedbackService not available');
            }
            if (typeof CommentsService === 'undefined') {
                throw new Error('CommentsService not available');
            }
            if (typeof ActionPlansService === 'undefined') {
                throw new Error('ActionPlansService not available');
            }
            if (typeof SignalsRepository === 'undefined') {
                throw new Error('SignalsRepository not available');
            }
            
            console.log('✅ All Flux services available');
            return true;
            
        } catch (error) {
            console.error('❌ Service verification failed:', error.message);
            return false;
        }
    }
}

// Make globally available for testing
window.FluxTest = FluxTest;

// Auto-run tests when loaded (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Run tests after a short delay to ensure all scripts are loaded
    setTimeout(() => {
        FluxTest.runBasicTests();
        FluxTest.verifyServices();
    }, 1000);
}