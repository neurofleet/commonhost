
import { gatherNetworkCandidates, NetworkCandidate } from '../transport/gatherCandidates.js';


export type IceCandidate = {
    address: string;
    port: number;
    type: 'local' | 'stun' | 'vpn' | 'virtual' | 'stun hypothesis';
    family: 'IPv4' | 'IPv6';
    protocol: 'tcp' | 'udp';
    source?: string; // e.g., 'eth0', 'stun.l.google.com', 'tailscale'
    natType?: string;
    natInfo?: any;
}

/**
    interval: 
    new = os.getnetworkinterfaces()
    same = areNetworkInterfacesEqual(last, new)
    last = new
    if(!same) escalate 

    but! interval should probably be determined by an "aggressivity" metric. 
    STUN/STUNT should also be rerolled periodically
    more frequently if adapter is idle, probably.
 */

export function createIceDocument(tcp_ports: number[], udp_ports: number[]): IceCandidate[] {
    return []

    

}

async function gatherLocalNetworkCandidates(): Promise<NetworkCandidate[]>{
    return gatherNetworkCandidates();

}
async function gatherTcpStuntCandidates(): Promise<NetworkCandidate[]>{
    return []


}
async function gatherUdpStunCandidates(): Promise<NetworkCandidate[]>{
    return []
}
