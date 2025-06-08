// This file is AI generated.

import * as os from 'os';
import * as dgram from 'dgram';
import { stunServers, StunServerAddress } from './stun_servers.js';
import { characterizeNat, NatCharacterizationResult, NatType } from './characterizeNatUdp6.js';


export interface NetworkCandidate {
    address: string;
    port?: number;
    type: 'local' | 'stun' | 'vpn' | 'virtual' | 'stun hypothesis';
    family: 'IPv4' | 'IPv6';
    protocol: 'tcp' | 'udp';
    source?: string; // e.g., 'eth0', 'stun.l.google.com', 'tailscale'
    natType?: NatType;
    natInfo?: NatCharacterizationResult;
}

/**
 * Gathers all possible network candidates for peer connections
 * @returns Promise resolving to array of network candidates
 * @todo: bring sockets out as an argument, so the stun ports match the candidate ports
 */
export async function gatherNetworkCandidates(): Promise<NetworkCandidate[]> {
    const candidates: NetworkCandidate[] = [];

    // create sockets
    const udp4Socket = dgram.createSocket('udp4');
    const udp6Socket = dgram.createSocket('udp6');
    await Promise.all([
        new Promise<void>(resolve => udp4Socket.bind(0, () => resolve())),
        new Promise<void>(resolve => udp6Socket.bind(0, () => resolve())),
    ]);
    
    await Promise.all([
        // Gather local network interface addresses
        gatherLocalCandidates(candidates),
        
        // Gather external addresses using STUN
        gatherStunCandidates(candidates, udp6Socket, 'udp6'),
        gatherStunCandidates(candidates, udp4Socket, 'udp4'),
        // gather external addresses using STUNT
        //gatherStuntCandidates(candidates, udp4Socket, 'udp4'),
        //gatherStuntCandidates(candidates, udp6Socket, 'udp6'),
    ]);

    udp4Socket.close();
    udp6Socket.close();

    return candidates;
}

/**
 * Gathers local network interface addresses
 */
async function gatherLocalCandidates(
    candidates: NetworkCandidate[]
): Promise<void> {
    const interfaces = os.networkInterfaces();
    
    for (const [ifName, ifAddresses] of Object.entries(interfaces)) {
        if (!ifAddresses) continue;
        
        for (const addr of ifAddresses) {
            // Skip internal/loopback addresses except localhost
            const isLocalhost = addr.address === '127.0.0.1' || addr.address === '::1';
            
            if (addr.internal && !isLocalhost) continue;
            
            const type = isLocalhost ? 'local' : 
                         ifName.includes('vEthernet') || ifName.includes('virt') ? 'virtual' : 
                         ifName.includes('tailscale') || ifName.includes('wg') ? 'vpn' : 'local';
            
            // Add TCP candidate
            candidates.push({
                address: addr.address,
                type,
                family: addr.family === 'IPv4' ? 'IPv4' : 'IPv6',
                protocol: 'tcp',
                source: ifName
            });
            
            // Add UDP candidate
            candidates.push({
                address: addr.address,
                type,
                family: addr.family === 'IPv4' ? 'IPv4' : 'IPv6',
                protocol: 'udp',
                source: ifName
            });
        }
    }
}

/**
 * Gathers external addresses using STUN servers
 */
async function gatherStunCandidates(
    candidates: NetworkCandidate[],
    socket: dgram.Socket,
    method: 'udp4' | 'udp6'
): Promise<void> {
    // Use working STUN servers from our list

    try {
        const natCharacterization = await characterizeNat(stunServers, Math.max(stunServers.length, 3), socket);
        if (natCharacterization.publicIps.size == 1) {
            const ip = Array.from(natCharacterization.publicIps)[0];
            const port = Array.from(natCharacterization.publicPorts)[0];
            // Add UDP candidate with the external address, unless natType is UDP Blocked
            if (natCharacterization.natType !== 'UDP Blocked') {
                candidates.push({
                    address: ip,
                    port,
                    type: 'stun',
                    family: (method === 'udp4' ? 'IPv4' : 'IPv6'),
                    protocol: 'udp',
                    source: 'STUN (' + (natCharacterization.rawResults.map(r => r.server.url).join(', ')) + ')',
                    natType: natCharacterization.natType,
                    natInfo: natCharacterization
                });
            }

            // Add TCP candidate with the external address
            candidates.push({
                address: ip,
                port,
                type: 'stun hypothesis',
                family: (method === 'udp4' ? 'IPv4' : 'IPv6'),
                protocol: 'tcp',
                source: 'STUN (' + (natCharacterization.rawResults.map(r => r.server.url).join(', ')) + ')',
                natType: natCharacterization.natType,
                natInfo: natCharacterization
            });
            
        }
    } catch (error) {
        console.error(`Failed to get external address from STUN: ${error}`);
    }
}

