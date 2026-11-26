const test=require('node:test');
const assert=require('node:assert/strict');
const {repository}=require('../server/payment-firestore.cjs');
// In-memory transaction contract double; not a Firestore emulator.
function setup(){
 const data=new Map([['products/a',{status:'Published',price:100,stockOnHand:3}],['products/b',{status:'Published',price:200,stockOnHand:2}]]);
 const snap=ref=>({ref,id:ref.id,exists:data.has(ref.key),data:()=>structuredClone(data.get(ref.key))});
 const db={collection:name=>({doc:id=>{const ref={id,key:name+'/'+id};ref.get=async()=>snap(ref);return ref;}}),runTransaction:async fn=>{
 const writes=[];const t={get:async ref=>snap(ref),create:(ref,value)=>writes.push(()=>{if(data.has(ref.key))throw Error('Exists');data.set(ref.key,structuredClone(value));}),update:(ref,value)=>writes.push(()=>data.set(ref.key,{...data.get(ref.key),...structuredClone(value)}))};
 const result=await fn(t);writes.forEach(w=>w());return result;
 }};
 return {data,repo:repository(db)};
}
const ref='TF-1234567890123456',other='TF-1234567890123457';
const create=(repo,r=ref)=>repo.create(r,[{productId:'a',qty:2},{productId:'b',qty:1}],'customer','customer@example.com');
test('server quote persists and verified receipt deducts stock once',async()=>{
 const {repo,data}=setup();const order=await create(repo);assert.equal(order.amountKobo,40000);
 assert.equal((await repo.recordVerifiedPayment(ref,123)).status,'paid');
 assert.equal(data.get('products/a').stockOnHand,1);
 assert.equal((await repo.recordVerifiedPayment(ref,123)).duplicate,true);
 assert.equal(data.get('products/a').stockOnHand,1);
});
test('stock shortfall records payment without partial deductions',async()=>{
 const {repo,data}=setup();await create(repo);data.get('products/b').stockOnHand=0;
 assert.equal((await repo.recordVerifiedPayment(ref,123)).status,'paid_stock_review');
 assert.equal(data.get('products/a').stockOnHand,3);
 assert.equal(data.get('paymentReceipts/123').reference,ref);
});
test('receipt cannot be reassigned',async()=>{
 const {repo}=setup();await create(repo);await create(repo,other);
 await repo.recordVerifiedPayment(ref,123);
 await assert.rejects(repo.recordVerifiedPayment(other,123),/already assigned/);
});
