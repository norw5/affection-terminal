import { VerifyOverlay } from "@/components/kb/VerifyOverlay";
import { AddressCard } from "@/components/shared/AddressCard";
import { AddressChip } from "@/components/shared/AddressChip";
import { Button } from "@/components/ui/Button";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Panel } from "@/components/ui/Panel";
import { affectionAbi } from "@/config/abis/affection.abi";
import { mathAbi } from "@/config/abis/math.abi";
import { AFFECTION_ADDR, MATH_ADDR, TOKENS } from "@/config/registry";
import { exportKnowledgeBundle } from "@/lib/bundle/export";
import { DOCS, README } from "@/lib/docs/loader";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

export function KBIndex() {
  const [exporting, setExporting] = useState(false);
  const docs = DOCS.filter((d) => d.filename.toLowerCase() !== "readme");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-xl text-accent">Knowledge Base</h1>
        <p className="text-text-dim">
          The committed reference for the AFFECTION ecosystem — every fact traceable to verified
          on-chain source. Static, offline-capable, copy-pasteable.
        </p>
        <div>
          <Button
            variant="accent"
            size="sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportKnowledgeBundle();
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "packing…" : "download bundle (.zip)"}
          </Button>
        </div>
      </section>

      {README && (
        <Panel title="readme">
          <Link to="/kb/$doc" params={{ doc: README.slug }} className="text-info hover:underline">
            ▸ {README.title}
          </Link>
        </Panel>
      )}

      <Panel title="documentation">
        <ul className="flex flex-col gap-1">
          {docs.map((d) => (
            <li key={d.slug}>
              <Link
                to="/kb/$doc"
                params={{ doc: d.slug }}
                className="flex items-baseline gap-2 px-1 py-0.5 text-text-dim hover:text-text"
              >
                <span className="text-text-faint">{d.filename.slice(0, 2)}</span>
                <span>{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="verify against chain · sources.md §2">
        <VerifyOverlay />
      </Panel>

      <Panel title="ecosystem registry · addresses.json">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TOKENS.map((t) => (
            <AddressCard key={t.address} token={t} />
          ))}
        </div>
      </Panel>

      <Panel title="developer artifacts · contract ABIs">
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-text-faint">
              AFFECTION contract
            </div>
            <AddressChip name="AFFECTION (Ⓐ)" address={AFFECTION_ADDR} />
          </div>
          <CodeBlock code={JSON.stringify(affectionAbi, null, 2)} lang="json" label="abi · json" />
          <div>
            <div className="mb-1 text-xs uppercase tracking-wider text-text-faint">
              libAtropaMath v1.1 (MATH)
            </div>
            <AddressChip name="MATH" address={MATH_ADDR} />
          </div>
          <CodeBlock code={JSON.stringify(mathAbi, null, 2)} lang="json" label="abi · json" />
          <p className="text-xs text-text-faint">
            Full verified Solidity sources are in the bundle and at{" "}
            <a
              href="https://github.com/busytoby/atropa_pulsechain"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/busytoby/atropa_pulsechain
            </a>
            .
          </p>
        </div>
      </Panel>
    </div>
  );
}
