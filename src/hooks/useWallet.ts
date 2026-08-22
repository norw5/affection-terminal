import { pulsechain } from "@/config/chain";
// Wallet facade over wagmi. The portal uses the `injected()` connector only (EIP-1193 wallets
// like MetaMask/Rabby), so WalletConnect/MetaMask-SDK deps in node_modules are dead weight
// (tree-shaken from the production bundle). To add WalletConnect later, give wagmi a projectId
// and add the `walletConnect` connector in src/config/wagmi.ts.
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import type { Connector } from "wagmi";

export type Wallet = {
  address?: `0x${string}`;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectors: readonly Connector[];
  chainId?: number;
  isWrongChain: boolean;
  connect: (connector: Connector) => void;
  disconnect: () => void;
  switchChain: () => void;
};

export function useWallet(): Wallet {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connectors, connect, isPending: isConnectingReq } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== pulsechain.id;

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectingReq,
    isReconnecting,
    connectors,
    chainId,
    isWrongChain,
    connect: (connector) => connect({ connector }),
    disconnect,
    switchChain: () => switchChain({ chainId: pulsechain.id }),
  };
}
