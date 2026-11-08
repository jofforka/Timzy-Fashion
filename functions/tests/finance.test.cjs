'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { asPositiveInt, asNonNegativeInt, saleBreakdown, publicInvestorLine } = require('../lib/finance');

test('example consignment transaction maintains truthful separate values', () => {
  const sale = saleBreakdown({quantity:1,unitSalePrice:15000,payoutPerUnit:8000});
  assert.equal(sale.amount,15000);
  assert.equal(sale.investorTotalDue,8000);
  assert.equal(sale.grossMarginBeforeCosts,7000);
});

test('quantity applies equally to revenue and investor liability', () => {
  const sale = saleBreakdown({quantity:3,unitSalePrice:15000,payoutPerUnit:8000});
  assert.equal(sale.amount,45000);
  assert.equal(sale.investorTotalDue,24000);
  assert.equal(sale.grossMarginBeforeCosts,21000);
});

test('non-investor product has zero investor liability', () => {
  const sale = saleBreakdown({quantity:2,unitSalePrice:9000});
  assert.equal(sale.investorTotalDue,0);
});

test('investor projection excludes revenue, retail price and profit', () => {
  const sale = saleBreakdown({quantity:2,unitSalePrice:15000,payoutPerUnit:8000});
  const projection = publicInvestorLine({
    productId:'fabric-a',productName:'Brocade fabric',units:sale.units,
    unitInvestorPayout:sale.unitInvestorPayout,
    investorTotalDue:sale.investorTotalDue,soldAt:'2026-11-08',status:'due'
  });
  assert.equal(projection.payoutPerUnit,8000);
  assert.equal(projection.totalDue,16000);
  assert.equal(projection.status,'due');
  for(const field of ['amount','unitSalePrice','actualRetailTotal','grossMarginBeforeCosts','margin','profit']) {
    assert.ok(!(field in projection),field+' must never be projected to investor');
  }
});

test('invalid inputs never silently round', () => {
  for(const bad of [0,-1,1.2,'15000',NaN,Infinity,null,undefined]) {
    assert.throws(()=>asPositiveInt(bad,'Amount'));
  }
  assert.equal(asNonNegativeInt(0,'Payout'),0);
  assert.throws(()=>asNonNegativeInt(-1,'Payout'));
  assert.throws(()=>saleBreakdown({quantity:101,unitSalePrice:15000,payoutPerUnit:8000}));
});
