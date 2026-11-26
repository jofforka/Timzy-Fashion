'use strict';
const {planSale}=require('./investor-payment-plan.cjs');
const {createHash}=require('node:crypto');
async function postInvestorSale(db,{reference,productId,investorUid}){
 for(const id of [reference,productId,investorUid])if(typeof id!=='string'||!id||id.includes('/'))throw Error('Invalid identifier');
 const order=db.collection('orders').doc(reference);
 const allocation=db.collection('paymentInvestorAllocations').doc(productId);
 const agreement=db.collection('investorCatalog').doc(investorUid).collection('items').doc(productId);
 const ledger=db.collection('investorLedger').doc(investorUid).collection('products').doc(productId);
 const movement=ledger.collection('movements').doc(createHash('sha256').update(JSON.stringify([reference,productId])).digest('hex'));
 const marker=db.collection('paymentInvestorPostings').doc(movement.id);
 return db.runTransaction(async t=>{
 const [o,a,g,l,m,p]=await Promise.all([order,allocation,agreement,ledger,movement,marker].map(ref=>t.get(ref)));
 if(!o.exists||o.data().paymentMode!=='live'||o.data().status!=='paid'||!Number.isSafeInteger(o.data().transactionId)||o.data().transactionId<=0)throw Error('Verified live sale required');
 const receipt=await t.get(db.collection('paymentReceipts').doc(String(o.data().transactionId)));
 if(!receipt.exists||receipt.data().reference!==reference)throw Error('Verified payment receipt required');
 if(p.exists)return {duplicate:true};
 if(!a.exists||a.data().investorUid!==investorUid)throw Error('Explicit investor allocation required');
 const lines=o.data().lines.filter(line=>line.productId===productId);
 if(!lines.length||lines.length>50)throw Error('Order line mismatch');
 if(m.exists)throw Error('Existing movement requires reconciliation');
 if(!g.exists||!l.exists)throw Error('Missing investor records');
 let balance=l.data();
 const plans=[];
 for(const line of lines){
  const plan=planSale({ledger:balance,agreement:g.data(),quantity:line.qty,unitKobo:line.unitKobo,productId,reference});
  balance=plan.ledger;plans.push(plan.movement);
 }
 const now=new Date();
 t.update(ledger,{...balance,updatedAt:now});
 for(const [index,entry] of plans.entries()){
  const target=index===0?movement:ledger.collection('movements').doc(movement.id+'-'+index);
  t.create(target,{...entry,createdAt:now,createdBy:'payment-service'});
 }
 t.create(marker,{reference,productId,investorUid,createdAt:now});
 return {posted:true};
 });
}
module.exports={postInvestorSale};
