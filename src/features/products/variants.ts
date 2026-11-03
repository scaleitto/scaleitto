import type { OptionDisplay, ProductOption } from "@/server/db/schema";

// How the store shows an option (older color options had kind: "color")
export const displayOf = (o: ProductOption): OptionDisplay => o.display ?? (o.kind === "color" ? "color" : "text");
export const showsColor = (o: ProductOption) => ["color", "text_color"].includes(displayOf(o));

// The options that make the product's combinations: named, with values, required and shown in the store.
// Optional options are a free choice written on the order; hidden ones are not offered.
export const dimensionOptions = (options: ProductOption[]) => options.filter((o) => o.name && o.values.length && !o.optional && !o.hidden);

// A value the merchant switched off is not offered in the store (its combinations keep their data)
export const valueOn = (o: ProductOption, value: string) => !o.off?.includes(value);

// Every combination of option values: Size [S, M] × Color [Red] → [{Size:S,Color:Red}, {Size:M,Color:Red}]
export function combinations(options: ProductOption[]): Record<string, string>[] {
  const usable = dimensionOptions(options);
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

// The optional choices a buyer made, kept only when they are real values of shown optional options
export function optionalChoices(options: ProductOption[], picked: Record<string, string>) {
  return options
    .filter((o) => o.optional && !o.hidden && o.name)
    .flatMap((o) => {
      const v = picked[o.name];
      return v && o.values.includes(v) && valueOn(o, v) ? [{ label: o.name, value: v }] : [];
    });
}

// The combinations a buyer may order: switched on, and none of their values switched off
export function offered<V extends { optionValues: Record<string, string>; active?: boolean }>(options: ProductOption[], variants: V[]) {
  return variants.filter((v) => v.active !== false && Object.entries(v.optionValues).every(([name, value]) => {
    const o = options.find((x) => x.name === name);
    return !o || valueOn(o, value);
  }));
}
