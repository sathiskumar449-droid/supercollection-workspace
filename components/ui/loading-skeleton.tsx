import React from "react";

export function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse max-w-7xl mx-auto">
      <div className="h-20 bg-slate-200/70 rounded-xl" />
      <div className="grid grid-cols-4 gap-4">
        <div className="h-24 bg-slate-200/70 rounded-xl" />
        <div className="h-24 bg-slate-200/70 rounded-xl" />
        <div className="h-24 bg-slate-200/70 rounded-xl" />
        <div className="h-24 bg-slate-200/70 rounded-xl" />
      </div>
      <div className="h-96 bg-slate-200/70 rounded-xl" />
    </div>
  );
}
