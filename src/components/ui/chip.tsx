import * as React from "react";
import { cn } from "cn";

/*
 * Chip ngu nghia - hoc tu 26c Academy, ap cho nganh ban le theo bang hop dong o
 * docs/KE-HOACH-UI.md muc 3. Truoc day moi man tu chon mau nen "dang giao" cho
 * thi xanh, cho thi cham tron, cho lai chu tron - quan ly phai doan.
 *
 * Chin sac, moi sac la mot bo ba token nen/chu/vien khai o globals.css, nen dark
 * mode va ban in tu dung, cho goi khong phai viet `dark:` gi ca. Xanh thuong hieu
 * (`brand`) van la mau HANH DONG (nut, lien ket) - o day no chi mang them nghia
 * "ca da duyet" va "kenh tai quay".
 *
 * `rose` (canh bao nhe, can date) va `red` (tien/het han/huy) la hai thang KHAC
 * NHAU, co y khong gop.
 */

/** Chin sac cua bang hop dong, cong hai bac chu xam phu. */
export type SacNguNghia =
  | "brand"
  | "emerald"
  | "amber"
  | "rose"
  | "red"
  | "indigo"
  | "sky"
  | "purple"
  | "slate"
  | "slateMo"
  | "slateDam";

/*
 * Ba bang tra duoi day viet thang tung chuoi class chu khong ghep luc chay:
 * Tailwind quet ma nguon bang van ban, ten class dung dong se khong duoc sinh CSS.
 * The KPI va thanh tien do (cac phase sau) dung lai chinh ba bang nay.
 */
export const NEN_SAC: Record<SacNguNghia, string> = {
  brand: "bg-nen-brand",
  emerald: "bg-nen-emerald",
  amber: "bg-nen-amber",
  rose: "bg-nen-rose",
  red: "bg-nen-red",
  indigo: "bg-nen-indigo",
  sky: "bg-nen-sky",
  purple: "bg-nen-purple",
  slate: "bg-nen-slate",
  slateMo: "bg-nen-slate",
  slateDam: "bg-nen-slate",
};

export const CHU_SAC: Record<SacNguNghia, string> = {
  brand: "text-chu-brand",
  emerald: "text-chu-emerald",
  amber: "text-chu-amber",
  rose: "text-chu-rose",
  red: "text-chu-red",
  indigo: "text-chu-indigo",
  sky: "text-chu-sky",
  purple: "text-chu-purple",
  slate: "text-chu-slate",
  slateMo: "text-chu-slate-mo",
  slateDam: "text-chu-slate-dam",
};

export const VIEN_SAC: Record<SacNguNghia, string> = {
  brand: "border-vien-brand",
  emerald: "border-vien-emerald",
  amber: "border-vien-amber",
  rose: "border-vien-rose",
  red: "border-vien-red",
  indigo: "border-vien-indigo",
  sky: "border-vien-sky",
  purple: "border-vien-purple",
  slate: "border-vien-slate",
  slateMo: "border-vien-slate",
  slateDam: "border-vien-slate",
};

/** Cham mau dac, bac 500. Chi la hinh khoi nen khong can nguong tuong phan chu. */
export const CHAM_SAC: Record<SacNguNghia, string> = {
  brand: "bg-brand-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  purple: "bg-purple-500",
  slate: "bg-slate-500",
  slateMo: "bg-slate-500",
  slateDam: "bg-slate-500",
};

export type ChipSacProps = React.ComponentProps<"span"> & {
  sac: SacNguNghia;
  /** In dam. Danh cho trang thai can nhan manh (vd "Qua han"). */
  dam?: boolean;
};

/** Chip nen nhat - chu dam - vien manh, khuon chung. */
export function ChipSac({
  sac,
  dam = false,
  className,
  children,
  ...props
}: ChipSacProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap",
        dam ? "font-bold" : "font-medium",
        NEN_SAC[sac],
        CHU_SAC[sac],
        VIEN_SAC[sac],
        className,
      )}
    >
      {children}
    </span>
  );
}

