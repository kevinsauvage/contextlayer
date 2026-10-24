# ADR 0007: No shared Redis cache

Status: accepted. A shared Redis cache was rejected: the cart must read a consistent snapshot, and the operational cost of another datastore was not justified by the measured load.
