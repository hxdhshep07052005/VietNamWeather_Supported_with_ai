export function requireEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireEnvironmentPort(
  environment: NodeJS.ProcessEnv,
  name: string
): number {
  const rawValue = requireEnvironmentValue(environment, name);
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`Invalid TCP port in environment variable: ${name}`);
  }
  return value;
}