/*
 * Nhom 1: trang thai don online. giuHang -> indigo, dangGiao -> sky,
 * giaoThanhCong -> emerald, huy -> red.
 */
export type MaTrangThaiDon = "giuHang" | "dangGiao" | "giaoThanhCong" | "huy";

const SAC_TRANG_THAI_DON: Record<MaTrangThaiDon, SacNguNghia> = {
  giuHang: "indigo",
  dangGiao: "sky",
  giaoThanhCong: "emerald",
  huy: "red",
};

export function ChipTrangThaiDon({
  ma,
  children,
  className,
}: {
  ma: MaTrangThaiDon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ChipSac sac={SAC_TRANG_THAI_DON[ma]} className={className}>
      {children}
    </ChipSac>
  );
}

/*
 * Nhom 4: muc ton kho. du -> slate (trung tinh), thap (can nhap) -> amber,
 * het -> red.
 */
export type MaTonKho = "du" | "thap" | "het";

const SAC_TON_KHO: Record<MaTonKho, SacNguNghia> = {
  du: "slate",
  thap: "amber",
  het: "red",
};

export function ChipTonKho({
  ma,
  children,
  className,
}: {
  ma: MaTonKho;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ChipSac sac={SAC_TON_KHO[ma]} className={className}>
      {children}
    </ChipSac>
  );
}

/*
 * Nhom 5: han su dung. conHan -> slate, canDate -> amber, hetHan -> red.
 */
export type MaHan = "conHan" | "canDate" | "hetHan";

const SAC_HAN: Record<MaHan, SacNguNghia> = {
  conHan: "slate",
  canDate: "amber",
  hetHan: "red",
};

export function ChipHan({
  ma,
  children,
  className,
}: {
  ma: MaHan;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ChipSac sac={SAC_HAN[ma]} dam={ma === "hetHan"} className={className}>
      {children}
    </ChipSac>
  );
}

/*
 * Kenh ban: tai quay (POS) -> brand, Shopee -> amber, Facebook -> sky, dat truoc -> purple,
 * khac -> slate. Ban duoi khong co ma cung nao rot ve slate.
 */
const SAC_KENH_BAN: Record<string, SacNguNghia> = {
  pos: "brand",
  quay: "brand",
  shopee: "amber",
  facebook: "sky",
  fb: "sky",
  preorder: "purple",
};

export function sacKenhBan(kenh: string | null | undefined): SacNguNghia {
  const khoa = (kenh ?? "").trim().toLowerCase();
  return SAC_KENH_BAN[khoa] ?? "slate";
}

/*
 * Loai hang: Cont -> indigo, Air -> sky. Khac rot ve slate.
 */
const SAC_LOAI_HANG: Record<string, SacNguNghia> = {
  cont: "indigo",
  air: "sky",
};

export function sacLoaiHang(loai: string | null | undefined): SacNguNghia {
  const khoa = (loai ?? "").trim().toLowerCase();
  return SAC_LOAI_HANG[khoa] ?? "slate";
}

/*
 * Nhan tu do khong co nghia co dinh (nhom hang, ten nha cung cap): bam thuan tu
 * ma ky tu de mot ten luon ra mot sac on dinh giua cac lan tai va giua cac may.
 * Khong dung cho trang thai - trang thai da co bang mau rieng o tren.
 */
const SAC_XOAY: SacNguNghia[] = [
  "brand",
  "emerald",
  "amber",
  "rose",
  "indigo",
  "sky",
  "purple",
  "slate",
];

export function sacTheoNhan(nhan: string): SacNguNghia {
  let tong = 0;
  for (let i = 0; i < nhan.length; i += 1) {
    tong = (tong * 31 + nhan.charCodeAt(i)) % 100003;
  }
  return SAC_XOAY[tong % SAC_XOAY.length] ?? "slate";
}
