const { Vitest } = require('vitest');

async function runTest() {
    const vitest = new Vitest({
        run: true,
        config: 'vitest.config.ts',
        files: 'tests/type-safety.test.ts'
    });

    const result = await vitest.start();
    console.log('Test result:', result);
}

runTest().catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
});