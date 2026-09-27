// Chip loc dang tick: chon nhieu gia tri trong cung nhom. Trong AutoSubmitForm,
// tick la loc ngay. Value gui theo query string trung ten (mang).
export function FilterChip({
  name,
  value,
  label,
  checked,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );
}
