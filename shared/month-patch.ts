import type { Month } from "./schema";

/** Send editable fields only; status/carryIn belong exclusively to monthly closing. */
export function editableMonthPatch(form: Partial<Month>, original?: Partial<Month>) {
  const { id: _id, status: _status, carryIn: _carryIn, ...fields } = form;
  return Object.fromEntries(Object.entries(fields).filter(([key, value]) =>
    !original || value !== original[key as keyof Month],
  )) as Partial<Month>;
}
