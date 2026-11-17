export type DayGroup<T> = {
  key: string;
  label: string;
  date: Date;
  items: T[];
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Today / Tomorrow / Yesterday, else "Fri, Jun 14" (year added when not current). */
export function formatDayLabel(date: Date, now = new Date()): string {
  const day = startOfDay(date);
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(day, today)) return "Today";
  if (sameDay(day, tomorrow)) return "Tomorrow";
  if (sameDay(day, yesterday)) return "Yesterday";
  const withYear = day.getFullYear() !== today.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(day);
}

/** Group items by calendar day, ascending by day. Callers reverse for descending. */
export function groupByDay<T>(items: T[], getDate: (item: T) => Date, now = new Date()): DayGroup<T>[] {
  const map = new Map<number, DayGroup<T>>();
  for (const item of items) {
    const day = startOfDay(getDate(item));
    const key = day.getTime();
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        key: day.toISOString().slice(0, 10),
        label: formatDayLabel(day, now),
        date: day,
        items: [item],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}
