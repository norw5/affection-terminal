import { CopyButton } from "@/components/ui/CopyButton";
import type { TokenInfo } from "@/config/registry";
import { cn } from "@/lib/cn";
import { checksum, scannerUrl, shortenAddress } from "@/lib/format/address";
import type { ReactNode } from "react";
import type { Address } from "viem";

function Badge({
  tone,
  children,
  title,
}: {
  tone: "ok" | "warn" | "dim";
  children: ReactNode;
  title?: string;
}) {
  const cls = {
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    dim: "border-border-bright text-text-dim",
  }[tone];
  return (
    <span
      className={cn("border px-1 py-0.5 text-[0.625rem] uppercase tracking-wider", cls)}
      title={title}
    >
      {children}
    </span>
  );
}

/** A rich developer card for an ecosystem token: name, symbol, checksummed address
 *  (copy + scanner), decimals, cap, role, verified + stillMintable badges, and the
 *  optional on-chain notes. Designed for the KB "ecosystem registry" view. */
export function AddressCard({ token, compact = false }: { token: TokenInfo; compact?: boolean }) {
  const display = token.display ?? token.name;
  const capWhole = token.cap && token.cap !== "0" ? BigInt(token.cap).toString() : undefined;
  return (
    <div className="flex flex-col gap-1.5 border border-border bg-panel-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text">{display}</span>
        {token.symbol && <span className="text-xs text-text-dim">({token.symbol})</span>}
        <span className="ml-auto flex items-center gap-1">
          {token.verified ? (
            <Badge tone="ok" title="source verified on the PulseChain scanner">
              verified
            </Badge>
          ) : (
            <Badge tone="warn" title="source not verified">
              unverified
            </Badge>
          )}
          {token.stillMintable ? (
            <Badge tone="dim" title="still mintable">
              mintable
            </Badge>
          ) : (
            <Badge tone="dim" title="no longer mintable">
              no-mint
            </Badge>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <a
          href={scannerUrl(token.address, "address")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:underline"
          title={token.address}
        >
          {shortenAddress(token.address, 8)}
        </a>
        <CopyButton value={token.address} label="[0x]" />
        <span className="text-text-faint">· {token.decimals} decimals</span>
        {capWhole && <span className="text-text-faint">· cap {capWhole}</span>}
      </div>

      {!compact && <p className="text-xs leading-snug text-text-dim">{token.role}</p>}

      <div className="flex items-center gap-2 text-[0.625rem] text-text-faint">
        <span className="select-all text-text-dim">{checksum(token.address as Address)}</span>
      </div>

      {!compact && token.notes && (
        <p className="border-t border-border pt-1.5 text-xs leading-snug text-text-faint">
          {token.notes}
        </p>
      )}
    </div>
  );
}
