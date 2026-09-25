-- Sprint 0 - cau hinh mac dinh (SPEC Phu luc A). Chi chen neu chua co.

insert into public.settings(key, store_id, value) values
  ('inventory.default_min_stock', null, '5'),
  ('inventory.near_expiry_days', null, '30'),
  ('inventory.allow_negative', null, 'false'),
  ('costing.method', null, '"wavg"'),
  ('pricing.rounding_unit', null, '1000'),
  ('pos.max_manual_discount_pct', null, '10'),
  ('pos.offline_enabled', null, 'false'),
  ('pos.print_mode', null, '"browser"'),
  ('shift.diff_alert_amount', null, '50000'),
  ('debt.due_soon_days', null, '3'),
  ('expense.auto_approve_below', null, '500000'),
  ('loyalty.earn_rate_vnd', null, '1000'),
  ('loyalty.redeem_value_vnd', null, '100'),
  ('loyalty.redeem_step', null, '100'),
  ('loyalty.max_redeem_pct', null, '50'),
  ('loyalty.points_expiry_months', null, '0'),
  ('report.best_seller_order', null, '"by_qty"'),
  ('receipt.template', null, '{"header": null, "footer": null, "show_points": true}'),
  ('label.size', null, '"40x30"'),
  ('notification.channels', null, '["inapp","push"]'),
  ('einvoice.enabled', null, 'false'),
  ('sales.channels', null, '["pos","shopee","facebook","other"]'),
  ('payment.methods', null, '["cash","transfer","other"]')
on conflict on constraint settings_key_store_uq do nothing;
