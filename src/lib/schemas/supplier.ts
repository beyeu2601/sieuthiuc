import { z } from "zod";

const opt = z.string().trim().max(300).nullable();

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên nhà cung cấp").max(200),
  contact_name: opt,
  phone: opt,
  email: z.union([z.string().trim().email("Email không hợp lệ"), z.literal(""), z.null()]),
  address: opt,
  tax_code: opt,
  bank_name: opt,
  bank_account: opt,
  payment_terms_days: z.number().int().min(0, "Không âm").max(365, "Tối đa 365 ngày"),
  note: z.string().max(1000).nullable(),
  is_active: z.boolean(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
