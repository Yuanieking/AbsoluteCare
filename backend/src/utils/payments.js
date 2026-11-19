/**
 * The one amount every view shows for a visit, matching the reports:
 * a paid visit shows what was collected; an unpaid visit shows the fee booked
 * (the service snapshot), falling back to a pre-filled amount or the current fee.
 */
export function visitAmount(appointment) {
  const payment = appointment?.payment;
  if (payment?.status === "paid") return Number(payment.amount || 0);
  return Number(
    appointment?.serviceSnapshot?.fee ||
      payment?.amount ||
      appointment?.service?.fee ||
      0,
  );
}
