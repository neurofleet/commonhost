// given an unused port, it should return a valid response from a working remote server.
// for validation, we'll use the most stable server from tstunServers.ts

// run this file with
// bash: (out of src1)
// npm run build && node ts-js-out/transport/tcp.spec.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/tcp.spec.js

import { queryTcp } from './tcp.js';
import { tstunServers } from './stunt_servers.js';
import { assert } from '../utilities/testutilities/assert.js';
import { it } from '../utilities/testutilities/it.js';
import { describe, } from '../utilities/testutilities/describe.js';
import { resolveLocator, AddressPort } from './dns.js';
import * as net from 'net';

describe('queryTCP', () => {
    it('should return a valid response from a working remote server', async () => {
        const url = tstunServers[0].url;
        const addresses = await resolveLocator(url);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        const address = addresses[0] as AddressPort;
        assert(address.port !== undefined, 'should have returned a port');
        
        // find a free port
        let sourcePort = 0;
        const server = net.createServer();
        server.listen(sourcePort, () => {
            sourcePort = (server.address() as net.AddressInfo).port;
            server.close();
        });

        const response = await queryTcp(address, sourcePort);
        assert(response !== undefined, 'should have returned a response');
        assert(response instanceof Error === false, 'should not have returned an error');
        assert(response.response.length > 0, 'should have returned a non-empty response');
    });

    it('should return an error if the source port is already in use', async () => {
        const url = tstunServers[0].url;
        const addresses = await resolveLocator(url);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        const address = addresses[0] as AddressPort;
        assert(address.port !== undefined, 'should have returned a port');
        
        // find a free port
        let sourcePort = 0;
        const server = net.createServer();
        server.listen(sourcePort, () => {
            sourcePort = (server.address() as net.AddressInfo).port;
        });

        // occupy the port
        const server2 = net.createServer();
        server2.listen(sourcePort, async () => {
            try {
                const response = await queryTcp(address, sourcePort) as any;
                //debug console.log("response: ", response);
                assert(false, 'should have thrown an error');
            } catch (err) {
                //debug console.log("error: ", err);
                assert(err instanceof Error, 'should have thrown an error');
                assert((err as any).code === 'EADDRINUSE', 'should have thrown an EADDRINUSE error');
            } finally {
                server.close();
                server2.close();
            }
        });
    });


    it('should should be able to use the same port with two different queries, as long as they are not simultaneous', async () => {
        const url = tstunServers[0].url;
        const addresses = await resolveLocator(url);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        const address = addresses[0] as AddressPort;
        assert(address.port !== undefined, 'should have returned a port');
        
        // find a free port
        let sourcePort = 0;
        const server = net.createServer();
        server.listen(sourcePort, () => {
            sourcePort = (server.address() as net.AddressInfo).port;
            server.close();
        });
        
        const response1 = await queryTcp(address, sourcePort);
        assert(response1 !== undefined, 'should have returned a response');
        assert(response1 instanceof Error === false, 'should not have returned an error');
        assert(response1.response.length > 0, 'should have returned a non-empty response');

        const response2 = await queryTcp(address, sourcePort);
        assert(response2 !== undefined, 'should have returned a response');
        assert(response2 instanceof Error === false, 'should not have returned an error');
        assert(response2.response.length > 0, 'should have returned a non-empty response');
    });




});
