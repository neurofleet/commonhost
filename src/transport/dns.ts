import * as dns from 'dns';

export type Address = {
    family: 'IPv4' | 'IPv6',
    protocol?: string, // e.g., http, https, ftp, stun, stunt/tstun, etc.
    host: string,
    port?: number,
    resource?: string // e.g., /api/v1/data
    fragment?: string // e.g., #top
};
export type AddressPort = Address & { port: number };

/**
 * Resolves a resource locator to a list of addresses.
 * If an ipv4 or ipv6 address string is provided, it is returned as is in the Address format.
 * If a hostname is provided, it is resolved to the various potential addresses and returned as array.
 * 
 * @param resource_locator // can be ipv4, ipv6, hostname, or hostname:port
 * @returns Promise resolving to array of addresses
 */
export async function resolveLocator(resource_locator: string): Promise<Address[]> {
    // parse protocol, if any
    const protocol = resource_locator.split('://')[0];
    if (protocol !== resource_locator) {
        resource_locator = resource_locator.slice(protocol.length + 3);
    }
    // parse fragment, if any
    const fragment =  resource_locator.includes('#') ? resource_locator.slice(resource_locator.indexOf('#')) : undefined;
    if (fragment) {
        resource_locator = resource_locator.slice(0, -fragment.length);
    }
    // parse resource, if any
    const resource = resource_locator.includes('/') ? resource_locator.slice(resource_locator.indexOf('/')) : undefined;
    if (resource) {
        resource_locator = resource_locator.slice(0, -resource.length);
    }
    // parse port, if any.
    const portCandidate = resource_locator.split(':').pop() || '';
    const port = isNaN(Number(portCandidate)) ? undefined : Number(portCandidate);
    if (port !== undefined) {
        resource_locator = resource_locator.slice(0, -port.toString().length - 1);
    }	
    //debug console.log("identified so far:", {resource_locator,  protocol, fragment, resource, port });


    const { family, host } = parseAddress(resource_locator);
    if (family === 'Hostname') {
        // resolve A and AAAA records
        const addresses: Address[] = [];
        const promise_a_records = dns.promises.resolve4(host);
        const promise_aaaa_records = dns.promises.resolve6(host);
        const [a_records, aaaa_records] = await Promise.all([promise_a_records, promise_aaaa_records]);
        for (const a of a_records) {
            addresses.push({ 
                family: 'IPv4', 
                host: a, 
                ...(port !== undefined && { port }),
                ...(protocol && { protocol }),
                ...(resource && { resource }),
                ...(fragment && { fragment })
            });
        }
        for (const aaaa of aaaa_records) {
            addresses.push({ 
                family: 'IPv6', 
                host: aaaa, 
                ...(port !== undefined && { port }),
                ...(protocol && { protocol }),
                ...(resource && { resource }),
                ...(fragment && { fragment })
            });
        }
        return addresses;
    } else {
        return [{ 
            family,
            host,
            ...(port !== undefined && { port }),
            ...(protocol && { protocol }),
            ...(resource && { resource }),
            ...(fragment && { fragment })
        }];
    }
    
}

export function parseAddress(host: string): { 
    family: 'IPv4' | 'IPv6' | 'Hostname',
    host: string
 } {

    if (host.startsWith('[') && host.endsWith(']')) {
      // IPv6 address, but it could still be an ipv4 mapped address (::ffff:127.0.0.1)
      if (host.startsWith('[::ffff:')) {
        return { family: 'IPv4', host: host.slice(8, -1) };
      }
      return { family: 'IPv6', host: host.slice(1, -1) };
    } else {
      // IPv4 address or hostname. IP regex, contains only numbers and period. otherwise it's a hostname ([0-9.]+)
      if (/^[0-9.]+$/.test(host)) {
        return { family: 'IPv4', host: host };
      } else {
        return { family: 'Hostname', host: host };
      }
    }
  }
