import type { ILogEntry, Priority } from './types.js';

/**
 * Defines the shape of a dynamic filter applied to log entries.
 */
export type DynamicFilter = Readonly<{
  tags?: Readonly<Record<string, boolean>> | undefined;
  minPriority?: Priority | undefined;
}>;

const priorityOrder: ReadonlyArray<Priority> = ['V', 'D', 'I', 'W', 'E', 'F', 'S'];
const prioIdx = (p: Priority): number => priorityOrder.indexOf(p);

/**
 * Constructs a predicate function that returns `true` for log entries
 * satisfying the provided filter criteria.
 */
export const makeFilter = (filter: DynamicFilter): ((e: ILogEntry) => boolean) => {
  const minPrio = filter.minPriority;
  const tags = filter.tags;
  const hasTags = tags && Object.keys(tags).length > 0;

  return (e: ILogEntry) => {
    if (minPrio && prioIdx(e.priority) < prioIdx(minPrio)) {
      return false;
    }
    if (hasTags && !tags[e.tag]) {
      return false;
    }
    return true;
  };
};
