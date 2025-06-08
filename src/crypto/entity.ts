import * as crypto from "crypto";
import { promisify } from "util";
import { promises as fs } from "fs";
import * as path from "path";

type EncryptedBuffer = Buffer;
type EncryptedString = string;
type SignatureBuffer = Buffer;
export type SignatureString = string;
export type RemoteSignaturePublicKeyString = string;
export type RemoteEncryptionPublicKeyString = string;
type RemoteSignaturePublicKey = crypto.KeyObject; //ED25519
type RemoteEncryptionPublicKey = crypto.KeyObject; //x25519

type EPHEMERAL = Symbol;
export const EPHEMERAL : EPHEMERAL = Symbol("EPHEMERAL");

export class CryptographicEntity {
    // remoteKeyString, usage
    private keyCache: Map<string, Map<string, Buffer>> = new Map();
    // [keystring:usage]
    private keyCacheCleanupLut: Map<string, {age: number, remoteKeyString: string, usage: string }> = new Map();	
    

    private localSignatureKeyPair: Promise<crypto.KeyPairKeyObjectResult>;
    private localEncryptionKeyPair: Promise<crypto.KeyPairKeyObjectResult>;
    private keyPath: string | EPHEMERAL;

    constructor(keyPath: string | EPHEMERAL, private memoizeKeys: number = 0) {
        this.keyPath = keyPath;
        this.localSignatureKeyPair = this.loadOrCreateSignatureKeys(keyPath);
        this.localEncryptionKeyPair = this.loadOrCreateEncryptionKeys(keyPath);
    }

    private async loadOrCreateSignatureKeys(keyPath: string | EPHEMERAL): Promise<crypto.KeyPairKeyObjectResult> {
        if (keyPath === EPHEMERAL) {
            const { publicKey, privateKey } = await promisify(crypto.generateKeyPair)('ed25519');
            return { privateKey, publicKey };
        }

        const privPath = path.join(keyPath as string, "ed25519-private.key");

        try {
            const privRaw = await fs.readFile(privPath);
            const privateKey = crypto.createPrivateKey({
                key: privRaw,
                format: 'der',
                type: 'pkcs8'
            });
            const publicKey = crypto.createPublicKey(privateKey);
            return { privateKey, publicKey };
        } catch(e: any) {
            if (e.code !== 'ENOENT') throw e;
            await fs.mkdir(keyPath as string, { recursive: true });
            const { publicKey, privateKey } = await promisify(crypto.generateKeyPair)('ed25519');
            const exportedPriv = privateKey.export({ format: 'der', type: 'pkcs8' });
            await fs.writeFile(privPath, exportedPriv);
            return { privateKey, publicKey };
        }
    }

