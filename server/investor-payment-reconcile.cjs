'use strict';
const {postInvestorSale}=require('./investor-payment-posting.cjs');
async function reconcileInvestors(db,reference){
 const snap=await db.collection('orders').doc(reference).get();
 if(!snap.exists)throw Error('Unknown order');
 const order=snap.data();
 if(order.paymentMode!=='live'||order.status!=='paid')return {skipped:true};
 const results=[];
 for(const productId of new Set(order.lines.map(l=>l.productId))){
 const allocation=await db.collection('paymentInvestorAllocations').doc(productId).get();
 if(!allocation.exists){results.push({productId,status:'allocation_required'});continue;}
 const a=allocation.data();
 if(a.merchantOwned===true&&!a.investorUid){results.push({productId,status:'merchant_owned'});continue;}
 try{const result=await postInvestorSale(db,{reference,productId,investorUid:a.investorUid});results.push({productId,status:result.duplicate?'duplicate':'posted'});}
 catch{results.push({productId,status:'review_required'});}
 }
 return {results,complete:results.every(r=>['merchant_owned','duplicate','posted'].includes(r.status))};
}
module.exports={reconcileInvestors};
