import type { ProductOption } from "@/server/db/schema";

// Every combination of option values: Size [S, M] × Color [Red] → [{Size:S,Color:Red}, {Size:M,Color:Red}]
export function combinations(options: ProductOption[]): Record<string, string>[] {
  const usable = options.filter((o) => o.name && o.values.length);
  if (!usable.length) return [];
  return usable.reduce<Record<string, string>[]>(
    (acc, option) => acc.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.name]: value }))),
    [{}],
  );
}

export function variantTitle(values: Record<string, string>, options: ProductOption[]) {
  return options
    .filter((o) => o.name in values)
    .map((o) => values[o.name])
    .join(" / ");
}
