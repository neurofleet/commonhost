// Comprehensive test for STUN servers
// This file is AI generated.

// run with:
// bash: (out of src1)
// npm run build && node ts-js-out/transport/test_stun_comprehensive.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/test_stun_comprehensive.js

import { stunServers, StunServerAddress } from './stun_servers.js';
import * as dgram from 'dgram';
import * as fs from 'fs';
import * as path from 'path';

// STUN message type for binding request (RFC 5389)
const STUN_BINDING_REQUEST = Buffer.from([
  0x00, 0x01, 0x00, 0x00, // Type and length
  0x21, 0x12, 0xA4, 0x42, // Magic cookie
  // Transaction ID (12 bytes)
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C
]);

interface StunTestResult extends StunServerAddress {
  externalIp?: string;
  error?: string;
}

async function testStunServer(server: StunServerAddress): Promise<StunTestResult> {
  return new Promise((resolve) => {
    const result: StunTestResult = { 
      ...server,
      tests: (server.tests as number | undefined || 0) + 1
    };
    
    const [host, portStr] = server.url.split(':');
    const port = parseInt(portStr, 10);
    
    if (!host || isNaN(port)) {
      result.failures = (result.failures as number | undefined || 0) + 1;
      result.error = `Invalid STUN server address: ${server.url}`;
      resolve(result);
      return;
    }

    console.log(`Testing STUN server: ${server.url}`);
    
    const socket = dgram.createSocket('udp6');
    const startTime = Date.now();
    let timeout: NodeJS.Timeout;

    socket.on('message', (msg) => {
      const latency = Date.now() - startTime;
      clearTimeout(timeout);
      
      try {
        console.log(`Received response from ${server.url} (${msg.length} bytes)`);
        
        // Check if it's a valid STUN response
        if (msg.length < 20) {
          console.log(`Response from ${server.url} too short to be valid`);
          socket.close();
          result.failures = (result.failures as number | undefined || 0) + 1;
          result.error = 'Response too short';
          resolve(result);
          return;
        }
        
        // Check message type (first 2 bytes)
        const messageType = msg.readUInt16BE(0);
        if (messageType !== 0x0101) { // Binding response
          console.log(`Unexpected message type from ${server.url}: 0x${messageType.toString(16)}`);
          socket.close();
          result.failures = (result.failures as number | undefined || 0) + 1;
          result.error = `Invalid message type: 0x${messageType.toString(16)}`;
          resolve(result);
          return;
        }
        
        // Parse attributes
        // Attributes start at byte 20 (after header)
        let i = 20;
        let foundXorMappedAddress = false;
        
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
            console.log(`Found XOR-MAPPED-ADDRESS in response from ${server.url}`);
            foundXorMappedAddress = true;
            
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
              console.log(`External IP from ${server.url}: ${ipStr}`);
              
              result.lastWorked = Date.now();
              result.lastLatency = latency;
              result.externalIp = ipStr;
              socket.close();
              resolve(result);
              return;
            } else if (family === 0x02) { // IPv6
              console.log(`Found IPv6 address in response from ${server.url}`);
              
              // XOR with magic cookie and transaction ID to get real IPv6 address
              const xip = Buffer.alloc(16);
              const transactionId = STUN_BINDING_REQUEST.slice(8, 20);
              
              for (let j = 0; j < 16; j++) {
                const cookieOrTransactionByte = j < 4
                  ? ((0x2112A442 >> ((3 - j) * 8)) & 0xFF)
                  : transactionId[j - 4];
                xip[j] = msg[i + 8 + j] ^ cookieOrTransactionByte;
              }
              
              // Convert Buffer to standard IPv6 notation
              const ipStr = xip.toString('hex').match(/.{1,4}/g)!.join(':');
              // Simplify IPv6 address notation (replace consecutive zeros)
              const simplifiedIp = ipStr.replace(/\b:?(?:0+:){2,}/, '::').replace(/(^|:)0{1,3}/g, '$1');
              
              console.log(`External IPv6 from ${server.url}: ${simplifiedIp}`);
              
              result.lastWorked = Date.now();
              result.lastLatency = latency;
              result.externalIp = simplifiedIp;
              socket.close();
              resolve(result);
              return;
            }
          }
          
          // Move to the next attribute (4 bytes header + attribute value)
          // Attributes are padded to 4-byte boundaries
          i += 4 + Math.ceil(attrLength / 4) * 4;
        }
        
        if (!foundXorMappedAddress) {
          console.log(`No XOR-MAPPED-ADDRESS found in response from ${server.url}`);
          result.failures = (result.failures as number | undefined || 0) + 1;
          result.error = 'No XOR-MAPPED-ADDRESS found';
        }
        
        socket.close();
        resolve(result);
      } catch (err) {
        console.error(`Error parsing response from ${server.url}:`, err);
        socket.close();
        result.failures = (result.failures as number | undefined || 0) + 1;
        result.error = `Parse error: ${err}`;
        resolve(result);
      }
    });

    socket.on('error', (err) => {
      console.error(`Socket error with ${server.url}:`, err);
      clearTimeout(timeout);
      socket.close();
      result.failures = (result.failures as number | undefined || 0) + 1;
      result.error = `Socket error: ${err}`;
      resolve(result);
    });

    // Set timeout for 5 seconds
    timeout = setTimeout(() => {
      console.error(`Request to ${server.url} timed out`);
      socket.close();
      result.failures = (result.failures as number | undefined || 0) + 1;
      result.error = 'Timeout';
      resolve(result);
    }, 5000);

    try {
      socket.send(STUN_BINDING_REQUEST, 0, STUN_BINDING_REQUEST.length, port, host);
      console.log(`STUN request sent to ${server.url}`);
    } catch (err) {
      console.error(`Error sending request to ${server.url}:`, err);
      clearTimeout(timeout);
      socket.close();
      result.failures = (result.failures as number | undefined || 0) + 1;
      result.error = `Send error: ${err}`;
      resolve(result);
    }
  });
}

