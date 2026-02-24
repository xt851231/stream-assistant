/**
 * Safely parses a JSON string. Returns null if parsing fails.
 */
export function safeJsonParse(json: string | null): any {
    if (!json) return null;
    try {
        return JSON.parse(json);
    } catch (e) {
        console.error("Failed to parse JSON", e);
        return null;
    }
}

/**
 * Validates that the input is a non-null object.
 */
export function isObject(item: any): item is Record<string, any> {
    return !!(item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Merges a partial configuration object into a default configuration,
 * ensuring only existing keys are updated and basic types match.
 */
export function validateAndMergeConfig<T extends object>(defaultConfig: T, partialConfig: any): T {
    if (!isObject(partialConfig)) {
        return { ...defaultConfig };
    }

    const result = { ...defaultConfig } as any;

    for (const key of Object.keys(result)) {
        if (Object.prototype.hasOwnProperty.call(partialConfig, key)) {
            const value = partialConfig[key];
            const defaultValue = result[key];

            // Basic type validation: ensure the type matches the default value's type
            // Note: typeof null is 'object', but we check value !== null.
            if (value !== null && typeof value === typeof defaultValue) {
                // Special case for nested objects (e.g. ThemeConfig.opacity)
                if (isObject(defaultValue) && isObject(value)) {
                    result[key] = validateAndMergeConfig(defaultValue, value);
                } else {
                    result[key] = value;
                }
            }
        }
    }

    return result as T;
}
