// Khop voi ham SQL public.search_text: bo dau tieng Viet, chu thuong.
export function searchKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// Chuoi dung trong filter ilike cua PostgREST (bo ky tu dac biet cua cu phap or/and)
export function ilikeTerm(s: string) {
  return `%${searchKey(s).replace(/[%,()*]/g, " ").replace(/\s+/g, "%")}%`;
}

export const GOODS_TYPE_LABEL = { cont: "Cont", air: "Air" } as const;
