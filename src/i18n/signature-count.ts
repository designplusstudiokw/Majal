import { fmt } from "./fmt";

/** "12 of 100 signatures", or "240 signatures · target reached". */
export const signatureCountText = (
  t: { count: string; countReached: string },
  n: number,
  target: number,
) => (n >= target ? fmt(t.countReached, { n }) : fmt(t.count, { n, target }));