/**
 * Gets external IP address using a STUN server
 */
async function getExternalAddressFromStun(server: StunServerAddress): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const [host, portStr] = server.url.split(':');
        const port = parseInt(portStr, 10);
        
        if (!host || isNaN(port)) {
            reject(new Error(`Invalid STUN server address: ${server.url}`));
            return;
        }
        
        // STUN message type for binding request (RFC 5389)
        const STUN_BINDING_REQUEST = Buffer.from([
            0x00, 0x01, 0x00, 0x00, // Type and length
            0x21, 0x12, 0xA4, 0x42, // Magic cookie
            // Transaction ID (12 bytes)
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C
        ]);
        
        const socket = dgram.createSocket('udp4');
        let timeout: NodeJS.Timeout;
        
        socket.on('message', (msg) => {
            clearTimeout(timeout);
            
            try {
                // Check if it's a valid STUN response
                if (msg.length < 20) {
                    socket.close();
                    resolve(null);
                    return;
                }
                
                // Check message type (first 2 bytes)
                const messageType = msg.readUInt16BE(0);
                if (messageType !== 0x0101) { // Binding response
                    socket.close();
                    resolve(null);
                    return;
                }
                
                // Parse attributes
                // Attributes start at byte 20 (after header)
                let i = 20;
                
                while (i < msg.length) {
                    // Each attribute has a 4-byte header (2 bytes type, 2 bytes length)
                    if (i + 4 > msg.length) {
                        break;
                    }
                    
                    const attrType = msg.readUInt16BE(i);
                    const attrLength = msg.readUInt16BE(i + 2);
                    
                    // Check if we have enough bytes for the attribute value
                    if (i + 4 + attrLength > msg.length) {
                        break;
                    }
                    
                    if (attrType === 0x0020) { // XOR-MAPPED-ADDRESS
                        // XOR-MAPPED-ADDRESS format:
                        // 1 byte reserved (0x00)
                        // 1 byte family (0x01 for IPv4, 0x02 for IPv6)
                        // 2 bytes port (XORed with most significant 16 bits of magic cookie)
                        // 4 bytes IPv4 address (XORed with magic cookie) or 16 bytes IPv6 address
                        
                        if (attrLength < 8) { // Minimum size for IPv4
                            break;
                        }
                        
                        const family = msg.readUInt8(i + 5);
                        
                        if (family === 0x01) { // IPv4
                            // XOR with magic cookie to get real IP
                            const xorIp = msg.readUInt32BE(i + 8);
                            const ip = xorIp ^ 0x2112A442;
                            
                            const a = (ip >> 24) & 0xFF;
                            const b = (ip >> 16) & 0xFF;
                            const c = (ip >> 8) & 0xFF;
                            const d = ip & 0xFF;
                            
                            const ipStr = `${a}.${b}.${c}.${d}`;
                            socket.close();
                            resolve(ipStr);
                            return;
                        }
                    }
                    
                    // Move to the next attribute (4 bytes header + attribute value)
                    // Attributes are padded to 4-byte boundaries
                    i += 4 + Math.ceil(attrLength / 4) * 4;
                }
                
                socket.close();
                resolve(null); // No XOR-MAPPED-ADDRESS found
            } catch (err) {
                socket.close();
                reject(err);
            }
        });
        
        socket.on('error', (err) => {
            clearTimeout(timeout);
            socket.close();
            reject(err);
        });
        
        // Set timeout for 5 seconds
        timeout = setTimeout(() => {
            socket.close();
            reject(new Error('STUN request timed out'));
        }, 5000);
        
        try {
            socket.send(STUN_BINDING_REQUEST, 0, STUN_BINDING_REQUEST.length, port, host);
        } catch (err) {
            clearTimeout(timeout);
            socket.close();
            reject(err);
        }
    });
}


