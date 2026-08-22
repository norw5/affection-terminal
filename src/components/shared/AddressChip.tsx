import { CopyButton } from "@/components/ui/CopyButton";
import { scannerUrl, shortenAddress } from "@/lib/format/address";

/** A compact name + short address + scanner link + copy. */
export function AddressChip({
  name,
  address,
  symbol,
}: {
  name?: string;
  address: string;
  symbol?: string;
}) {
  const label = name ?? symbol;
  return (
    <div className="flex items-center gap-2 text-xs">
      {label && <span className="text-text-dim">{label}</span>}
      <a
        href={scannerUrl(address, "address")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-info hover:underline"
        title={address}
      >
        {shortenAddress(address)}
      </a>
      <CopyButton value={address} />
    </div>
  );
}
