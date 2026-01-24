import { run } from 'vitest';

async function runTests() {
    console.log('Running tests...');
    
    const result = await run({
        config: 'vitest.config.ts',
        run: true,
        files: 'tests/minimal.test.ts'
    });
    
    console.log('Test results:', result);
}

runTests().catch(err => {
    console.error('Error running tests:', err);
    process.exit(1);
});
