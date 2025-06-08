// This file is AI generated.
// Test file for candidateGatherer.ts

// run with:
// bash: (out of src1)
// npm run build && node ts-js-out/transport/test_candidates.js
// old ps: (out of src1)
// npm run build; node ts-js-out/transport/test_candidates.js

import { gatherNetworkCandidates, NetworkCandidate } from './gatherCandidates.js';

async function testNetworkCandidates() {
  console.log('Gathering network candidates...');
  
  try {
    const candidates = await gatherNetworkCandidates();
    
    console.log('\n=== Network Candidates ===');
    console.log(`Total candidates found: ${candidates.length}`);
    
    // Group by type
    const byType = candidates.reduce((acc, candidate) => {
      acc[candidate.type] = acc[candidate.type] || [];
      acc[candidate.type].push(candidate);
      return acc;
    }, {} as Record<string, NetworkCandidate[]>);
    
    // Group by type and protocol
    const byTypeAndProtocol = candidates.reduce((acc, candidate) => {
      const key = `${candidate.type}-${candidate.protocol}`;
      acc[key] = acc[key] || [];
      acc[key].push(candidate);
      return acc;
    }, {} as Record<string, NetworkCandidate[]>);
    
    // Print summary by type with protocol breakdown
    console.log('\n=== Summary by Type ===');
    for (const [type, typeCandidates] of Object.entries(byType)) {
      const tcpCount = typeCandidates.filter(c => c.protocol === 'tcp').length;
      const udpCount = typeCandidates.filter(c => c.protocol === 'udp').length;
      console.log(`${type}: ${typeCandidates.length} candidates (${tcpCount} tcp, ${udpCount} udp)`);
    }
    
    // Print summary by family (IPv4/IPv6)
    const byFamily = candidates.reduce((acc, candidate) => {
      acc[candidate.family] = acc[candidate.family] || [];
      acc[candidate.family].push(candidate);
      return acc;
    }, {} as Record<string, NetworkCandidate[]>);
    
    console.log('\n=== Summary by IP Family ===');
    for (const [family, familyCandidates] of Object.entries(byFamily)) {
      console.log(`${family}: ${familyCandidates.length} candidates`);
    }
    
    
    // Print details for each candidate
    console.log('\n=== Candidate Details ===');
    candidates.forEach((candidate, index) => {
      console.log(`\nCandidate #${index + 1}:`);
      console.log(`  Address: ${candidate.address}`);
      console.log(`  Type: ${candidate.type}`);
      console.log(`  Family: ${candidate.family}`);
      console.log(`  Protocol: ${candidate.protocol}`);
      console.log(`  Source: ${candidate.source || 'unknown'}`);
      
      if (candidate.natType) {
        console.log(`  NAT Type: ${candidate.natType}`);
        
        if (candidate.natInfo) {
          if (candidate.natInfo.publicIps) {
            console.log(`  Mapped Addresses: ${Array.from(candidate.natInfo.publicIps).join(', ')}`);
          }
          if (candidate.natInfo.publicPorts) {
            console.log(`  Mapped Ports: ${Array.from(candidate.natInfo.publicPorts).join(', ')}`);
          }
        }
      }
    });
    
    

  } catch (error) {
    console.error('Error gathering network candidates:', error);
  }
}

// Run the test
testNetworkCandidates().catch(console.error);

// To run this test:
// npm run build && node ts-js-out/transport/test_candidates.js

