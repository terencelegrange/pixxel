"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { AssetIcon } from "@/components/assets/AssetModal";

const DOMAIN_COLOURS = [
  "border-violet-400 dark:border-violet-500",
  "border-sky-400 dark:border-sky-500",
  "border-emerald-400 dark:border-emerald-500",
  "border-amber-400 dark:border-amber-500",
  "border-rose-400 dark:border-rose-500",
  "border-teal-400 dark:border-teal-500",
  "border-indigo-400 dark:border-indigo-500",
  "border-orange-400 dark:border-orange-500",
];

function domainBorderColour(domainName: string | null): string {
  if (!domainName) return "border-slate-300 dark:border-slate-600";
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = (hash * 31 + domainName.charCodeAt(i)) & 0xffff;
  }
  return DOMAIN_COLOURS[hash % DOMAIN_COLOURS.length];
}

const LIFECYCLE_DOT: Record<string, string> = {
  Proposed:         "bg-slate-400",
  Approved:         "bg-blue-500",
  "In Development": "bg-amber-500",
  Production:       "bg-emerald-500",
  Sunset:           "bg-orange-500",
  Retired:          "bg-red-500",
};

export interface DependencyNodeData {
  name: string;
  shortCode: string | null;
  icon: string | null;
  domain: string | null;
  lifecycleStatus: string | null;
  isCenter?: boolean;
}

function DependencyNode({ data, selected }: NodeProps<DependencyNodeData>) {
  const dotColour = data.lifecycleStatus ? (LIFECYCLE_DOT[data.lifecycleStatus] ?? "bg-slate-400") : "bg-slate-300";

  return (
    <div
      className={[
        "relative rounded-xl border-2 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm",
        "min-w-[150px] max-w-[190px] cursor-pointer",
        domainBorderColour(data.domain),
        selected ? "ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-950" : "",
        data.isCenter ? "ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-slate-950 shadow-md" : "",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-none"
      />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <AssetIcon
            name={data.icon || "Server"}
            className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {data.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {data.shortCode && (
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                {data.shortCode}
              </span>
            )}
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColour}`} />
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-none"
      />
    </div>
  );
}

export default memo(DependencyNode);
