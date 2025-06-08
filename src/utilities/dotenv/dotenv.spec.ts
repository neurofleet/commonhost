// run this file with
// bash: (out of src1)
// npm run build && node --enable-source-maps ts-js-out/utilities/dotenv/dotenv.spec.js
// old ps: (out of src1)
// npm run build; node --enable-source-maps ts-js-out/utilities/dotenv/dotenv.spec.js

import { __clear, initialize, load, reload } from './dotenv.js';
import { assert } from '../testutilities/assert.js';
import { it } from '../testutilities/it.js';
import { describe, } from '../testutilities/describe.js';
import * as path from 'path';
import * as fs from 'fs';


const TEST_DOTENV_FILE = path.resolve('.env.test');
const TEST_EMPTY_DOTENV_FILE = path.resolve('.env.test.empty');
const TEST_ENV_VAR_NAME = 'TEST_DOTENV_VAR';

// before: create a .env.test file with a TEST_DOTENV_VAR=TEST_DOTENV_VALUE entry
fs.writeFileSync(TEST_DOTENV_FILE, `# This is a comment\n# This is another comment\n\n${TEST_ENV_VAR_NAME}=TEST_DOTENV_VALUE`);
fs.writeFileSync(TEST_EMPTY_DOTENV_FILE, '');
// before: add a test env var to your environment
process.env[TEST_ENV_VAR_NAME] = 'TEST_ENV_VALUE';

describe('dotenv', () => {
    it('should be able to load a variable from the .env file', () => {
        initialize(TEST_DOTENV_FILE);
        const value = load(TEST_ENV_VAR_NAME);
        assert(value === 'TEST_DOTENV_VALUE', 'should have loaded the value from the .env file');
        __clear();
    });

    it('should be able to load a variable from the environment', () => {
        initialize(TEST_EMPTY_DOTENV_FILE);
        const value = load(TEST_ENV_VAR_NAME);
        assert(value === 'TEST_ENV_VALUE', 'should have loaded the value from the .env file');
        __clear();
    });

    it('should be able to load a variable with a default value', () => {
        initialize(TEST_DOTENV_FILE);
        const value = load('TEST_DOTENV_VAR_2', 'TEST_DEFAULT_VALUE');
        assert(value === 'TEST_DEFAULT_VALUE', 'should have loaded the default value');
        __clear();
    });

    it('should throw an error if the .env file is missing and throwIfMissing is true', () => {
        try {
            initialize('nonexistent.env', true);
            assert(false, 'should have thrown an error');
        } catch (e) {
            assert(true, 'should have thrown an error');
        } finally {
            __clear();
        }
    });

    it('should not throw an error if the .env file is missing and throwIfMissing is false', () => {
        initialize('nonexistent.env', false);
        assert(true, 'should not have thrown an error');
        __clear();
    });

    it('should throw an error if already initialized and throwIfAlreadyInitialized is true', () => {
        initialize(TEST_DOTENV_FILE);
        try {
            initialize(TEST_DOTENV_FILE, false, true);
            assert(false, 'should have thrown an error');
        } catch (e) {
            assert(true, 'should have thrown an error');
        }
        __clear();
    });

    it('should not throw an error if already initialized and throwIfAlreadyInitialized is false', () => {
        initialize(TEST_DOTENV_FILE);
        initialize(TEST_DOTENV_FILE, false, false);
        assert(true, 'should not have thrown an error');
        __clear();
    });

    it('should be able to reload the .env file', () => {
        initialize(TEST_DOTENV_FILE);
        const value = load(TEST_ENV_VAR_NAME);
        assert(value === 'TEST_DOTENV_VALUE', 'should have loaded the value from the .env file');
        fs.writeFileSync(TEST_DOTENV_FILE, `${TEST_ENV_VAR_NAME}=TEST_DOTENV_VALUE_2`);
        reload();
        const value2 = load(TEST_ENV_VAR_NAME);
        assert(value2 === 'TEST_DOTENV_VALUE_2', 'should have reloaded the value from the .env file');
        __clear();
    });

});


// after: 
fs.unlinkSync(TEST_DOTENV_FILE);
fs.unlinkSync(TEST_EMPTY_DOTENV_FILE);
delete process.env[TEST_ENV_VAR_NAME];








