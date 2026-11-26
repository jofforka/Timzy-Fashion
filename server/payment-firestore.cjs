'use strict';
const {quote}=require('./payment-order-service.cjs');
function repository(db){
 const orders=db.collection('orders'), products=db.collection('products'), receipts=db.collection('paymentReceipts');
 const refFor=reference=>{if(typeof reference!=='string'||!/^TF-[a-zA-Z0-9-]{16,100}$/.test(reference))throw Error('Invalid reference');return orders.doc(reference);};
 return {
 async find(reference){const s=await refFor(reference).get();return s.exists?s.data():null;},
 async create(reference,items,uid,email){
  if(typeof uid!=='string'||!uid||typeof email!=='string'||!email.includes('@'))throw Error('Authenticated customer required');
  const ref=refFor(reference);
  return db.runTransaction(async t=>{
   const existing=await t.get(ref);if(existing.exists)throw Error('Duplicate reference');
   if(!Array.isArray(items)||!items.length||items.length>50)throw Error('Invalid bag');
   const ids=[...new Set(items.map(i=>i.productId))];
   if(ids.some(id=>typeof id!=='string'||!id||id.includes('/')))throw Error('Invalid product');
   const snapshots=await Promise.all(ids.map(id=>t.get(products.doc(id))));
   const catalog=new Map(snapshots.filter(s=>s.exists).map(s=>[s.id,s.data()]));
   const order={...quote(items,catalog),reference,uid,email,status:'pending_payment',delivery:'Pickup',createdAt:new Date()};
   t.create(ref,order);return order;
  });
 },
 async recordVerifiedPayment(reference,transactionId){
  if(!Number.isSafeInteger(transactionId)||transactionId<=0)throw Error('Invalid transaction');
  const ref=refFor(reference), receipt=receipts.doc(String(transactionId));
  return db.runTransaction(async t=>{
   const [s,r]=await Promise.all([t.get(ref),t.get(receipt)]);
   if(!s.exists)throw Error('Unknown order');
   const order=s.data();
   if(r.exists){if(r.data().reference!==reference)throw Error('Transaction already assigned');return {duplicate:true};}
   if(order.status!=='pending_payment')throw Error('Unexpected order state');
   const ids=[...new Set(order.lines.map(l=>l.productId))];
   const snaps=await Promise.all(ids.map(id=>t.get(products.doc(id))));
   const updates=new Map();let review=false;
   for(const snap of snaps){
    if(!snap.exists){review=true;continue;}
    const p=snap.data(), variants=Array.isArray(p.variants)?p.variants.map(v=>({...v})):[];
    for(const l of order.lines.filter(l=>l.productId===snap.id)){
     const matches=variants.filter(v=>v.color===l.variantColor);
     const target=l.variantColor===null&&!variants.length?p:matches.length===1?matches[0]:null;
     if(!target||!Number.isSafeInteger(target.stockOnHand)||target.stockOnHand<l.qty){review=true;continue;}
     target.stockOnHand-=l.qty;
    }
    updates.set(snap.ref,variants.length?{variants}:{stockOnHand:p.stockOnHand});
   }
   if(!review)for(const [doc,data] of updates)t.update(doc,data);
   const status=review?'paid_stock_review':'paid';
   t.create(receipt,{reference,transactionId,createdAt:new Date()});
   t.update(ref,{status,transactionId,paidAt:new Date()});
   return {status};
  });
 }
 };
}
module.exports={repository};
