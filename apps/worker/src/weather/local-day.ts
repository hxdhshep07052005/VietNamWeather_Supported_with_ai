import { weatherSchemaError } from "./errors.js";

export function weatherApiLocalDayStart(
  date: unknown,
  localTime: unknown,
  hourStart: string
): { readonly date: string; readonly validFrom: string } {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw weatherSchemaError();
  }
  const localDate = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(localDate.getTime()) || localDate.toISOString().slice(0, 10) !== date) {
    throw weatherSchemaError();
  }
  if (typeof localTime !== "string") {
    throw weatherSchemaError();
  }
  const match = /^(\d{4}-\d{2}-\d{2}) ([01]\d|2[0-3]):00$/.exec(localTime);
  if (match === null || match[1] !== date || match[2] === undefined) {
    throw weatherSchemaError();
  }
  // A forecast date is local; date_epoch encodes its label at UTC midnight.
  const midnight = Date.parse(hourStart) - Number(match[2]) * 60 * 60 * 1_000;
  return { date, validFrom: new Date(midnight).toISOString() };
}
