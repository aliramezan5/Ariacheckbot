export type CalculateInput = {
  principal: number;
  count: number;
  interval: number;
  monthlyRate: number;
};

export type ScheduleRow = {
  number: number;
  month: number;
  opening: number;
  interest: number;
  principalPart: number;
  payment: number;
  closing: number;
};

export type CalculateResult = {
  principal: number;
  count: number;
  interval: number;
  monthlyRate: number;
  periodRate: number;
  payment: number;
  total: number;
  profit: number;
  rasMonths: number;
  durationMonths: number;
  schedule: ScheduleRow[];
};

export function calculateDeal(input: CalculateInput): CalculateResult {
  const { principal, count, interval, monthlyRate } = input;
  if (!Number.isFinite(principal) || principal <= 0) throw new Error('مبلغ معامله نامعتبر است');
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('تعداد چک نامعتبر است');
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) throw new Error('فاصله چک نامعتبر است');
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0 || monthlyRate > 50) throw new Error('نرخ ماهانه نامعتبر است');

  const r = monthlyRate / 100;
  const periodRate = Math.pow(1 + r, interval) - 1;
  const payment = principal * periodRate / (1 - Math.pow(1 + periodRate, -count));

  let balance = principal;
  const schedule: ScheduleRow[] = [];

  for (let n = 1; n <= count; n += 1) {
    const opening = balance;
    const interest = opening * periodRate;
    const principalPart = n === count ? opening : payment - interest;
    const actualPayment = n === count ? opening + interest : payment;
    balance = Math.max(0, opening - principalPart);
    schedule.push({
      number: n,
      month: n * interval,
      opening,
      interest,
      principalPart,
      payment: actualPayment,
      closing: balance,
    });
  }

  const total = schedule.reduce((sum, row) => sum + row.payment, 0);

  return {
    principal,
    count,
    interval,
    monthlyRate,
    periodRate,
    payment,
    total,
    profit: total - principal,
    rasMonths: interval * (count + 1) / 2,
    durationMonths: count * interval,
    schedule,
  };
}
