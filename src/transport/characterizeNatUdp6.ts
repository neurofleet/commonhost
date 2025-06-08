import * as dgram from 'dgram';
import { StunServerAddress } from './stun_servers.js';
import * as crypto from 'crypto';

export type NatType = 'Full Cone NAT' | 'Symmetric NAT' | 'Symmetric NAT or Multi-NAT' | 'UDP Blocked' | 'Unknown' | 'Unknown (Underdetermined)';

export type NatCharacterizationResult = {
  natType: NatType;
  publicIps: Set<string>;
  publicPorts: Set<number>;
  rawResults: {
    server: StunServerAddress;
    mappedAddress?: { ip: string, port: number };
    error?: Error;
  }[];
}

function parseMappedAddress(msg: Buffer, transactionId: Buffer): { ip: string, port: number } | undefined {
  const XOR_MAPPED_ADDRESS_TYPE = 0x0020;
  const MAGIC_COOKIE = 0x2112A442;
  let i = 20; // Skip STUN header

  while (i + 4 < msg.length) {
    const type = msg.readUInt16BE(i);
    const length = msg.readUInt16BE(i + 2);

    if (type === XOR_MAPPED_ADDRESS_TYPE && (length === 8 || length === 20)) {
      const family = msg.readUInt8(i + 5);
      let xport = msg.readUInt16BE(i + 6) ^ (MAGIC_COOKIE >> 16);
      let ip: string;

      if (family === 0x01 && length === 8) { // IPv4
        const xip = [
          msg[i + 8] ^ ((MAGIC_COOKIE >> 24) & 0xFF),
          msg[i + 9] ^ ((MAGIC_COOKIE >> 16) & 0xFF),
          msg[i + 10] ^ ((MAGIC_COOKIE >> 8) & 0xFF),
          msg[i + 11] ^ (MAGIC_COOKIE & 0xFF),
        ];
        ip = xip.join('.');
        return { ip, port: xport };
      } else if (family === 0x02 && length === 20) { // IPv6
        const xip = Buffer.alloc(16);
        for (let j = 0; j < 16; j++) {
          const cookieOrTransactionByte = j < 4
            ? ((MAGIC_COOKIE >> ((3 - j) * 8)) & 0xFF)
            : transactionId[j - 4];
          xip[j] = msg[i + 8 + j] ^ cookieOrTransactionByte;
        }

        // Convert Buffer to standard IPv6 notation
        ip = xip.toString('hex').match(/.{1,4}/g)!.join(':');
        ip = simplifyIPv6(ip);
        return { ip, port: xport };
      }
    }

    i += 4 + length;
  }

  return undefined;
}

// Helper to simplify IPv6 address notation
function simplifyIPv6(ip: string): string {
  return ip.replace(/\b:?(?:0+:){2,}/, '::').replace(/(^|:)0{1,3}/g, '$1');
}


async function sendStunRequest(server: StunServerAddress, socket: dgram.Socket): Promise<{ server: StunServerAddress, mappedAddress?: { ip: string, port: number }, error?: Error }> {
  return new Promise((resolve) => {
    const transactionId = crypto.randomBytes(12);
    const stunRequest = Buffer.alloc(20);
    stunRequest.writeUInt16BE(0x0001, 0); // Binding request
    stunRequest.writeUInt16BE(0x0000, 2); // Message length
    stunRequest.writeUInt32BE(0x2112A442, 4); // Magic cookie
    transactionId.copy(stunRequest, 8); // Transaction ID

    const [host, portStr] = server.url.replace('stun:', '').split(':');
    const port = parseInt(portStr || '3478', 10);

    const timeout = setTimeout(() => {
      resolve({ server, error: new Error('Timeout') });
    }, 3000);

    socket.on('message', (msg) => {
      // check transaction id. if it's not the same as the one we sent, ignore it
      if (!msg.slice(8, 20).equals(transactionId)) {
        return;
      }
      clearTimeout(timeout);
      const mapped = parseMappedAddress(msg, transactionId);
      if(mapped) resolve({ server, mappedAddress: mapped, txids: transactionId, txidr: msg.slice(8, 20) } as any);
      else resolve({ server, error: new Error('No mapped address') });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ server, error: err });
    });

    socket.send(stunRequest, 0, stunRequest.length, port, host, (err) => {
      if (err) {
        clearTimeout(timeout);
        resolve({ server, error: err });
      }
    });
  });
}

export async function characterizeNat(servers: StunServerAddress[], testServersCount = 3, socket: dgram.Socket	): Promise<NatCharacterizationResult> {
  const sorted = [...servers].sort((a, b) => (a.lastLatency as number | void ?? Infinity) - (b.lastLatency as number | void ?? Infinity));
  const testServers = sorted.slice(0, testServersCount);

  const common_socket = socket;

  const results = await Promise.all(testServers.map(ts => sendStunRequest(ts, common_socket)));
  console.log(results);

  const publicIps = new Set<string>();
  const publicPorts = new Set<number>();
  const errors = new Set<Error>();
  for (const res of results) {
    if (res.mappedAddress) {
      publicIps.add(res.mappedAddress.ip);
      publicPorts.add(res.mappedAddress.port);
    } else if (res.error) {
      errors.add(res.error);
    }
  }

  const successes = testServers.length - errors.size;

  let natType: NatType = 'Unknown';
  if (results.every(r => r.error)) {
    natType = 'UDP Blocked';
  } else if (publicIps.size === 1 && publicPorts.size === 1 && successes >= 2) {
    natType = 'Full Cone NAT'; // could be Open Internet too
  } else if (publicIps.size === 1 && publicPorts.size > 1) {
    natType = 'Symmetric NAT';
  } else if (publicIps.size > 1) {
    natType = 'Symmetric NAT or Multi-NAT';
  } else if (publicIps.size === 1 && publicPorts.size === 1 && successes === 1) {
    natType = 'Unknown (Underdetermined)';
  }

  return {
    natType,
    publicIps,
    publicPorts,
    rawResults: results,
  };
}


