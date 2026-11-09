// «Fuente» of the deal detail (SDD-20261109-deals-no-source U-3). A missing source is null and reads «Sin origen»; it never sends "".
import { Pick } from "@/components/fields";
import { dealSourceOptions } from "@/lib/deal-source";

export function DealSourceField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Pick
      value={value ?? ""}
      options={dealSourceOptions(value)}
      onChange={(v) => onChange(v === "" ? null : v)}
    />
  );
}
