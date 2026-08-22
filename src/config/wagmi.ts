// wagmi config: PulseChain only, injected (EIP-1193) connector, fallback RPC transport.
// WalletConnect is intentionally not configured (would need a projectId). The injected
// connector covers MetaMask/Rabby/etc. — the wallets actually used on PulseChain.
import { http, createConfig, createStorage, fallback } from "wagmi";
import { injected } from "wagmi/connectors";
import { pulsechain } from "./chain";
import { RPC_URLS } from "./rpc";

export const wagmiConfig = createConfig({
  chains: [pulsechain],
  connectors: [injected()],
  transports: {
    [pulsechain.id]: fallback(
      RPC_URLS.map((url) => http(url, { timeout: 20_000 })),
      { rank: true, retryCount: 3, retryDelay: 500 },
    ),
  },
  multiInjectedProviderDiscovery: false,
  ssr: false,
  storage: createStorage({ storage: localStorage, key: "aff-terminal" }),
});
