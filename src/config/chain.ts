// PulseChain chain definition for viem/wagmi.
//
// NOTE: Multicall3 is NOT deployed at the canonical address
// (0xcA11bde05977b36311670288639bE2f1c75a2fD6) on PulseChain — verified via eth_getCode
// (returns 0x). Therefore this chain does NOT register a multicall3 contract, and reads use
// parallel eth_call/s (Promise.all of readContract) rather than viem's aggregate multicall.
import { defineChain } from "viem";
import { RPC_URLS } from "./rpc";

export const pulsechain = defineChain({
  id: 369,
  name: "PulseChain",
  nativeCurrency: {
    name: "Pulse",
    symbol: "PLS",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [...RPC_URLS] },
    public: { http: [...RPC_URLS] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://ipfs.scan.pulsechain.com",
      apiUrl: "https://api.scan.pulsechain.com",
    },
  },
  testnet: false,
});
