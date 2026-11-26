'use strict';
const {planSale}=require('./investor-payment-plan.cjs');
const {createHash}=require('node:crypto');
async function postInvestorSale(db,{reference,productId,investorUid,quantity,unitKobo}){
 for(const id of [reference,productId,investorUid])if(typeof id!=='string'||!id||id.includes('/'))throw Error('Invalid identifier');
 const order=db.collection('orders').doc(reference);
 const allocation=db.collection('paymentInvestorAllocations').doc(productId);
 const agreement=db.collection('investorCatalog').doc(investorUid).collection('items').doc(productId);
 const ledger=db.collection('investorLedger').doc(investorUid).collection('products').doc(productId);
 const movement=ledger.collection('movements').doc(createHash('sha256').update(reference+'|'+productId).digest('hex'));
 return db.runTransaction(async t=>{
 const [o,a,g,l,m]=await Promise.all([order,allocation,agreement,ledger,movement].map(ref=>t.get(ref)));
 if(!o.exists||o.data().paymentMode!=='live'||o.data().status!=='paid'||!Number.isSafeInteger(o.data().transactionId)||o.data().transactionId<=0)throw Error('Verified live sale required');
 if(!a.exists||a.data().investorUid!==investorUid)throw Error('Explicit investor allocation required');
 const lines=o.data().lines.filter(line=>line.productId===productId);
 if(!lines.length||lines.some(line=>line.unitKobo!==unitKobo)||lines.reduce((sum,line)=>sum+line.qty,0)!==quantity)throw Error('Order line mismatch');
 if(m.exists)return {duplicate:true};
 if(!g.exists||!l.exists)throw Error('Missing investor records');
 const plan=planSale({ledger:l.data(),agreement:g.data(),quantity,unitKobo,productId,reference});
 const now=new Date();
 t.update(ledger,{...plan.ledger,updatedAt:now});
 t.create(movement,{...plan.movement,createdAt:now,createdBy:'payment-service'});
 return {posted:true};
 });
}
module.exports={postInvestorSale};
