# Plan Object Schema

```ts
type PlanObject = {
  title: string;
  mode: string;
  participants: string[];
  timeWindows: Array<{ startAt: string; endAt: string }>;
  location: { center: string; radiusKm: number };
  constraints: {
    budgetCap?: number;
    accessibility?: string[];
    groupType?: string;
  };
  weatherAssumptions: string[];
  steps: Array<"suggest" | "soft_hold" | "approval" | "book">;
  fallbackPlan: string;
};
```

All Packs must return plan objects in this shape.

