type ClassValue = string | false | null | undefined | ClassValue[];

function flatten(values: ClassValue[]): string[] {
  const result: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (Array.isArray(v)) {
      result.push(...flatten(v));
    } else {
      result.push(v);
    }
  }
  return result;
}

export function cn(...values: ClassValue[]): string {
  return flatten(values).join(" ");
}
