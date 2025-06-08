// it should resolve ip addresses of a hostname correctly
// as a reference, we'll use the most stable STUNT candidate

// run this file with
// bash: (out of src1)
// npm run build && node ts-js-out/transport/dns.spec.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/dns.spec.js

import { resolveLocator } from './dns.js';
import { tstunServers } from './stunt_servers.js';
import { assert } from '../utilities/testutilities/assert.js';
import { it } from '../utilities/testutilities/it.js';
import { describe, } from '../utilities/testutilities/describe.js';


describe('resolveLocator', () => {
    it('should be able to turn an ipv4 address:port into an Address object', async () => {
        const inputAddress = '127.0.0.1:1234';
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length === 1, 'should have returned 1 address');
        assert(addresses[0].family === 'IPv4', 'should have returned an IPv4 address');
        assert(addresses[0].host === '127.0.0.1', 'should have returned the correct host');
        assert(addresses[0].port === 1234, 'should have returned the correct port');
    });

    it('should be able to turn an ipv6 address:port into an Address object', async () => {
        const inputAddress = '[::1]:1234';
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length === 1, 'should have returned 1 address');
        assert(addresses[0].family === 'IPv6', 'should have returned an IPv6 address');
        assert(addresses[0].host === '::1', 'should have returned the correct host');
        assert(addresses[0].port === 1234, 'should have returned the correct port');
    });

    it('should be able to turn an ipv4 mapped ipv6 address:port into an IPv4 Address object', async () => {
        const inputAddress = '[::ffff:127.0.0.1]:1234';
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length === 1, 'should have returned 1 address');
        assert(addresses[0].family === 'IPv4', 'should have returned an IPv4 address');
        assert(addresses[0].host === '127.0.0.1', 'should have returned the correct host');
        assert(addresses[0].port === 1234, 'should have returned the correct port');
    });

    it('should be able to turn a hostname:port into an array of Address objects', async () => {
        const inputAddress = tstunServers[0].url;
        // inputaddress should be a valid hostname:port
        assert(inputAddress.includes(':'), 'should have a port');
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        for (const address of addresses) {
            assert(address.family === 'IPv4' || address.family === 'IPv6', 'should have returned an IPv4 or IPv6 address');
            assert(address.port === 5000, 'should have returned the correct port');
        }
    });

    it('should be able to turn a hostname:port with a protocol into an array of Address objects', async () => {
        const inputAddress = 'http://' + tstunServers[0].url;
        // inputaddress should be a valid hostname:port
        assert(inputAddress.includes(':'), 'should have a port');
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        for (const address of addresses) {
            assert(address.family === 'IPv4' || address.family === 'IPv6', 'should have returned an IPv4 or IPv6 address');
            assert(address.port === 5000, 'should have returned the correct port');
            assert(address.protocol === 'http', 'should have returned the correct protocol');
        }

    });

    it('should be able to turn a hostname:port with a protocol and resource into an array of Address objects', async () => {
        const inputAddress = 'http://' + tstunServers[0].url + '/api/v1/data';
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        for (const address of addresses) {
            assert(address.family === 'IPv4' || address.family === 'IPv6', 'should have returned an IPv4 or IPv6 address');
            assert(address.port === 5000, 'should have returned the correct port');
            assert(address.protocol === 'http', 'should have returned the correct protocol');
            assert(address.resource === '/api/v1/data', 'should have returned the correct resource');
        }
    });

    it('should be able to turn a hostname:port with a protocol, resource, and fragment into an array of Address objects', async () => {
        const inputAddress = 'http://' + tstunServers[0].url + '/api/v1/data#top';
        const addresses = await resolveLocator(inputAddress);
        //debug console.log("addresses:", addresses);
        assert(addresses.length > 0, 'should have returned at least 1 address');
        for (const address of addresses) {
            assert(address.family === 'IPv4' || address.family === 'IPv6', 'should have returned an IPv4 or IPv6 address');
            assert(address.port === 5000, 'should have returned the correct port');
            assert(address.protocol === 'http', 'should have returned the correct protocol');
            assert(address.resource === '/api/v1/data', 'should have returned the correct resource');
            assert(address.fragment === '#top', 'should have returned the correct fragment');
        }
    });

    it('should be able to turn an ipv4 address:port with a protocol, resource, and fragment into an Address object', async () => {
        const inputAddress = 'http://127.0.0.1:1234/api/v1/data#top';
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length === 1, 'should have returned 1 address');
        const address = addresses[0];
        assert(address.family === 'IPv4', 'should have returned an IPv4 address');
        assert(address.host === '127.0.0.1', 'should have returned the correct host');
        assert(address.port === 1234, 'should have returned the correct port');
        assert(address.protocol === 'http', 'should have returned the correct protocol');
        assert(address.resource === '/api/v1/data', 'should have returned the correct resource');
        assert(address.fragment === '#top', 'should have returned the correct fragment');
    });

    it('should be able to turn an ipv6 address:port with a protocol, resource, and fragment into an Address object', async () => {
        const inputAddress = 'http://[::1]:1234/api/v1/data#top'; 
        const addresses = await resolveLocator(inputAddress);
        assert(addresses.length === 1, 'should have returned 1 address');
        const address = addresses[0];
        assert(address.family === 'IPv6', 'should have returned an IPv6 address');
        assert(address.host === '::1', 'should have returned the correct host');
        assert(address.port === 1234, 'should have returned the correct port');
        assert(address.protocol === 'http', 'should have returned the correct protocol');
        assert(address.resource === '/api/v1/data', 'should have returned the correct resource');
        assert(address.fragment === '#top', 'should have returned the correct fragment');
    });












});

