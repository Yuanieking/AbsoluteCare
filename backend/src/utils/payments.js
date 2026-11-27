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
