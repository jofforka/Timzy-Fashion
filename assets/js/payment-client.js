(function(){
 'use strict';
 function client(endpoint,auth){
  const base=new URL(endpoint);
  if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error('Invalid payment endpoint');
  async function request(path,body){
   const user=auth.currentUser;
   if(!user||!user.emailVerified)throw Error('Sign in with a verified email first');
   const token=await user.getIdToken();
   const response=await fetch(base.href.replace(/\/$/,'')+'/'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Payment service unavailable. Check your order before retrying.');
   return response.json();
  }
  return Object.freeze({
   async initialize(items){
    const result=await request('initialize',{items:items.map(({productId,variantColor,qty})=>({productId,variantColor:variantColor??null,qty}))});
    const url=new URL(result.authorizationUrl);
    if(url.origin!=='https://checkout.paystack.com')throw Error('Invalid checkout destination');
    return {...result,authorizationUrl:url.href};
   },
   status:reference=>request('status',{reference}),
   reconcile:reference=>request('reconcile',{reference})
  });
 }
 window.TimzyPaymentClient=client;
})();