    private async loadOrCreateEncryptionKeys(keyPath: string | EPHEMERAL): Promise<crypto.KeyPairKeyObjectResult> {
        if (keyPath === EPHEMERAL) {
            const { publicKey, privateKey } = await promisify(crypto.generateKeyPair)('x25519');
            return { privateKey, publicKey };
        }

        const privPath = path.join(keyPath as string, "x25519-private.key");
    
        try {
            const privRaw = await fs.readFile(privPath);
            const privateKey = crypto.createPrivateKey({
                key: privRaw,
                format: 'der',
                type: 'pkcs8'
            });
            const publicKey = crypto.createPublicKey(privateKey);
            return { privateKey, publicKey };
        } catch (e: any) {
            if (e.code !== 'ENOENT') throw e;
            await fs.mkdir(keyPath as string, { recursive: true });
            const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
                publicKeyEncoding: { type: 'spki', format: 'der' },
                privateKeyEncoding: { type: 'pkcs8', format: 'der' }
            });
            await fs.writeFile(privPath, privateKey);
            return { privateKey: crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' }), publicKey: crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' }) };
        }
    }

    // Convenience methods to retrieve Base64 public keys. It's a remote key, as far as the peer is concerned.
    public async getSignaturePublicKeyB64(): Promise<RemoteSignaturePublicKeyString> {
        const { publicKey } = await this.localSignatureKeyPair;
        const pubRaw = publicKey.export({ format: 'der', type: 'spki' } as crypto.KeyExportOptions<'der'>);
        return pubRaw.toString('base64');
    }

    public async getEncryptionPublicKeyB64(): Promise<RemoteEncryptionPublicKeyString> {
        const { publicKey } = await this.localEncryptionKeyPair;
        const pubRaw = publicKey.export({ format: 'der', type: 'spki' });
        return pubRaw.toString('base64');
    }
    

    public static importRemoteSignaturePublicKey(b64: RemoteSignaturePublicKeyString): RemoteSignaturePublicKey {
        const der = Buffer.from(b64, 'base64');
        return crypto.createPublicKey({
            key: der,
            format: 'der',
            type: 'spki'
        });
    }

    public static importRemoteEncryptionPublicKey(b64: RemoteEncryptionPublicKeyString): RemoteEncryptionPublicKey {
        const der = Buffer.from(b64, 'base64');
        return crypto.createPublicKey({
            key: der,
            format: 'der',
            type: 'spki'
        });
    }    

    async signBuffer(data: Buffer): Promise<SignatureBuffer> {
        const privateKey = (await this.localSignatureKeyPair).privateKey;
        const signature = crypto.sign(null, data, privateKey);
        return signature;
    }

    public async signString(data: string): Promise<SignatureString> {
        return this.signBuffer(Buffer.from(data, 'utf-8'))
            .then((signature) => signature.toString('base64'));
    }

    public static async verifyBuffer(
        data: Buffer, 
        signature: SignatureBuffer, 
        remotePublicKey: RemoteSignaturePublicKey, 
        failureMode: "void" | "throw" = "throw")
    : Promise<Buffer | void> {
        const isValid = crypto.verify(null, data, remotePublicKey, signature);
        if (!isValid) {
            if (failureMode === "throw") {
                throw new Error("Signature verification failed");
            }
            return;
        }
        return data;
    }
    public async verifyString(
        data: string, 
        signature: SignatureString, 
        publicKey: RemoteSignaturePublicKey, failureMode: "void" | "throw" = "throw")
    : Promise<String | void> {
        return CryptographicEntity.verifyBuffer(
                Buffer.from(data, 'utf-8'), 
                Buffer.from(signature, 'base64'), 
                publicKey, 
                failureMode)
            .then((data) => data?.toString('utf-8'));
    }

    private async __getSharedSecretUtilityKey(
        usage: string,
        remotePublicKeyString: RemoteEncryptionPublicKeyString
    ) {
        const { privateKey: localPrivateKey, publicKey: localPublicKey } = await this.localEncryptionKeyPair;

        let sharedSecretUtilityKey: Buffer | undefined = undefined;
        if (this.memoizeKeys > 0) {
            // try cache
            const potentialKey = this.keyCache.get(remotePublicKeyString)?.get(usage);
            if (potentialKey) {
                sharedSecretUtilityKey = potentialKey;
                //@ts-ignore lut must be set.
                this.keyCacheCleanupLut.get([remotePublicKeyString, usage].join(':')).age = Date.now();
            }
        }
        if (!sharedSecretUtilityKey) {
            const remotePublicKeyObject = CryptographicEntity.importRemoteEncryptionPublicKey(remotePublicKeyString);
            const sortedKeys = [localPublicKey.export({ format: 'der', type: 'spki' }).toString('base64'), remotePublicKeyObject.export({ format: 'der', type: 'spki' }).toString('base64')].sort();
            const info = Buffer.from(`${usage}:${sortedKeys[0]}:${sortedKeys[1]}`);

            const sharedGeneralSecret = crypto.diffieHellman({
                privateKey : localPrivateKey,
                publicKey: remotePublicKeyObject
            });
        
            const key = Buffer.from(crypto.hkdfSync('sha256', Buffer.alloc(0), sharedGeneralSecret, info, 32));


            if (this.memoizeKeys > 0) {

                // evict oldest if necessary
                if(this.keyCacheCleanupLut.size >= this.memoizeKeys) {
                    const oldest = [...this.keyCacheCleanupLut.values()].sort((a, b) => a.age - b.age)[0];
                    this.keyCacheCleanupLut.delete([oldest.remoteKeyString, oldest.usage].join(':'));
                    this.keyCache.get(oldest.remoteKeyString)!.delete(oldest.usage);
                    if (this.keyCache.get(oldest.remoteKeyString)!.size === 0) {
                        this.keyCache.delete(oldest.remoteKeyString);
                    }
                }

                // insert into cache
                this.keyCache.set(remotePublicKeyString, this.keyCache.get(remotePublicKeyString) ?? new Map());
                this.keyCache.get(remotePublicKeyString)!.set(usage, key);
                this.keyCacheCleanupLut.set([remotePublicKeyString, usage].join(':'), { age: Date.now(), remoteKeyString: remotePublicKeyString, usage });
            }
            sharedSecretUtilityKey = key;
        }
        return sharedSecretUtilityKey;
    }


    public async encryptBuffer(
        data: Buffer,
        usage: string, // explain what this is used for, to prevent cross-protocol key-reuse attacks.
        remotePublicKeyString: RemoteEncryptionPublicKeyString
    ): Promise<EncryptedBuffer> {

        const sharedSecretUtilityKey = await this.__getSharedSecretUtilityKey(usage, remotePublicKeyString);
    
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecretUtilityKey, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();
    
        return Buffer.concat([iv, tag, encrypted]);
    }
    
    
    public async encryptString(data: string, usage: string, remotePublicKeyB64: RemoteEncryptionPublicKeyString): Promise<EncryptedString> {
        return this.encryptBuffer(Buffer.from(data, 'utf-8'), usage, remotePublicKeyB64)
            .then((encrypted) => encrypted.toString('base64'));
    }
    public async decryptBuffer(
        data: EncryptedBuffer,
        usage: string, // explain what this is used for, to prevent cross-protocol key-reuse attacks. See what was written for encryptBuffer.
        remotePublicKeyString: RemoteEncryptionPublicKeyString,
        failureMode: "void" | "throw" = "throw"
    ): Promise<Buffer | void> {
        const { privateKey: localPrivateKey, publicKey: localPublicKey } = await this.localEncryptionKeyPair;
    
        try {
            const sharedSecretUtilityKey = await this.__getSharedSecretUtilityKey(usage, remotePublicKeyString);
    
            // Extract iv (12 bytes), tag (16 bytes), and ciphertext
            const iv = data.subarray(0, 12);
            const tag = data.subarray(12, 28);
            const ciphertext = data.subarray(28);
    
            const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecretUtilityKey, iv);
            decipher.setAuthTag(tag);
    
            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return decrypted;
    
        } catch (err) {
            if (failureMode === "throw") {
                throw new Error("Decryption failed or data is tampered.");
            }
            return;
        }
    }
    

    public async decryptString(data: EncryptedString, usage: string, remotePublicKeyB64: RemoteEncryptionPublicKeyString, failureMode: "void" | "throw" = "throw"): Promise<String | void> {
        return this.decryptBuffer(Buffer.from(data, 'base64'), usage, remotePublicKeyB64, failureMode)
            .then((decrypted) => decrypted?.toString('utf-8'));
    }

    public async __purgeKeys() {
        // remove keys from fs
        if (this.keyPath === EPHEMERAL) return;
        await fs.unlink(path.join(this.keyPath as string, "ed25519-private.key"));
        await fs.unlink(path.join(this.keyPath as string, "x25519-private.key"));
        this.keyPath = EPHEMERAL;
    }
    public async __purgeKeyCache() {
        this.keyCache.clear();
    }
} 