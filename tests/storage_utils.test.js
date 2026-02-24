import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateAndMergeConfig } from '../utils/storage-utils.ts';

describe('Storage Utils - validateAndMergeConfig', () => {
    const defaultConfig = {
        name: 'Default',
        value: 10,
        enabled: true,
        nested: {
            a: 1,
            b: 's'
        }
    };

    it('should return defaultConfig if partialConfig is not an object', () => {
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, null), defaultConfig);
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, undefined), defaultConfig);
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, 123), defaultConfig);
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, 'string'), defaultConfig);
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, []), defaultConfig);
    });

    it('should merge valid partial config', () => {
        const partial = { name: 'New Name', value: 20 };
        const expected = {
            name: 'New Name',
            value: 20,
            enabled: true,
            nested: {
                a: 1,
                b: 's'
            }
        };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), expected);
    });

    it('should ignore unknown keys', () => {
        const partial = { unknown: 'key', name: 'New Name' };
        const expected = {
            name: 'New Name',
            value: 10,
            enabled: true,
            nested: {
                a: 1,
                b: 's'
            }
        };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), expected);
    });

    it('should ignore keys with wrong types', () => {
        const partial = { name: 123, value: '20', enabled: 'true' };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), defaultConfig);
    });

    it('should recursively merge nested objects', () => {
        const partial = { nested: { a: 2 } };
        const expected = {
            name: 'Default',
            value: 10,
            enabled: true,
            nested: {
                a: 2,
                b: 's'
            }
        };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), expected);
    });

    it('should ignore wrong types in nested objects', () => {
        const partial = { nested: { a: '2', c: 3 } };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), defaultConfig);
    });

    it('should handle partial nested objects', () => {
        const partial = { nested: { b: 'new' } };
        const expected = {
            name: 'Default',
            value: 10,
            enabled: true,
            nested: {
                a: 1,
                b: 'new'
            }
        };
        assert.deepStrictEqual(validateAndMergeConfig(defaultConfig, partial), expected);
    });
});
