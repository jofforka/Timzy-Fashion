'use strict';
const {verifyTransaction,verifySignature}=require('./payment-verification.cjs');
// Strict server-side pricing; unpriced, untracked and sample products stay on manual checkout.
function quote(items,products){
 if(!Array.isArray(items)||!items.length||items.length>50)throw Error('Invalid bag');
 const lines=new Map();
 for(const i of items){
  if(!i||typeof i.productId!=='string'||!Number.isSafeInteger(i.qty)||i.qty<1||i.qty>100)throw Error('Invalid item');
  const p=products.get(i.productId);
  if(!p||p.sampleListing===true||String(p.status).toLowerCase()!=='published')throw Error('Unavailable product');
  const variants=Array.isArray(p.variants)?p.variants:[];
  const matches=variants.filter(v=>v.color===i.variantColor);
  if(variants.length?matches.length!==1:i.variantColor!=null)throw Error('Invalid variant');
  const v=variants.length?matches[0]:null;
  const price=Number(v?v.price:Number(p.salePrice)>0?p.salePrice:p.price);
  const stock=v?v.stockOnHand:p.stockOnHand;
  const unit=Math.round(price*100);
  if(!Number.isSafeInteger(unit)||unit<=0||Math.abs(price*100-unit)>0.000001||!Number.isSafeInteger(stock))throw Error('Manual checkout required');
  const key=JSON.stringify([i.productId,v?v.color:null]);
  const qty=(lines.get(key)?.qty||0)+i.qty;
  if(qty>stock||qty>100)throw Error('Insufficient stock');
  lines.set(key,{productId:i.productId,variantColor:v?v.color:null,qty,unitKobo:unit});
 }
 const result=[...lines.values()];
 const amountKobo=result.reduce((n,l)=>n+l.qty*l.unitKobo,0);
 if(!Number.isSafeInteger(amountKobo)||amountKobo<=0)throw Error('Invalid total');
 return {lines:result,amountKobo,currency:'NGN'};
}
function paystackClient(secret,fetcher=fetch,mode='test'){
 if(!['test','live'].includes(mode)||typeof secret!=='string'||!secret.startsWith('sk_'+mode+'_'))throw Error('Payment secret mode mismatch');
 async function request(path,body){
  const response=await fetcher('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok||result.status!==true||!result.data)throw Error('Payment provider request failed');
  return result.data;
 }
 return {initialize(order,email,callbackUrl){return request('/transaction/initialize',{reference:order.reference,amount:order.amountKobo,currency:'NGN',email,callback_url:callbackUrl});},verify(reference){return request('/transaction/verify/'+encodeURIComponent(reference));}};
}
// Repository must atomically record verified payment and reconcile stock, or flag paid for review.
async function processWebhook(raw,signature,secret,repo,provider){
 if(!verifySignature(raw,signature,secret))throw Error('Invalid signature');
 const event=JSON.parse(raw.toString('utf8'));
 if(event.event!=='charge.success')return {ignored:true};
 const reference=event.data?.reference;
 if(typeof reference!=='string'||!reference||reference.length>128)throw Error('Invalid reference');
 const order=await repo.find(reference);
 if(!order)throw Error('Unknown order');
 const tx=await provider.verify(reference);
 if(!verifyTransaction(order,tx))throw Error('Payment mismatch');
 return repo.recordVerifiedPayment(reference,tx.id);
}
module.exports={quote,paystackClient,processWebhook};
