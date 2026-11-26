'use strict';
const {paymentApi}=require('./payment-api.cjs');
const {repository}=require('./payment-firestore.cjs');
const {paystackClient}=require('./payment-order-service.cjs');
function handler({db,auth,secret,callbackUrl,origin,rateLimit,enabled=false,mode='test'}){
 if(typeof rateLimit!=='function')throw Error('Distributed rate limiter required');
 const api=paymentApi({repo:repository(db,mode),provider:paystackClient(secret,fetch,mode),secret,callbackUrl,authenticate:token=>auth.verifyIdToken(token,true)});
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  if(!enabled)return send(503,{error:'Payments disabled'});
  const path=new URL(req.url,'https://localhost').pathname;
  const webhook=path==='/webhook';
  if(!webhook){
   if(req.headers.origin!==origin)return send(403,{error:'Origin denied'});
   res.setHeader('Access-Control-Allow-Origin',origin);
   res.setHeader('Vary','Origin');
   res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
   res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
   if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
  }
  if(req.method!=='POST')return send(405,{error:'Method denied'});
  try{
   if(!await rateLimit(req,{webhook}))return send(429,{error:'Try again later'});
   const chunks=[];let size=0;
   for await(const chunk of req){size+=chunk.length;if(size>65536)return send(413,{error:'Request too large'});chunks.push(Buffer.from(chunk));}
   const raw=Buffer.concat(chunks);
   if(webhook){await api.webhook(raw,req.headers['x-paystack-signature']);return send(200,{received:true});}
   const match=/^Bearer (\S+)$/.exec(req.headers.authorization||'');
   if(!match)return send(401,{error:'Sign in required'});
   const body=JSON.parse(raw.toString('utf8'));
   if(path==='/initialize')return send(200,await api.initialize(match[1],body.items));
   if(path==='/status')return send(200,await api.status(match[1],body.reference));
   if(path==='/reconcile')return send(200,await api.reconcile(match[1],body.reference));
   return send(404,{error:'Not found'});
  }catch(e){return send(webhook?503:400,{error:'Payment request could not be completed'});}
 };
}
module.exports={handler};
