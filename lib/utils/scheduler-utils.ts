export const calculateNextProactiveTime = (interval) => {
    // Add random jitter +/- 20%
    const jitter = interval * 0.2 * (Math.random() * 2 - 1);
    const nextTime = Date.now() + interval + jitter;
    return nextTime;
};
