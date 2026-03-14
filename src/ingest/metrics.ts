export type CounterMap = Record<string, number>;

export interface IMetricsRegistry {
  readonly inc: (name: string, by?: number) => void;
  readonly get: (name: string) => number;
  readonly snapshot: () => Readonly<CounterMap>;
}

export const createMetricsRegistry = (): IMetricsRegistry => {
  const counters: CounterMap = {};

  return {
    inc: (name, by = 1) => {
      counters[name] = (counters[name] ?? 0) + by;
    },
    get: (name) => counters[name] ?? 0,
    snapshot: () => ({ ...counters }),
  };
};

export const globalMetrics = createMetricsRegistry();