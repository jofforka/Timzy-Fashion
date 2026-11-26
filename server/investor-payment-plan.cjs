'use strict';
function planSale({ledger,agreement,quantity,unitKobo,productId,reference}){
 const agreed=agreement?.agreedPrice;
 if(agreement?.productId!==productId||!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(unitKobo)||unitKobo<=0||typeof agreed!=='number'||!Number.isFinite(agreed)||agreed<0)throw Error('Invalid investor allocation');
 const agreedKobo=Math.round(agreed*100);
 if(!Number.isSafeInteger(agreedKobo)||Math.abs(agreed*100-agreedKobo)>0.000001)throw Error('Invalid agreed price');
 if(!Number.isSafeInteger(ledger?.received)||!Number.isSafeInteger(ledger?.sold)||ledger.sold<0||ledger.received-ledger.sold<quantity)throw Error('Insufficient investor stock');
 const gross=unitKobo*quantity,earnings=agreedKobo*quantity;
 if(!Number.isSafeInteger(gross)||!Number.isSafeInteger(earnings))throw Error('Invalid sale amount');
 function add(previous,kobo){
  if(typeof previous!=='number'||!Number.isFinite(previous)||previous<0)throw Error('Invalid ledger balance');
  const total=Math.round(previous*100)+kobo;
  if(!Number.isSafeInteger(total)||total>100000000000000)throw Error('Ledger limit exceeded');
  return total/100;
 }
 return {ledger:{received:ledger.received,sold:ledger.sold+quantity,grossSales:add(ledger.grossSales,gross),investorEarnings:add(ledger.investorEarnings,earnings)},movement:{kind:'sale',quantity,productId,unitRetailPrice:unitKobo/100,agreedUnitAmount:agreedKobo/100,grossAmount:gross/100,investorAmount:earnings/100,reference}};
}
module.exports={planSale};
