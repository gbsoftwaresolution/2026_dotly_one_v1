// Centralized BIP-39 English wordlist export.
//
// Note: The canonical wordlist array currently lives in ../recovery.ts.
// We re-export it from here so sharing/recovery can share one source and so we
// can later move the array into this module without changing import sites.

export { BIP39_EN_WORDLIST } from "../recovery";
