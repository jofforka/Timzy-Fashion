'use strict';
const {createHash}=require('node:crypto');
function rateLimiter(db,{limit=30,webhookLimit=300,windowMs=60000,clock=Date.now}={}){
 return async(req,{webhook=false}={})=>{
  const now=clock(), bucket=Math.floor(now/windowMs);
  const identity=req.socket?.remoteAddress||'unknown';
  const key=createHash('sha256').update(JSON.stringify([webhook,identity,bucket])).digest('hex');
  const ref=db.collection('paymentRateLimits').doc(key);
  return db.runTransaction(async t=>{
   const snap=await t.get(ref);
   const count=snap.exists?snap.data().count:0;
   if(!Number.isSafeInteger(count)||count<0||count>=(webhook?webhookLimit:limit))return false;
   t.set(ref,{count:count+1,expiresAt:new Date((bucket+2)*windowMs)});
   return true;
  });
 };
}
module.exports={rateLimiter};
