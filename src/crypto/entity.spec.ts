// run this file with
// bash: (out of src1)
// npm run build && node ts-js-out/cryptography/entity.spec.js
// old ps: (out of src1)
// npm run build; node ts-js-out/cryptography/entity.spec.js

import { CryptographicEntity } from './entity.js';
import { assert } from '../utilities/testutilities/assert.js';
import { it } from '../utilities/testutilities/it.js';
import { describe, } from '../utilities/testutilities/describe.js';
import * as path from "path";

const keypath = path.resolve("cryptography/entity.spec.testkeys");


describe('CryptographicEntity', () => {
    it('should be able to sign and verify a string', async () => {
        const entityA = new CryptographicEntity(keypath + "/entitySignA");
        const entityB = new CryptographicEntity(keypath + "/entitySignB");
        const data = "hello world";
        const signature = await entityA.signString(data);
        const entityASignaturePublicKey = await entityA.getSignaturePublicKeyB64();
        const entityASignaturePublicKeyObject = CryptographicEntity.importRemoteSignaturePublicKey(entityASignaturePublicKey);
        const result = await entityB.verifyString(data, signature, entityASignaturePublicKeyObject);
        assert(result === data, 'should have verified the signature');
    });

    it('should not be able to verify a string with a wrong signature', async () => {
        const entityA = new CryptographicEntity(keypath + "/entitySignA");
        const entityB = new CryptographicEntity(keypath + "/entitySignB");
        const entityC = new CryptographicEntity(keypath + "/entitySignC");
        const data = "hello world";
        const signature = await entityA.signString(data);
        const adversarySignaturePublicKey = await entityC.getSignaturePublicKeyB64();
        const adversarySignaturePublicKeyObject = CryptographicEntity.importRemoteSignaturePublicKey(adversarySignaturePublicKey);

        const voidResult = await entityB.verifyString(data, signature, adversarySignaturePublicKeyObject, "void");
        assert(voidResult === undefined, 'should not have verified the signature');
        try {
            const result = await entityB.verifyString(data, signature, adversarySignaturePublicKeyObject, "throw");
            assert(false, 'should not have verified the signature');
        } catch (e) {
            assert(true, 'should not have verified the signature');
        }
    });



    it('should be able to encrypt and decrypt a string', async () => {
        const entityA = new CryptographicEntity(keypath + "/entityEncryptA");
        const entityB = new CryptographicEntity(keypath + "/entityEncryptB");
        const data = "hello world";
        const entityAEncryptionPublicKey = await entityA.getEncryptionPublicKeyB64();
        const entityBEncryptionPublicKey = await entityB.getEncryptionPublicKeyB64();
        const encrypted = await entityA.encryptString(data, "test", entityBEncryptionPublicKey);
        const result = await entityB.decryptString(encrypted, "test", entityAEncryptionPublicKey);
        assert(result === data, 'should have decrypted the string');
    });

    it('should not be able to decrypt a string with a wrong usage', async () => {
        const entityA = new CryptographicEntity(keypath + "/entityEncryptA");
        const entityB = new CryptographicEntity(keypath + "/entityEncryptB");
        const data = "hello world";
        const entityAEncryptionPublicKey = await entityA.getEncryptionPublicKeyB64();
        const entityBEncryptionPublicKey = await entityB.getEncryptionPublicKeyB64();
        const encrypted = await entityA.encryptString(data, "test", entityBEncryptionPublicKey);
        const voidResult = await entityB.decryptString(encrypted, "test2", entityAEncryptionPublicKey, "void");
        assert(voidResult === undefined, 'should not have decrypted the string');
        try {
            const result = await entityB.decryptString(encrypted, "test2", entityAEncryptionPublicKey, "throw");
            assert(false, 'should not have decrypted the string');
        } catch (e) {
            assert(true, 'should not have decrypted the string');
        }
    });

    it('should not be able to decrypt a string with a wrong public key', async () => {
        const entityA = new CryptographicEntity(keypath + "/entityEncryptA");
        const entityB = new CryptographicEntity(keypath + "/entityEncryptB");
        const entityC = new CryptographicEntity(keypath + "/entityEncryptC");
        const data = "hello world";
        const entityAEncryptionPublicKey = await entityA.getEncryptionPublicKeyB64();
        const entityBEncryptionPublicKey = await entityB.getEncryptionPublicKeyB64();
        const encrypted = await entityA.encryptString(data, "test", entityBEncryptionPublicKey);
        const voidResult = await entityC.decryptString(encrypted, "test", entityAEncryptionPublicKey, "void");
        assert(voidResult === undefined, 'should not have decrypted the string');
        try {
            const result = await entityC.decryptString(encrypted, "test", entityAEncryptionPublicKey, "throw");
            assert(false, 'should not have decrypted the string');
        } catch (e) {
            assert(true, 'should not have decrypted the string');
        }
    });

    it('should not be able to import a mangled key', async () => {
        const entityA = new CryptographicEntity(keypath + "/entityEncryptA");
        const entityB = new CryptographicEntity(keypath + "/entityEncryptB");
        const data = "hello world";
        const entityAEncryptionPublicKey = await entityA.getEncryptionPublicKeyB64();
        const entityBEncryptionPublicKey = await entityB.getEncryptionPublicKeyB64();
        const encrypted = await entityA.encryptString(data, "test", entityBEncryptionPublicKey);
        try {
            const result = await entityB.decryptString(encrypted, "test", entityAEncryptionPublicKey + "blub blab", "void");
            assert(false, 'should not have decrypted the string');
        } catch (e) {
            assert(true, 'should not have decrypted the string');
        }
        try {
            const result = await entityB.decryptString(encrypted, "test", entityAEncryptionPublicKey + "blub blab", "throw");
            assert(false, 'should not have decrypted the string');
        } catch (e) {
            assert(true, 'should not have decrypted the string');
        }
    });







});



