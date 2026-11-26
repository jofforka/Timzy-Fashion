'use strict';
const {randomUUID}=require('node:crypto');
const {verifyTransaction}=require('./payment-verification.cjs');
const {processWebhook}=require('./payment-order-service.cjs');
// Runtime adapter must verify Firebase ID tokens and enforce rate limits before calling these methods.
function paymentApi({repo,provider,secret,authenticate,callbackUrl}){
 const callback=new URL(callbackUrl);
 if(callback.protocol!=='https:')throw Error('HTTPS callback required');
 async function customer(token){
  const user=await authenticate(token);
  if(!user?.uid||!user.email||user.email_verified!==true)throw Error('Verified email required');
  return user;
 }
 return {
 async initialize(token,items){
  const user=await customer(token);
  const reference='TF-'+randomUUID();
  const order=await repo.create(reference,items,user.uid,user.email);
  const payment=await provider.initialize(order,user.email,callback.href);
  const url=new URL(payment.authorization_url);
  if(url.origin!=='https://checkout.paystack.com'||payment.reference!==reference)throw Error('Unexpected checkout response');
  return {reference,authorizationUrl:url.href,amountKobo:order.amountKobo};
 },
 async status(token,reference){
  const user=await customer(token);
  const order=await repo.find(reference);
  if(!order||order.uid!==user.uid)throw Error('Order not found');
  return {reference,status:order.status,amountKobo:order.amountKobo};
 },
 async reconcile(token,reference){
  const user=await customer(token);
  const order=await repo.find(reference);
  if(!order||order.uid!==user.uid)throw Error('Order not found');
  if(order.status==='pending_payment'){
   const tx=await provider.verify(reference);
   if(verifyTransaction(order,tx))await repo.recordVerifiedPayment(reference,tx.id);
  }
  const updated=await repo.find(reference);
  return {reference,status:updated.status,amountKobo:updated.amountKobo};
 },
 webhook(raw,signature){return processWebhook(raw,signature,secret,repo,provider);}
 };
}
module.exports={paymentApi};
