import { NetworkCandidate } from './gatherCandidates.js';
import { stunServers, StunServerAddress } from './stun_servers.js';
type SessionDescriptionProtocol = string;

export type PeerDefinition = {
    definitionVersion: '1.1.0',
    name?: string, // self-assigned device name, optional
    signatureKey: string,
    encryptionKey: string,
    tcpCandidates: NetworkCandidate[],
    udpCandidates: NetworkCandidate[],
    rtcCandidates: SessionDescriptionProtocol[],
};

export class PeerConnection {

}