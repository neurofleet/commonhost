
function settify(networkInterfaces: {
    [iface: string]: {
        address: string;
        netmask: string;
        family: string;
        mac: string;
        internal: boolean;
        cidr: string;
        scopeid?: number;
    }[];
}) : Set<string>{
    const result = new Set<string>();
    for (const iface in networkInterfaces) {
        for (const address of networkInterfaces[iface]) {
            result.add(`${iface};${address.address}`);
        }
    }
    return result;
}

let memoKey: any = {}
let memoValue: Set<string> = new Set();

export function areNetworkInterfacesEqual(a: {
    [iface: string]: {
        address: string;
        netmask: string;
        family: string;
        mac: string;
        internal: boolean;
        cidr: string;
        scopeid?: number;
    }[];
}, b: {
    [iface: string]: {
        address: string;
        netmask: string;
        family: string;
        mac: string;
        internal: boolean;
        cidr: string;
        scopeid?: number;
    }[];
}) : boolean {
    const aSet = (a === memoKey) ? memoValue : settify(a);
    const bSet = settify(b);
    if (aSet.size !== bSet.size) return false;
    for (const item of aSet) {
        if (!bSet.has(item)) return false;
    }
    memoKey = b;
    memoValue = bSet;
    return true;
}