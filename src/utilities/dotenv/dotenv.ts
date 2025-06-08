/**
 * Loading priority:
 * 1. .env file
 * 2. environment variables
 * 3. defaults
 * 
 */

import * as fs from 'fs';

// memoize .env file
let envVars: Record<string, string> | undefined = undefined;
let path: string | undefined = undefined;

export function load(variableName: string, defaultValue?: string): string {
    if(!envVars) {
        throw new Error('Programming Error: dotenv not initialized. Call initialize() first, preferably in a main.ts file.');
    }
    if(envVars[variableName]) return envVars[variableName];
    if(process.env[variableName]) return process.env[variableName];
    if(defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing environment variable: ${variableName}`);
}


export function initialize(envPath: string = '.env', throwIfMissing: boolean = false, throwIfAlreadyInitialized: boolean = true) {
    if(envVars && throwIfAlreadyInitialized) {
        throw new Error('Programming Error: dotenv already initialized');
    }
    path = envPath;
    envVars = loadEnvFileIfExists(envPath, throwIfMissing);
}

export function reload(envPath: string | undefined = path, throwIfMissing: boolean = false) {
    if(!envPath) {
        throw new Error('Programming Error: dotenv not initialized. Call initialize() first, preferably in a main.ts file.');
    }
    envVars = loadEnvFileIfExists(envPath, throwIfMissing);
}

function loadEnvFileIfExists(envPath: string = '.env', throwIfMissing: boolean = false): Record<string, string> {
    const envVars: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        // if file is empty, return empty object
        envContent.split('\n').forEach((line) => {
            // starts with # is a comment
            if(line.startsWith('#')) return;
            // if empty, return
            if(!line.trim()) return;
            // if doesn't contain =, throw
            if(!line.includes('=')) {
                throw new Error(`Configuration Error: .env file contains invalid line: ${line}`);
            }
            const [key, value] = line.split('=');
            envVars[key.trim()] = value.trim();
        });
    }
    else if (throwIfMissing) {
        throw new Error(`Configuration Error: .env file not found at ${envPath}`);
    }
    return envVars;
}

export function __clear() {
    envVars = undefined;
    path = undefined;
}