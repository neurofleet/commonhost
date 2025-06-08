// socket manager

import * as net from 'net';
import * as dgram from 'dgram';

import { Observable } from "../utilities/reactive/observable";
import { Subject } from "../utilities/reactive/subject";

import { log } from "../utilities/log/log";
import { StringDecoder } from 'string_decoder';

type BufferLoadBytes = number; // 0-1, 0 = empty, 1 = full
type TcpServer =  {
    readonly $rx: Subject<DataStreamFrame>;
    readonly tcpServer: net.Server;
    readonly mode: "open" | "p2p";
    readonly dualstack: boolean;
    lastseen: number;
    readonly ipv4Sockets: Record<`${string}:${number}`, net.Socket>;
    readonly ipv6Sockets: Record<`[${string}]:${number}`, net.Socket>;
}

type UdpSocket =  {
    readonly $rx: Subject<DataStreamFrame>;
    readonly sockethandle: dgram.Socket;
    lastseen: number;
}

export type DataStreamFrame = {
    sourceAddress: string,
    sourcePort: number,
    data: string,
    type: 'tcpOpen' | 'data' | 'tcpClose' | 'tcpError',
    targetAdapter: string,
    targetPort: number
};

type ipv4Key = `${string}:${number}`;
type ipv6Key = `[${string}]:${number}`;

// [adapterip][port]
const tcpIpv4SocketServers: Record<ipv4Key, TcpServer> = {};
const tcpIpv6SocketServers: Record<ipv6Key, TcpServer> = {};
const udpIpv4Sockets: Record<ipv4Key, UdpSocket> = {};
const udpIpv6Sockets: Record<ipv6Key, UdpSocket> = {};


export function listenTcpIpv4(port: number, adapter: string): Observable<DataStreamFrame> {
    const key: ipv4Key = `${adapter}:${port}`;
    if (tcpIpv4SocketServers[key]) {
        return tcpIpv4SocketServers[key].$rx;
    }
    // create dual stack socket if possible, and register in both, otherwise just ipv4
    const ipv6adapter = `::ffff:${adapter}`;
    const ipv6key: ipv6Key = `[${ipv6adapter}]:${port}`;
    if (tcpIpv4SocketServers[ipv6key]) {
        // we have an errant dual stack socket. register it in tcpIpv4Sockets.
        tcpIpv4SocketServers[key] = tcpIpv4SocketServers[ipv6key];
        return tcpIpv4SocketServers[key].$rx;
    } 
    return createTcpIpv4PortListener(port, adapter, key, ipv6key, new Subject<DataStreamFrame>());
}
function createTcpIpv4PortListener(port: number, adapter: string, key: ipv4Key, ipv6key: ipv6Key, $rx: Subject<DataStreamFrame>): Observable<DataStreamFrame> {
    const ipv4Sockets: Record<`${string}:${number}`, net.Socket> = {};
    const ipv6Sockets: Record<`[${string}]:${number}`, net.Socket> = {};
    const tcpServer = net.createServer((socket) => {
        let cleanup = ()=>{};
        if (socket.remoteAddress!.startsWith('::ffff:')) {
            ipv4Sockets[`${socket.remoteAddress!.slice(8, -1)}:${socket.remotePort!}`] = socket;
            ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`] = socket;
            cleanup = () => {
                ipv4Sockets[`${socket.remoteAddress!.slice(8, -1)}:${socket.remotePort!}`].end();
                ipv4Sockets[`${socket.remoteAddress!.slice(8, -1)}:${socket.remotePort!}`].destroy();
                ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`].end();
                ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`].destroy();
                delete ipv4Sockets[`${socket.remoteAddress!.slice(8, -1)}:${socket.remotePort!}`];
                delete ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`];
                cleanup = () => {};
            };
        } else {
            ipv4Sockets[`${socket.remoteAddress!}:${socket.remotePort!}`] = socket;
            cleanup = () => {
                ipv4Sockets[`${socket.remoteAddress!}:${socket.remotePort!}`].end();
                ipv4Sockets[`${socket.remoteAddress!}:${socket.remotePort!}`].destroy();
                delete ipv4Sockets[`${socket.remoteAddress!}:${socket.remotePort!}`];
                cleanup = () => {};
            };
        }
        const remoteAddress = socket.remoteAddress!.startsWith('::ffff:') ? `[${socket.remoteAddress!}]:${socket.remotePort!}` : `${socket.remoteAddress!}:${socket.remotePort!}`
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: remoteAddress,
            type: 'tcpOpen',
            targetAdapter: adapter,
            targetPort: port
        });
        socket.on('data', (data) => {
            tcpIpv4SocketServers[key].lastseen = Date.now();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: data.toString(),
                type: 'data',
                targetAdapter: adapter,
                targetPort: port
            });
        });
        socket.on('close', () => {
            cleanup();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: remoteAddress,
                type: 'tcpClose',
                targetAdapter: adapter,
                targetPort: port
            });
        });
        socket.on('error', (err) => {
            cleanup();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: err.toString(),
                type: 'tcpError',
                targetAdapter: adapter,
                targetPort: port
            });
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: remoteAddress,
                type: 'tcpClose',
                targetAdapter: adapter,
                targetPort: port
            });
        });
    });

        // attempt ipv6 dual stack
        const ipv6adapter = `::ffff:${adapter}`;
        let fallbacktried = false;
        tcpServer.on('error', (err: any) => {
            if(err.code === 'EAFNOSUPPORT' && !fallbacktried) {
                fallbacktried = true;
                tcpServer.listen({
                    host: adapter,
                    port,
                    ipv6Only: false
                })
                return;
            } else $rx.error(err);
        });
        tcpServer.listen({
            host: ipv6adapter,
            port,
            ipv6Only: false
        }, () => {
            console.log(`TCP server listening on [${ipv6adapter}]:${port}`);
        });
        tcpIpv6SocketServers[ipv6key] = {
            $rx,
            tcpServer,
            mode: "open",
            dualstack: true,
            lastseen: Date.now(),
            ipv4Sockets,
            ipv6Sockets
        };
        tcpIpv4SocketServers[key] = tcpIpv6SocketServers[ipv6key];
    return tcpIpv4SocketServers[key].$rx;
}

