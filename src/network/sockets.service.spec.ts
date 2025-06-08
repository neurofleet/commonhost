// run this file with
// bash: (out of src)
// npm run build && node --enable-source-maps ts-js-out/network/sockets.service.spec.js
// old ps: (out of src)
// npm run build; node --enable-source-maps ts-js-out/network/sockets.service.spec.js

import { assert } from "../utilities/testutilities/assert.js";
import { it } from "../utilities/testutilities/it.js";
import { describe, } from "../utilities/testutilities/describe.js";
import { listenTcpIpv4, listenTcpIpv6, txTcpIpv4, txTcpIpv6, purge, tcpIpv4ForceConnect, tcpIpv6ForceConnect, revertTcpIpv4ToListener, revertTcpIpv6ToListener, txUdpIpv4, listenUdpIpv4, txUdpIpv6, listenUdpIpv6 } from "./sockets.service.js";
import { Future } from "../utilities/future/future.js";
import * as net from 'net';
import * as dgram from 'dgram';

// make an udp port, and send from another udp port, see if it goes through

describe('sockets service', async () => {
    await it('should be able to send and receive udp ipv4', async () => {
        return new Promise((resolve, reject) => {
            const rxport = 12345;
            const txport = 12346;
            const rxadapter = '127.0.0.1';
            const txadapter = '127.0.0.1';
            const $rx = listenUdpIpv4(rxport, rxadapter);
            const $txrx = listenUdpIpv4(txport, txadapter); // open port for transmission
            const data = 'hello world udp4';
            const received: string[] = [];
            $rx.subscribe((frame) => {
                if (frame.type === 'data') {
                    received.push(frame.data);
                    if (received.length === 1) {
                        console.log(received)
                        resolve();
                        purge();
                    }
                }
            });
            txUdpIpv4(txport, txadapter, rxadapter, rxport, data);
            setTimeout(() => {
                reject(new Error('timeout'));
                purge();
            }, 1000);
        });
    });
    await it('should be able to send and receive udp ipv6', async () => {
        return new Promise((resolve, reject) => {
            const rxport = 12347;
            const txport = 12348;
            const rxadapter = '::1';
            const txadapter = '::1';
            const $rx = listenUdpIpv6(rxport, rxadapter);
            const $txrx = listenUdpIpv6(txport, txadapter); // open port for transmission
            const data = 'hello world udp6';
            const received: string[] = [];
            $rx.subscribe((frame) => {
                if (frame.type === 'data') {
                    received.push(frame.data);
                    if (received.length === 1) {
                        console.log(received)
                        resolve();
                        purge();
                    }
                }
            });
            txUdpIpv6(txport, txadapter, rxadapter, rxport, data);
            setTimeout(() => {
                reject(new Error('timeout'));
                purge();
            }, 1000);
        });
    });

    // tcp
    await it('should be able to send and receive tcp ipv4', async () => {
        return new Promise((resolve, reject) => {
            const rxport = 12349;
            const txport = 12350;
            const rxadapter = '127.0.0.1';
            const txadapter = '127.0.0.1';
            const $rx = listenTcpIpv4(rxport, rxadapter);
            const $txrx = listenTcpIpv4(txport, txadapter); // open port for transmission
            const data = 'hello world tcp4';
            const received: string[] = [];
            $rx.subscribe((frame) => {
                if (frame.type === 'data') {
                    received.push(frame.data);
                    if (received.length === 1) {
                        console.log("received tcp4:", received)
                        resolve();
                        purge();
                    }
                }
            });
            tcpIpv4ForceConnect(txport, txadapter, rxadapter, rxport).subscribe(
                (frame) => {
                    if (frame.type === 'tcpOpen') {
                        txTcpIpv4(txport, txadapter, rxadapter, rxport, data);
                    }
                }
            );
            setTimeout(() => {
                reject(new Error('timeout'));
                purge();
            }, 1000);
        });
    });
    await it('should be able to send and receive tcp ipv6', async () => {
        return new Promise((resolve, reject) => {
            const rxport = 12351;
            const txport = 12352;
            const rxadapter = '::1';
            const txadapter = '::1';
            const $rx = listenTcpIpv6(rxport, rxadapter);
            const $txrx = listenTcpIpv6(txport, txadapter); // open port for transmission
            const data = 'hello world tcp6';
            const received: string[] = [];
            $rx.subscribe((frame) => {
                if (frame.type === 'data') {
                    received.push(frame.data);
                    if (received.length === 1) {
                        console.log(received)
                        resolve();
                        purge();
                    }
                }
            });
            tcpIpv6ForceConnect(txport, txadapter, rxadapter, rxport).subscribe(
                (frame) => {
                    if (frame.type === 'tcpOpen') {
                        txTcpIpv6(txport, txadapter, rxadapter, rxport, data);
                    }
                }
            );
            setTimeout(() => {
                reject(new Error('timeout'));
                purge();
            }, 1000);
        });
    });


    await it('should emit an error when trying to listen on an already used TCP port', async () => {
        return await new Promise((resolve, reject) => {
            const port = 12360;
            const adapter = '127.0.0.1';
            
            // Create a raw TCP server to occupy the port
            const rawServer = net.createServer();
            rawServer.listen(port, adapter, () => {
                console.log(`Raw TCP server listening on ${adapter}:${port}`);
                
                // Now try to create our managed socket on the same port
                const $rx = listenTcpIpv4(port, adapter);
                
                let errorReceived = false;
                                
                // If we don't get an error within 1 second, the test fails
                const timeout = setTimeout(() => {
                    if (!errorReceived) {
                        reject(new Error('Did not receive EADDRINUSE error'));
                    }
                    rawServer.close();
                    purge();
                }, 1000);

                $rx.subscribe(
                    (data) => {
                        console.warn("unexpected data received:", data)
                        // We shouldn't get here
                        rawServer.close();
                        purge();
                        reject({msg: "shouldn't get here. received data:", data});
                    },
                    (err) => {
                        console.log("Received expected error:", err.message);
                        errorReceived = true;
                        clearTimeout(timeout);
                        
                        // Clean up
                        rawServer.close();
                        purge();
                        resolve();
                    }
                );


            });
            
            rawServer.on('error', (err) => {
                console.error('Raw server error:', err);
                reject(err);
            });
        });
    });

    await it('should emit an error when trying to listen on an already used UDP port', async () => {
        return await new Promise((resolve, reject) => {
            const port = 12361;
            const adapter = '127.0.0.1';
            
            // Create a raw UDP socket to occupy the port
            const rawSocket = dgram.createSocket('udp4');
            
            rawSocket.on('error', (err) => {
                console.error('Raw UDP socket error:', err);
                reject(err);
            });
            
            rawSocket.bind(port, adapter, () => {
                console.log(`Raw UDP socket bound to ${adapter}:${port}`);
                
                // Now try to create our managed socket on the same port
                const $rx = listenUdpIpv4(port, adapter);
                
                let errorReceived = false;
                
                // If we don't get an error within 1 second, the test fails
                const timeout = setTimeout(() => {
                    if (!errorReceived) {
                        reject(new Error('Did not receive EADDRINUSE error'));
                    }
                    rawSocket.close();
                    purge();
                }, 1000);

                // listen
                $rx.subscribe(
                    (data) => {
                        // We shouldn't get here
                        rawSocket.close();
                        purge();
                        reject({msg: "shouldn't get here. received data:", data});
                    },
                    (err) => {
                        console.log("Received expected error:", err.message);
                        errorReceived = true;
                        clearTimeout(timeout);
                        
                        // Clean up
                        rawSocket.close();
                        purge();
                        resolve();
                    }
                );
            });
        });
    });





});
