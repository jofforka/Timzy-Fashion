// Run the actual portal scripts against a small browser/Firestore fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const owner='sCkXSrVIlHNGBoufFtirvLBvaTi1';
const nodes=new Map(), reads=[], passwordRequests=[];
function node(id){
 if(!nodes.has(id))nodes.set(id,{hidden:false,value:'',textContent:'',innerHTML:'',dataset:{},options:[],
  elements:new Proxy({}, {get:(o,k)=>o[k]??(o[k]={value:''})}),
  classList:{add(){},remove(){},toggle(){}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},reset(){},replaceChildren(){this.innerHTML='';},querySelectorAll(){return [];}});
 return nodes.get(id);
}
let init,authChange,settingsRelease;
const context={console,setTimeout,clearTimeout,URL,FormData:class{},confirm:()=>false,
 location:{href:'https://example.com/admin/index.html'},
 document:{body:node('body'),querySelector:s=>node(s),querySelectorAll:()=>[],getElementById:id=>node('#'+id),addEventListener:(name,cb)=>{if(name==='DOMContentLoaded')init=cb;}},
 firebase:{firestore:{FieldValue:{serverTimestamp:()=>({})}}},window:{}};
function ref(path,filters=[]){return{
 collection:name=>ref(path+'/'+name),doc:name=>ref(path+'/'+name),
 where:(...f)=>ref(path,[...filters,f]),orderBy(){return this;},limit(){return this;},
 async get(){
  reads.push({path,filters});
  if(path==='settings/store')return new Promise(resolve=>{settingsRelease=()=>resolve({exists:true,data:()=>({googleDriveUploadToken:'PRIVATE-OWNER-TOKEN'})});});
  if(path.startsWith('access/')){const uid=path.split('/')[1];return{exists:true,data:()=>({role:uid==='staff'?'staff':uid==='investor'?'investor':'admin',active:uid!=='inactive'})};}
  if(path==='investorCatalog/investor/items')return{docs:[{data:()=>({name:'My Fabric',productId:'fabric',image:'https://example.com/img.jpg',agreedPrice:8000,reference:'Agreement A'})}]};
  return{docs:[]};
 }
};}
context.window.TIMZY_FIREBASE={auth:{onAuthStateChanged:cb=>authChange=cb,setPersistence(){},signOut:async()=>{},sendPasswordResetEmail:async email=>passwordRequests.push(email)},db:{collection:name=>ref(name)}};
vm.createContext(context);
for(const file of ['admin/admin.js','admin/spark-roles.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
init();
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await authChange({uid:owner}); await flush();
 assert(reads.some(x=>x.path==='settings/store'),'Owner loads private settings');
 reads.length=0;
 await authChange({uid:'staff'}); await flush();
 settingsRelease(); await flush();
 assert.equal(context.window.TimzyAdmin.state.role,'staff');
 assert.equal(Object.keys(context.window.TimzyAdmin.state.settings).length,0,'Delayed owner settings cannot leak into staff session');
 assert(!reads.some(x=>['settings/store','expenses'].includes(x.path)),'Staff does not fetch admin data');
 assert(reads.some(x=>x.path==='sales'&&x.filters.some(f=>f[0]==='createdBy'&&f[2]==='staff')),'Staff requests only own receipts');
 assert(reads.some(x=>x.path==='products'&&x.filters.some(f=>f[0]==='status')),'Staff product query excludes drafts');
 reads.length=0;
 await authChange({uid:'investor'}); await flush();
 assert.equal(context.window.TimzyAdmin.state.role,'investor');
 assert(reads.some(x=>x.path==='investorCatalog/investor/items'));
 assert(!reads.some(x=>['products','sales','expenses','settings/store'].includes(x.path)),'Investor does not fetch operational records or retail catalogue');
 assert(node('#portfolioItems').innerHTML.includes('8,000'));
 await authChange({uid:'inactive'}); await flush();
 assert.equal(context.window.TimzyAdmin.state.role,null);
 assert.equal(node('#portfolioItems').innerHTML,'','Previous investor data cleared');
 await authChange({uid:'forged-role'}); await flush();
 assert.equal(context.window.TimzyAdmin.state.role,null,'An admin role in an editable profile never bootstraps the owner');
 assert.equal(passwordRequests.length,0,'No password email is automatically sent');
 const email=node('#adminLoginForm').elements.email;
 email.value=' investor@example.com ';email.reportValidity=()=>true;
 await node('#resetPasswordBtn').listeners.click();
 assert.deepEqual(passwordRequests,['investor@example.com'],'Password link requested only on explicit button click');
 console.log('PASS: Actual portal routing, scoped queries, disabled accounts and delayed-response isolation.');
})().catch(e=>{console.error(e);process.exitCode=1});
