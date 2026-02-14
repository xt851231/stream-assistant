
import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateNextProactiveTime } from '../lib/utils/scheduler-utils.ts'; // Will create this

describe('Proactive Audio Scheduler', () => {
    it('should calculate next time within jitter range (+/- 20%)', () => {
        const interval = 10000; // 10 seconds
        const jitterPercent = 0.2;
        const now = Date.now();

        // We handle the Date.now() inside or pass it? 
        // Better to pass it or mock it, but for simplicity let's assume the function adds to Date.now()
        // OR returns the delay. Let's make it return the *delay* for easier testing.

        // Wait, the logic in Context was: `nextTime = Date.now() + baseInterval + jitter`
        // Let's refactor to `calculateNextDelay(interval)`.

        for (let i = 0; i < 100; i++) {
            // Mocking Date.now isn't needed if we test the calculated *delay* or check the range relative to now.
            const nextTime = calculateNextProactiveTime(interval);
            const delta = nextTime - now;

            const minDelay = interval * (1 - jitterPercent);
            const maxDelay = interval * (1 + jitterPercent);

            // Allow small execution time buffer (e.g. 10ms)
            assert.ok(delta >= minDelay - 50, `Value ${delta} is too small (min ${minDelay})`);
            assert.ok(delta <= maxDelay + 50, `Value ${delta} is too large (max ${maxDelay})`);
        }
    });

    it('should handle different intervals', () => {
        const interval = 5000;
        const now = Date.now();
        const nextTime = calculateNextProactiveTime(interval);
        const delta = nextTime - now;

        assert.ok(delta >= 4000); // 5000 * 0.8
        assert.ok(delta <= 6000); // 5000 * 1.2
    });
});
