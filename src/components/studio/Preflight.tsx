"use client";
import { useStudio } from "@/lib/store";
import { preflightSummary, type PreflightLine } from "@/lib/bridge";
import { Modal } from "../ui";

export default function Preflight({ lines, onApprove, onCancel }: { lines: PreflightLine[] | null; onApprove: () => void; onCancel: () => void }) {
  const platforms = useStudio((s) => s.platforms);
  if (!lines) return null;
  const sum = preflightSummary(lines, platforms);
  return (
    <Modal open title="Pre-flight cost check" onClose={onCancel} width={560}>
      <p className="text-14 text-w60">Claude planned where each render runs and what it will cost across your linked platforms:</p>
      <p className="mt-3 text-16 font-semibold leading-6">{sum.parts.join(", ")}.</p>
      <ul className="mt-4 max-h-[300px] overflow-y-auto thin-scroll flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center gap-2 text-12 rounded-8 bg-w5 px-3 py-2">
            <span className="flex-1 truncate">{l.label}</span>
            <span className="text-w50">{l.model.name}</span>
            <span className="text-lime">{l.plan.platformId ? platforms.find((p) => p.id === l.plan.platformId)?.name : "direct API"}</span>
            <span className="w-14 text-right font-semibold">{l.plan.cost} cr</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-12 bg-w5 p-3 text-12 text-w60">
        {Object.entries(sum.by).map(([k, v]) => {
          const pf = platforms.find((p) => p.id === k);
          if (!pf) return null;
          return (
            <p key={k}>
              {pf.name}: {pf.balance} → <b className="text-white">{pf.balance - v.cost}</b> credits
            </p>
          );
        })}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="h-10 px-4 rounded-8 bg-w10 text-14 font-semibold">
          Cancel
        </button>
        <button onClick={onApprove} className="h-10 px-4 rounded-8 bg-lime text-dark-2 text-14 font-semibold">
          Approve · {sum.total} credits
        </button>
      </div>
    </Modal>
  );
}
