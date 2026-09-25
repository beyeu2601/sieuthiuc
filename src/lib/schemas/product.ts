import { z } from "zod";

export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Nhập tên sản phẩm").max(200),
    goods_type: z.enum(["cont", "air"], { message: "Chọn loại hàng" }),
    unit: z.string().trim().min(1, "Nhập đơn vị tính").max(30),
    category_id: z.string().uuid().nullable(),
    brand_id: z.string().uuid().nullable(),
    pricing_method: z.enum(["manual", "benefit"]),
    sell_price: z.number().int().min(0, "Giá bán không âm"),
    benefit_pct: z.number().min(0).max(1000).nullable(),
    expiry_level: z.enum(["none", "product", "lot"]),
    expiry_date: z.string().nullable(),
    min_stock: z.number().min(0).nullable(),
    max_stock: z.number().min(0).nullable(),
    status: z.enum(["active", "inactive"]),
    note: z.string().max(1000).nullable(),
    barcode: z.string().trim().max(32).nullable().optional(),
  })
  .refine((v) => v.expiry_level !== "product" || !!v.expiry_date, {
    message: "Nhập hạn sử dụng khi quản lý hạn theo sản phẩm",
    path: ["expiry_date"],
  })
  .refine((v) => v.min_stock == null || v.max_stock == null || v.max_stock >= v.min_stock, {
    message: "Tồn tối đa phải lớn hơn hoặc bằng tồn tối thiểu",
    path: ["max_stock"],
  });

export type ProductInput = z.infer<typeof productSchema>;
