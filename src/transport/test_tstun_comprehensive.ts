// Comprehensive test for TCP STUN servers
// This file is AI generated.

// run with:
// bash: (out of src1)
// npm run build && node ts-js-out/transport/test_tstun_comprehensive.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/test_tstun_comprehensive.js

import { tstunServers, TstunServerAddress } from './stunt_servers.js';
import * as net from 'net';
import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';

interface TstunTestResult extends TstunServerAddress {
  externalIp?: string;
  externalPort?: number;
  error?: string;
  localPort?: number;
}

// Factored out connection handling
async function createTstunConnection(host: string, port: number, localPort: number, family: number): Promise<{ 
  data: any, 
  latency: number 
} | { 
  error: Error 
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const connection = net.createConnection({ host, port, localPort, family }, () => {});

    connection.on('data', (data) => {
      const latency = Date.now() - startTime;
      console.log(`Received response (${data.length} bytes)`);
      try {
        const json = JSON.parse(data.toString());
        console.log('data: ', json);
        connection.destroy();
        resolve({ data: json, latency });
      } catch (err) {
        connection.destroy();
        resolve({ error: err as Error });
      }
    });

    connection.on('error', (err) => {
      console.error(`Socket error:`, err);
      connection.destroy();
      resolve({ error: err });
    });
  });
}

async function testTstunServer(server: TstunServerAddress, localPort: number = 0): Promise<TstunTestResult> {
  const result: TstunTestResult = { 
    ...server,
    tests: (server.tests as number | undefined || 0) + 1,
    localPort
  };
  
  /*
  function parseAddress(address: string): { family: 'IPv4' | 'IPv6' | 'Hostname', host: string, port: number } {
    const urlparts = address.split(':');
    const PORT = parseInt(urlparts[urlparts.length - 1], 10);
    const HOST = urlparts.slice(0, urlparts.length - 1).join(':');
    if (HOST.startsWith('[') && HOST.endsWith(']')) {
      // IPv6 address, but it could still be an ipv4 mapped address (::ffff:127.0.0.1)
      if (HOST.startsWith('[::ffff:')) {
        return { family: 'IPv4', host: HOST.slice(8, -1), port: PORT };
      }
      return { family: 'IPv6', host: HOST.slice(1, -1), port: PORT };
    } else {
      // IPv4 address or hostname. IP regex, contains only numbers and period. otherwise it's a hostname ([0-9.]+)
      if (/^[0-9.]+$/.test(HOST)) {
        return { family: 'IPv4', host: HOST, port: PORT };
      } else {
        return { family: 'Hostname', host: HOST, port: PORT };
      }
    }
  }
  */
  
  // check if we have an ipv4 address, an ipv6 address or a hostname
  const { family, host, port } = parseAddress(server.url);
  if (!host || isNaN(port)) {
    result.failures = (result.failures as number | undefined || 0) + 1;
    result.error = `Invalid TSTUN/STUNT server address: ${server.url}`;
    return result;
  }
  
  console.log(`Testing TSTUN family:${family} host:${host} port:${port}`);

  let promiseIpv4Result: Promise<{ data: any, latency: number } | { error: Error }> | undefined;
  let promiseIpv6Result: Promise<{ data: any, latency: number } | { error: Error }> | undefined;

  if(family === 'Hostname' || family === 'IPv4') {promiseIpv4Result = createTstunConnection(host, port, localPort, 4);}
  if(family === 'Hostname' || family === 'IPv6') {promiseIpv6Result = createTstunConnection(host, port, localPort+1, 6);}
  
  // IPV4 or IPV6: either must work. Hostname: both must work.
  const connectionResults = await Promise.all([promiseIpv4Result, promiseIpv6Result].filter(p => p !== undefined) as Promise<{ data: any, latency: number } | { error: Error }>[]);

  for (const connectionResult of connectionResults) {
    if ('error' in connectionResult) {
      result.failures = (result.failures as number | undefined || 0) + 1;
      result.error = `Socket error: ${connectionResult.error}`;
      return result;
    }
    // Process successful connection
    const { data, latency } = connectionResult;
    result.lastWorked = Date.now();
    result.lastLatency = latency;
    // Extract external IP and port if available in the response
    if (data.ip) {
      result.externalIp = data.ip;
    }
    if (data.port) {
      result.externalPort = data.port;
    }
  }
  
  return result;
}

