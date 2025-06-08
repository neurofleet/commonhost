// run this file with
// bash: (out of src1)
// npm run build && node --enable-source-maps ts-js-out/ice/compareNetworkInterfacesList.spec.js
// old ps: (out of src1)
// npm run build; node --enable-source-maps ts-js-out/ice/compareNetworkInterfacesList.spec.js

import { assert } from "../utilities/testutilities/assert";
import { describe } from "../utilities/testutilities/describe";
import { it } from "../utilities/testutilities/it";
import { areNetworkInterfacesEqual } from "./compareNetworkInterfacesList";

const sampleNetworkInterfaces = {
  lo: [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '127.0.0.1/8'
    },
    {
      address: '::1',
      netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
      family: 'IPv6',
      mac: '00:00:00:00:00:00',
      scopeid: 0,
      internal: true,
      cidr: '::1/128'
    }
  ],
  eth0: [
    {
      address: '192.168.0.10',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: 'aa:bb:cc:dd:ee:ff',
      internal: false,
      cidr: '192.168.0.10/24'
    },
    {
      address: 'fe80::1a2b:3c4d:5e6f:7g8h',
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: 'aa:bb:cc:dd:ee:ff',
      scopeid: 2,
      internal: false,
      cidr: 'fe80::1a2b:3c4d:5e6f:7g8h/64'
    }
  ],
  wlan0: [
    {
      address: '10.0.0.42',
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: 'de:ad:be:ef:00:01',
      internal: false,
      cidr: '10.0.0.42/24'
    },
    {
      address: 'fe80::feed:face:cafe:beef',
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: 'de:ad:be:ef:00:01',
      scopeid: 3,
      internal: false,
      cidr: 'fe80::feed:face:cafe:beef/64'
    }
  ]
}


describe('areNetworkInterfacesEqual', () => {
    it('should return true for equal network interfaces', () => {
        const alternative = JSON.parse(JSON.stringify(sampleNetworkInterfaces));
        assert(areNetworkInterfacesEqual(sampleNetworkInterfaces, alternative));
    });
    it('should return false for unequal network interfaces', () => {
        const modified = JSON.parse(JSON.stringify(sampleNetworkInterfaces));
        modified.eth0[0].address = '192.168.0.11';
        assert(!areNetworkInterfacesEqual(sampleNetworkInterfaces, modified));
    });
});
