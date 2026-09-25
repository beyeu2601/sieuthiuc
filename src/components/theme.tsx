"use client";

import { useEffect, useState } from "react";
import { DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

export type ThemeMode = "system" | "light" | "dark";
const KEY = "theme";

// Chay trong <head> truoc khi ve trang de khong nhay mau sang roi toi.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function apply(mode: ThemeMode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

// Muc chon giao dien trong menu tai khoan.
export function ThemeMenuItems() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    setMode(read());
  }, []);

  // Theo may: doi theo he dieu hanh khi nguoi dung chuyen sang/toi giua ca
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function choose(v: ThemeMode) {
    setMode(v);
    try {
      if (v === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, v);
    } catch {
      // trinh duyet chan luu tru: van doi giao dien cho phien hien tai
    }
    apply(v);
  }

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs text-muted-foreground">Giao diện</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={mode} onValueChange={(v) => choose(v as ThemeMode)}>
        <DropdownMenuRadioItem value="system" className="h-10">
          Theo máy
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="light" className="h-10">
          Sáng
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className="h-10">
          Tối
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}
