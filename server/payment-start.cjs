'use strict';
const http=require('node:http');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {handler}=require('./payment-http.cjs');
const {rateLimiter}=require('./payment-rate-limit.cjs');
const app=initializeApp({credential:applicationDefault()});
const db=getFirestore(app);
const enabled=process.env.PAYMENTS_ENABLED==='true';
const origin=new URL(process.env.STOREFRONT_ORIGIN);
if(origin.protocol!=='https:')throw Error('HTTPS origin required');
const serve=handler({db,auth:getAuth(app),secret:process.env.PAYSTACK_SECRET,callbackUrl:process.env.PAYMENT_CALLBACK_URL,origin:origin.origin,rateLimit:rateLimiter(db),enabled});
const server=http.createServer((req,res)=>{
 if(req.url==='/healthz'&&req.method==='GET'){res.statusCode=200;return res.end('ok');}
 Promise.resolve(serve(req,res)).catch(()=>{if(!res.headersSent)res.statusCode=500;res.end();});
});
server.requestTimeout=20000;
server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
