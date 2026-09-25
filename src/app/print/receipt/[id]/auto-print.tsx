"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.print();
    }, 300);
    const close = () => window.close();
    window.addEventListener("afterprint", close);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", close);
    };
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded border px-3 py-1 font-sans">
      In
    </button>
  );
}
