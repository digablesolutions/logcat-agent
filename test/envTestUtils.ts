export const snapshotEnv = (keys: readonly string[]): ReadonlyMap<string, string | undefined> => {
  return new Map(keys.map(key => [key, process.env[key]]));
};

export const clearEnvKeys = (keys: readonly string[]): void => {
  for (const key of keys) {
    delete process.env[key];
  }
};

export const restoreEnv = (snapshot: ReadonlyMap<string, string | undefined>): void => {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
};