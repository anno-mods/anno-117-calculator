
// Type conversion utilities
// Add this to src/type-utils.ts

/**
 * Safely converts a value to a number
 * @param value - The value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns The converted number or default value
 */
export function safeToNumber(value: any, defaultValue: number = 0): number {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
}

/**
 * Safely converts a value to a boolean
 * @param value - The value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns The converted boolean or default value
 */
export function safeToBoolean(value: any, defaultValue: boolean = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    return defaultValue;
}

/**
 * Safely converts a GUID to a number
 * @param guid - The GUID to convert
 * @returns The converted number or 0
 */
export function guidToNumber(guid: any): number {
    if (typeof guid === 'number') {
        return guid;
    }
    if (typeof guid === 'string') {
        const parsed = parseInt(guid, 10);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

/**
 * Safely accesses object properties
 * @param obj - The object to access
 * @param path - The property path (e.g., 'property.subProperty')
 * @param defaultValue - Default value if property doesn't exist
 * @returns The property value or default value
 */
export function safeGet(obj: any, path: string, defaultValue: any = undefined): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
        if (current == null || typeof current !== 'object') {
            return defaultValue;
        }
        current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
}

/**
 * Safely calls a method on an object
 * @param obj - The object to call the method on
 * @param methodName - The name of the method
 * @param args - Arguments to pass to the method
 * @returns The method result or undefined
 */
export function safeCall(obj: any, methodName: string, ...args: any[]): any {
    if (obj && typeof obj[methodName] === 'function') {
        return obj[methodName](...args);
    }
    return undefined;
}
