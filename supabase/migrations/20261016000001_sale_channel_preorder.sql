-- Kenh ban "Dat truoc" cho giao dich ban sinh tu don dat truoc (hang order). File rieng vi gia tri enum moi
-- chi dung duoc sau khi giao dich them no da commit.
alter type public.sale_channel add value if not exists 'preorder';
