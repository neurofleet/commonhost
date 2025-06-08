> [!WARNING]
> not operable yet.
> version: 0.0.0 : there still is a lot of work left.

# commonhost
Make two devices believe they're sharing the same localhost.

## Problem statement:

Device A can ping device B, but device B can't ping device A. 

Why? Well, you can try to drop your firewalls, you can try to open some ports, you can try and call your ISP, you can try and pay for a static IP. You can try to figure out if you're behind a CGNAT or symNAT. 


## TODO/roadmap:

- [ ] implement ED25519 signature
- [ ] implement x25519 encryption
- [ ] implement dilithium signature
- [ ] implement kyber encryption
- [ ] support dns/dynamic dns (e.g. afraid.org)
- [ ] implement bridging over peer (a <-> b <-> c </> a, a <-(b)-> c)
- [ ] implement peer meshing
- [ ] improve network change detection and support re-icing.
- [ ] support fully bidirectional TCP ports