export function listenTcpIpv6(port: number, adapter: string): Observable<DataStreamFrame> {
    const key: `[${string}]:${number}` = `[${adapter}]:${port}`;
    if (tcpIpv6SocketServers[key]) return tcpIpv6SocketServers[key].$rx;
    // create dual stack socket if it's a masqueraded ipv6 address (::ffff:127.0.0.1), otherwise just ipv6
    if (adapter.startsWith('::ffff:')) {
        const ipv4adapter = adapter.slice(8, -1);
        return listenTcpIpv4(port, ipv4adapter); // ipv4 will create the dual stack socket
    }
    return createTcpIpv6PortListener(port, adapter, key, new Subject<DataStreamFrame>());
}
function createTcpIpv6PortListener(port: number, adapter: string, key: ipv6Key, $rx: Subject<DataStreamFrame>): Observable<DataStreamFrame> {
    const ipv6Sockets: Record<`[${string}]:${number}`, net.Socket> = {};
    const tcpServer = net.createServer((socket) => {
        ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`] = socket;
        let cleanup = () => { 
            ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`].end();
            ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`].destroy();
            delete ipv6Sockets[`[${socket.remoteAddress!}]:${socket.remotePort!}`];
            cleanup = () => {};
        }
        const remoteAddress =`[${socket.remoteAddress!}]:${socket.remotePort!}`
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: remoteAddress,
            type: 'tcpOpen',
            targetAdapter: adapter,
            targetPort: port
        });
        socket.on('data', (data) => {
            tcpIpv6SocketServers[key].lastseen = Date.now();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: data.toString(),
                type: 'data',
                targetAdapter: adapter,
                targetPort: port
            });
        });
        socket.on('close', () => {
            cleanup();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: remoteAddress,
                type: 'tcpClose',
                targetAdapter: adapter,
                targetPort: port
            });
        });
        socket.on('error', (err) => {
            cleanup();
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: err.toString(),
                type: 'tcpError',
                targetAdapter: adapter,
                targetPort: port
            });
            $rx.next({
                sourceAddress: socket.remoteAddress!,
                sourcePort: socket.remotePort!,
                data: remoteAddress,
                type: 'tcpClose',
                targetAdapter: adapter,
                targetPort: port
            });
        });
    });
    
    tcpServer.on('error', (err) => {
        $rx.error(err);
    });
    tcpServer.listen({
        host: adapter,
        port,
        ipv6Only: true
    })

    tcpIpv6SocketServers[key] = {
        $rx,
        tcpServer,
        mode: "open",
        dualstack: false,
        lastseen: Date.now(),
        ipv4Sockets: {},
        ipv6Sockets
    };
    return tcpIpv6SocketServers[key].$rx;
}


export function txTcpIpv4(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number, data: string) : BufferLoadBytes {
    const sourceKey: `${string}:${number}` = `${sourceAdapter}:${sourceport}`;
    const destinationKey: `${string}:${number}` = `${destinationIp}:${destinationPort}`;
    if (!tcpIpv4SocketServers[sourceKey]) {
        throw new Error('no tcp socket listening on ' + sourceKey);
    }
    if (!tcpIpv4SocketServers[sourceKey].ipv4Sockets[destinationKey]) {
        throw new Error('no tcp connection to ' + destinationKey);
    }
    const socket = tcpIpv4SocketServers[sourceKey].ipv4Sockets[destinationKey]
    const success = socket.write(data);
    if(!success) {return Number.POSITIVE_INFINITY}
    return socket.bufferSize;
}
export function tcpIpv4ForceConnect(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number) : Observable<DataStreamFrame> {
    log('warning: the tcp4 port is now dedicated to a p2p connection, and can no longer receive anonymous connections. This is typically a last resort, but elevates the peer ' + destinationIp + ':' + destinationPort + ' to a more central node.', 'warn');
    const sourceKey: `${string}:${number}` = `${sourceAdapter}:${sourceport}`;
    const destinationKey: `${string}:${number}` = `${destinationIp}:${destinationPort}`;
    // 0) grab the $rx subject handle
    const $rx = tcpIpv4SocketServers[sourceKey]?.$rx || new Subject<DataStreamFrame>();
    // 1) terminate the existing server
    tcpIpv4SocketServers[sourceKey]?.tcpServer.close();
    tcpIpv4SocketServers[sourceKey]?.tcpServer.unref();
    delete tcpIpv4SocketServers[sourceKey];
    // 2) connect directly to the destination
    const socket = net.createConnection({ host: destinationIp, port: destinationPort, localAddress: sourceAdapter, localPort: sourceport }, () => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpOpen',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('data', (data) => {
        tcpIpv4SocketServers[sourceKey].lastseen = Date.now();
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: data.toString(),
            type: 'data',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('close', () => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpClose',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('error', (err) => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: err.toString(),
            type: 'tcpError',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpClose',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    // 3) register the connection
    tcpIpv4SocketServers[sourceKey] = {
        $rx,
        tcpServer:  {
            close: () => {
                Object.values(tcpIpv4SocketServers[sourceKey].ipv4Sockets).forEach(socket => {
                    socket.end();
                    socket.destroy();
                });
                Object.values(tcpIpv4SocketServers[sourceKey].ipv6Sockets).forEach(socket => {
                    socket.end();
                    socket.destroy();
                });
            },
            unref: () => {}
        } as any,
        mode: "p2p",
        dualstack: false,
        lastseen: Date.now(),
        ipv4Sockets: {
            [destinationKey]: socket
        },
        ipv6Sockets: {}
    };
    return $rx;
}
export function revertTcpIpv4ToListener(sourceport: number, sourceAdapter: string) {
    const sourceKey: `${string}:${number}` = `${sourceAdapter}:${sourceport}`;
    if (!tcpIpv4SocketServers[sourceKey]) {
        throw new Error('no tcp socket listening on ' + sourceKey);
    }
    if (tcpIpv4SocketServers[sourceKey].mode !== "p2p") {
        return;
    }
    // 0) grab the $rx subject handle
    const $rx = tcpIpv4SocketServers[sourceKey].$rx;
    // 1) terminate the existing server
    tcpIpv4SocketServers[sourceKey].tcpServer.close();
    tcpIpv4SocketServers[sourceKey].tcpServer.unref();
    delete tcpIpv4SocketServers[sourceKey];
    // 2) create a new server
    const ipv6SourceKey: ipv6Key = `[::ffff:${sourceAdapter.slice(1, -1)}]:${sourceport}`;
    return createTcpIpv4PortListener(sourceport, sourceAdapter, sourceKey, ipv6SourceKey, $rx);
}

export function txTcpIpv6(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number, data: string): BufferLoadBytes {
    const sourceKey: `[${string}]:${number}` = `[${sourceAdapter}]:${sourceport}`;
    const destinationKey: `[${string}]:${number}` = `[${destinationIp}]:${destinationPort}`;
    if (!tcpIpv6SocketServers[sourceKey]) {
        throw new Error('no tcp socket listening on ' + sourceKey);
    }
    if (!tcpIpv6SocketServers[sourceKey].ipv6Sockets[destinationKey]) {
        throw new Error('no tcp connection to ' + destinationKey);
    }
    const socket = tcpIpv6SocketServers[sourceKey].ipv6Sockets[destinationKey];
    const success = socket.write(data);
    if(!success) {return Number.POSITIVE_INFINITY}
    return socket.bufferSize;
}

export function tcpIpv6ForceConnect(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number) {
    log('warning: the tcp6 port is now dedicated to a p2p connection, and can no longer receive anonymous connections. This is typically a last resort, but elevates the peer [' + destinationIp + ']:' + destinationPort + ' to a more central node.', 'warn');
    const sourceKey: `[${string}]:${number}` = `[${sourceAdapter}]:${sourceport}`;
    const destinationKey: `[${string}]:${number}` = `[${destinationIp}]:${destinationPort}`;
    // 0) grab the $rx subject handle
    const $rx = tcpIpv6SocketServers[sourceKey]?.$rx || new Subject<DataStreamFrame>();
    // 1) terminate the existing server
    tcpIpv6SocketServers[sourceKey].tcpServer.close();
    tcpIpv6SocketServers[sourceKey].tcpServer.unref();
    delete tcpIpv6SocketServers[sourceKey];
    // 2) connect directly to the destination
    const socket = net.createConnection({ host: destinationIp, port: destinationPort, localAddress: sourceAdapter, localPort: sourceport }, () => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpOpen',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('data', (data) => {
        tcpIpv6SocketServers[sourceKey].lastseen = Date.now();
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: data.toString(),
            type: 'data',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('close', () => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpClose',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    socket.on('error', (err) => {
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: err.toString(),
            type: 'tcpError',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
        $rx.next({
            sourceAddress: socket.remoteAddress!,
            sourcePort: socket.remotePort!,
            data: destinationKey,
            type: 'tcpClose',
            targetAdapter: sourceAdapter,
            targetPort: sourceport
        });
    });
    // 3) register the connection
    tcpIpv6SocketServers[sourceKey] = {
        $rx,
        tcpServer: {
            close: () => {
                Object.values(tcpIpv6SocketServers[sourceKey].ipv6Sockets).forEach(socket => {
                    socket.end();
                    socket.destroy();
                });
            },
            unref: () => {}
        } as any,
        mode: "p2p",
        dualstack: false,
        lastseen: Date.now(),
        ipv4Sockets: {},
        ipv6Sockets: {
            [destinationKey]: socket
        }
    };
    return $rx;
}

export function revertTcpIpv6ToListener(sourceport: number, sourceAdapter: string) {
    const sourceKey: `[${string}]:${number}` = `[${sourceAdapter}]:${sourceport}`;
    if (!tcpIpv6SocketServers[sourceKey]) {
        throw new Error('no tcp socket listening on ' + sourceKey);
    }
    if (tcpIpv6SocketServers[sourceKey].mode !== "p2p") {
        return;
    }
    // 0) grab the $rx subject handle
    const $rx = tcpIpv6SocketServers[sourceKey].$rx;
    // 1) terminate the existing server
    tcpIpv6SocketServers[sourceKey].tcpServer.close();
    tcpIpv6SocketServers[sourceKey].tcpServer.unref();
    delete tcpIpv6SocketServers[sourceKey];
    // 2) create a new server
    return createTcpIpv6PortListener(sourceport, sourceAdapter, sourceKey, $rx);
}




export function listenUdpIpv4(port: number, adapter: string): Observable<DataStreamFrame> {
    const key: `${string}:${number}` = `${adapter}:${port}`;
    if (udpIpv4Sockets[key]) return udpIpv4Sockets[key].$rx;
    const $rx = new Subject<DataStreamFrame>();
    const sockethandle = dgram.createSocket('udp4');
    sockethandle.bind({address: adapter, port});
    sockethandle.addListener("message", (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        $rx.next({
            sourceAddress: rinfo.address,
            sourcePort: rinfo.port,
            data: msg.toString(),
            type: 'data',
            targetAdapter: adapter,
            targetPort: port
        });
    });
    sockethandle.addListener("error", (err: Error) => {
        $rx.error(err);
    });
    udpIpv4Sockets[key] = {
        $rx,
        sockethandle,
        lastseen: Date.now()
    };
    return udpIpv4Sockets[key].$rx;
}

export function listenUdpIpv6(port: number, adapter: string): Observable<DataStreamFrame> {
    const key: `[${string}]:${number}` = `[${adapter}]:${port}`;
    if (udpIpv6Sockets[key]) return udpIpv6Sockets[key].$rx;
    const $rx = new Subject<DataStreamFrame>();
    const sockethandle = dgram.createSocket('udp6');
    sockethandle.bind({address: adapter, port});
    sockethandle.addListener("message", (msg: Buffer, rinfo: dgram.RemoteInfo) => {
        $rx.next({
            sourceAddress: rinfo.address,
            sourcePort: rinfo.port,
            data: msg.toString(),
            type: 'data',
            targetAdapter: adapter,
            targetPort: port
        });
    });
    udpIpv6Sockets[key] = {
        $rx,
        sockethandle,
        lastseen: Date.now()
    };
    return udpIpv6Sockets[key].$rx;
}

export function txUdpIpv4(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number, data: string) {
    const key: `${string}:${number}` = `${sourceAdapter}:${sourceport}`;
    if (!udpIpv4Sockets[key]) {
        throw new Error('no udp socket listening on ' + key);
    }
    udpIpv4Sockets[key].sockethandle.send(data, destinationPort, destinationIp);
    return;
}

export function txUdpIpv6(sourceport: number, sourceAdapter: string, destinationIp: string, destinationPort: number, data: string) {
    const key: `[${string}]:${number}` = `[${sourceAdapter}]:${sourceport}`;
    if (!udpIpv6Sockets[key]) {
        throw new Error('no udp socket listening on ' + key);
    }
    udpIpv6Sockets[key].sockethandle.send(data, destinationPort, destinationIp);
    udpIpv6Sockets[key].lastseen = Date.now();
    return;
}

export function purge() {
    // delete all servers and sockets
    for (const key in tcpIpv4SocketServers) {
        // close all sockets
        Object.values(tcpIpv4SocketServers[key as any].ipv4Sockets).forEach(socket => {
            socket.end();
            socket.destroy();
        });
        Object.values(tcpIpv4SocketServers[key as any].ipv6Sockets).forEach(socket => {
            socket.end();
            socket.destroy();
        });
        // close all servers
        tcpIpv4SocketServers[key as any].tcpServer.close();
        tcpIpv4SocketServers[key as any].tcpServer.unref();
        delete tcpIpv4SocketServers[key as any];
    }
    for (const key in tcpIpv6SocketServers) {
        // close all sockets
        Object.values(tcpIpv6SocketServers[key as any].ipv6Sockets).forEach(socket => {
            socket.end();
            socket.destroy();
        });
        // close all servers
        tcpIpv6SocketServers[key as any].tcpServer.close();
        tcpIpv6SocketServers[key as any].tcpServer.unref();
        delete tcpIpv6SocketServers[key as any];
    }
    for (const key in udpIpv4Sockets) {
        udpIpv4Sockets[key as any].sockethandle.close();
        udpIpv4Sockets[key as any].sockethandle.unref();
        delete udpIpv4Sockets[key as any];
    }
    for (const key in udpIpv6Sockets) {
        udpIpv6Sockets[key as any].sockethandle.close();
        udpIpv6Sockets[key as any].sockethandle.unref();   
        delete udpIpv6Sockets[key as any];
    }
}