async function testAllStunServers() {
  console.log('Starting comprehensive STUN server tests...');
  const results: StunTestResult[] = [];
  const ipAddresses = new Set<string>();

  for (const server of stunServers) {
    const result = await testStunServer(server);
    results.push(result);
    
    if (result.externalIp) {
      ipAddresses.add(result.externalIp);
    }
  }

  // Print summary
  console.log('\n=== STUN Server Test Results ===');
  console.log(`Total servers tested: ${results.length}`);
  
  const workingServers = results.filter(r => r.externalIp);
  console.log(`Working servers: ${workingServers.length}`);
  
  console.log('\n=== External IP Addresses ===');
  if (ipAddresses.size === 0) {
    console.log('No external IP addresses found');
  } else if (ipAddresses.size === 1) {
    console.log(`All servers returned the same IP: ${Array.from(ipAddresses)[0]}`);
  } else {
    console.log(`Different IP addresses returned: ${Array.from(ipAddresses).join(', ')}`);
    console.log('This could indicate NAT issues or multiple network interfaces');
  }
  
  console.log('\n=== Detailed Results ===');
  results.forEach(result => {
    const status = result.externalIp ? 'SUCCESS' : 'FAILED';
    const latency = result.lastLatency ? `${result.lastLatency}ms` : 'N/A';
    const ip = result.externalIp || 'N/A';
    const error = result.error || 'None';
    
    console.log(`${result.url}: ${status}`);
    console.log(`  IP: ${ip}`);
    console.log(`  Latency: ${latency}`);
    console.log(`  Error: ${error}`);
  });
  
  // Update the stun_servers.ts file with working servers
  const updatedServers = results.map(result => {
    const { externalIp, error, ...server } = result;
    return server;
  });
  
  updateStunServersFile(updatedServers);
  
  return results;
}

function updateStunServersFile(servers: StunServerAddress[]) {
  try {
    const filePath = path.resolve('./transport/stun_servers.ts');
    
    // Create the content for the updated file
    const fileContent = `// This file is auto-generated by test_stun_comprehensive.ts
    
export type StunServerAddress = {
    url: string, 
    lastWorked?: Number,
    lastLatency?: Number, 
    tests?: Number, // how often it was tested
    failures?: Number // how often it failed
};

// run with:
// bash: (out of src1)
// npm run build && node ts-js-out/transport/test_stun_comprehensive.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/test_stun_comprehensive.js

export const stunServers: StunServerAddress[] = ${JSON.stringify(servers, null, 2)}`;
    
    // Write the updated content to the file
    fs.writeFileSync(filePath, fileContent);
    console.log(`Successfully updated stun_servers.ts file`);
  } catch (error) {
    console.error(`Failed to update stun_servers.ts file:`, error);
  }
}

// Run the tests
testAllStunServers().catch(console.error);
