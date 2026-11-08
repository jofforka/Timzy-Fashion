'use strict';

// Store money as whole naira (integers); never trust values from the browser.
// Investor entitlements are contractual payouts, not the retail selling price.
function asPositiveInt(value, name, max = 1000000000) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new TypeError(name + ' must be a positive whole number.');
  }
  return value;
}
function asNonNegativeInt(value, name) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1000000000) {
    throw new TypeError(name + ' must be a non-negative whole number.');
  }
  return value;
}
function saleBreakdown({ quantity, unitSalePrice, payoutPerUnit = 0 }) {
  const units = asPositiveInt(quantity, 'Quantity', 100);
  const retail = asPositiveInt(unitSalePrice, 'Selling price');
  const due = asNonNegativeInt(payoutPerUnit, 'Investor payout');
  const amount = units * retail;
  const payout = units * due;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(payout)) {
    throw new TypeError('Sale exceeds supported value.');
  }
  return {
    units,
    unitSalePrice: retail,
    amount,
    unitInvestorPayout: due,
    investorTotalDue: payout,
    grossMarginBeforeCosts: amount - payout
  };
}
function publicInvestorLine({ productId, productName, units, unitInvestorPayout, investorTotalDue, soldAt, status }) {
  return {
    productId, productName,
    units, payoutPerUnit: unitInvestorPayout,
    totalDue: investorTotalDue, soldAt, status
  };
}
module.exports = { asPositiveInt, asNonNegativeInt, saleBreakdown, publicInvestorLine };