function parseAddress(address: string): { family: 'IPv4' | 'IPv6' | 'Hostname', host: string, port: number } {
  const urlparts = address.split(':');
  const PORT = parseInt(urlparts[urlparts.length - 1], 10);
  const HOST = urlparts.slice(0, urlparts.length - 1).join(':');
  if (HOST.startsWith('[') && HOST.endsWith(']')) {
    // IPv6 address, but it could still be an ipv4 mapped address (::ffff:127.0.0.1)
    if (HOST.startsWith('[::ffff:')) {
      return { family: 'IPv4', host: HOST.slice(8, -1), port: PORT };
    }
    return { family: 'IPv6', host: HOST.slice(1, -1), port: PORT };
  } else {
    // IPv4 address or hostname. IP regex, contains only numbers and period. otherwise it's a hostname ([0-9.]+)
    if (/^[0-9.]+$/.test(HOST)) {
      return { family: 'IPv4', host: HOST, port: PORT };
    } else {
      return { family: 'Hostname', host: HOST, port: PORT };
    }
  }
}


async function testAllTstunServers() {
  console.log('Starting comprehensive TSTUN server tests...');
  const results: TstunTestResult[] = [];
  const ipAddresses = new Set<string>();
  
  // Test with a specific local port
  let localStartPort = 12345; // You can change this to any port you want to test with

  for (const server of tstunServers) {
    const result = await testTstunServer(server, localStartPort+=2);
    results.push(result);
    
    if (result.externalIp) {
      ipAddresses.add(result.externalIp);
    }
  }

  // Print summary
  console.log('\n=== TSTUN Server Test Results ===');
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
    const port = result.externalPort !== undefined ? result.externalPort : 'N/A';
    const localPort = result.localPort !== undefined ? result.localPort : 'N/A';
    const error = result.error || 'None';
    
    console.log(`${result.url}: ${status}`);
    console.log(`  IP: ${ip}`);
    console.log(`  Local Port: ${localPort}`);
    console.log(`  External Port: ${port}`);
    console.log(`  Latency: ${latency}`);
    console.log(`  Error: ${error}`);
  });
  
  // Update the tstun_servers.ts file with working servers
  const updatedServers = results.map(result => {
    const { externalIp, externalPort, error, localPort, ...server } = result;
    return server;
  });
  
  updateTstunServersFile(updatedServers);
  
  return results;
}

function updateTstunServersFile(servers: TstunServerAddress[]) {
  try {
    const filePath = path.resolve('./transport/tstun_servers.ts');
    
    // Create the content for the updated file
    const fileContent = `// This file is auto-generated by test_tstun_comprehensive.ts
    
export type TstunServerAddress = {
    url: string, 
    lastWorked?: Number,
    lastLatency?: Number, 
    tests?: Number, // how often it was tested
    failures?: Number // how often it failed
};

// run with:
// bash: (out of src1)
// npm run build && node ts-js-out/transport/test_tstun_comprehensive.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/test_tstun_comprehensive.js

export const tstunServers: TstunServerAddress[] = ${JSON.stringify(servers, null, 2)}`;
    
    // Write the updated content to the file
    fs.writeFileSync(filePath, fileContent);
    console.log(`Successfully updated tstun_servers.ts file`);
  } catch (error) {
    console.error(`Failed to update tstun_servers.ts file:`, error);
  }
}

// Run the tests
testAllTstunServers().catch(console.error);




