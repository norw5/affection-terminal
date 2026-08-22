import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/format/address";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function WalletButton() {
  const {
    address,
    isConnected,
    isConnecting,
    isWrongChain,
    chainId,
    connectors,
    connect,
    disconnect,
    switchChain,
  } = useWallet();

  if (!isConnected) {
    const connector = connectors[0];
    if (!connector) {
      return (
        <Button variant="ghost" size="sm" disabled title="no EIP-1193 wallet detected">
          no wallet
        </Button>
      );
    }
    return (
      <Button variant="accent" size="sm" disabled={isConnecting} onClick={() => connect(connector)}>
        {isConnecting ? "connecting…" : "connect"}
      </Button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="focus-ring border border-border-bright bg-panel-2 px-3 py-1.5 text-xs text-text hover:border-accent-dim"
        >
          {isWrongChain ? "wrong chain" : address ? shortenAddress(address) : "—"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 border border-border bg-panel-2 py-1 text-xs text-text shadow-none"
        >
          <div className="px-3 py-1.5 text-text-faint">
            <div className="truncate">{address}</div>
            <div className="mt-0.5 text-[0.625rem]">chainId {chainId ?? "—"}</div>
          </div>
          {isWrongChain && (
            <DropdownMenu.Item
              onSelect={switchChain}
              className="flex cursor-pointer px-3 py-1.5 text-warn outline-none data-[highlighted]:bg-panel"
            >
              switch to PulseChain
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={disconnect}
            className="flex cursor-pointer px-3 py-1.5 text-err outline-none data-[highlighted]:bg-panel"
          >
            disconnect
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
