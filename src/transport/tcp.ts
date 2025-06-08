import * as net from 'net';
import { AddressPort } from './dns.js';
type PortError = Error & { code: 'EADDRINUSE' };
type TimeoutError = Error & { code: 'ETIMEDOUT' };
type NetError = PortError | TimeoutError | Error & { code: string };

/**
 * Opens a TCP port, writes nothing, waits for one message, and closes the port.
 * when the promise resolves, the port is guaranteed to be released.
 * This is typically used for STUNT/TSTUN server queries.
 * @param address // can be ipv4, ipv6 or hostname
 * @param sourcePort 
 * @param timeout // in ms
 * @returns Promise resolving to the response from the server
 * @throws PortError if the source port is already in use
 * @throws TimeoutError if the server does not respond within the timeout
 * @throws Error if the server responds with an error
 */
export async function queryTcp(address: AddressPort, sourcePort: number, timeout = 3000): Promise<{response: string }> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', (err: PortError) => {
            if (err.code === 'EADDRINUSE') {
                reject(err);
                return;
            }
            reject(err);
        });
        server.listen(sourcePort, () => {
            const connection = net.createConnection({ host: address.host, port: address.port, localPort: sourcePort }, () => {
                // do nothing
            });
            connection.on('data', (data) => {
                server.close();
                resolve({ response: data.toString() });
            });
            connection.on('error', (err: NetError) => {
                server.close();
                reject(err);
            });
            setTimeout(() => {
                server.close();
                reject(new Error('Timeout'));
            }, timeout);
        });
    });
}