const fs = require('node:fs');
const {initializeTestEnvironment, assertSucceeds:ok, assertFails:no} = require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,where,serverTimestamp:now} = require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-timzy-spark',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 try {
 const ownerId='sCkXSrVIlHNGBoufFtirvLBvaTi1';
 const owner=env.authenticatedContext(ownerId,{email:'admin@timzyfashion.com'}).firestore();
 const staff=env.authenticatedContext('staff-uid').firestore();
 const investor=env.authenticatedContext('investor-a').firestore();
 const other=env.authenticatedContext('investor-b').firestore();
 const inactive=env.authenticatedContext('inactive').firestore();
 const impostor=env.authenticatedContext('another-uid',{email:'admin@timzyfashion.com',role:'super_admin'}).firestore();
 const anon=env.unauthenticatedContext().firestore();
 const rate={productId:'public',name:'Fabric',image:'https://example.com/fabric.jpg',agreedPrice:8000,reference:'Agreement 1',updatedAt:now()};
 const receipt=uid=>({description:'Completed manual sale',amount:15000,date:'2026-11-09',createdAt:now(),createdBy:uid});
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const [path,data] of Object.entries({
   'products/public':{name:'Fabric',status:'Published',price:15000},
   'products/draft':{name:'Draft',status:'Draft',price:15000},
   'settings/store':{googleDriveUploadToken:'test-secret'},
   'users/another-uid':{role:'super_admin',active:true},
   'access/staff-uid':{role:'staff',active:true,label:'Staff'},
   'access/investor-a':{role:'investor',active:true,label:'Investor A'},
   'access/investor-b':{role:'investor',active:true,label:'Investor B'},
   'access/inactive':{role:'staff',active:false,label:'Disabled'},
   'access/another-uid':{role:'super_admin',active:true,label:'Forged'},
   'financeSales/private':{amount:8000},
   'customerOrders/private':{customer:'test'}
  }))await setDoc(doc(db,path),data);
 });
 await ok(getDocs(query(collection(anon,'products'),where('status','in',['Published','Out of Stock']))));
 await ok(getDoc(doc(anon,'products/public')));
 await no(getDoc(doc(anon,'products/draft')));
 await no(getDocs(collection(anon,'products')));
 await ok(getDoc(doc(staff,'access/staff-uid')));
 await no(getDoc(doc(staff,'access/investor-a')));
 await no(getDocs(collection(staff,'access')));
 await no(setDoc(doc(owner,'access/bad'),{role:'super_admin',active:true,label:'Bad',updatedAt:now()}));
 await no(setDoc(doc(owner,'access/'+ownerId),{role:'staff',active:true,label:'Change owner',updatedAt:now()}));
 await ok(setDoc(doc(owner,'access/new-investor'),{role:'investor',active:true,label:'New Investor',updatedAt:now()}));
 await ok(setDoc(doc(owner,'investorCatalog/investor-a/items/public'),rate));
 await ok(setDoc(doc(owner,'investorCatalog/investor-b/items/public'),{...rate,agreedPrice:9000}));
 await ok(getDocs(collection(investor,'investorCatalog/investor-a/items')));
 await no(getDoc(doc(investor,'investorCatalog/investor-b/items/public')));
 await no(getDoc(doc(other,'investorCatalog/investor-a/items/public')));
 for(const key of ['retailPrice','grossMargin','profit','investorUid']) await no(updateDoc(doc(owner,'investorCatalog/investor-a/items/public'),{[key]:1}));
 await no(setDoc(doc(owner,'investorCatalog/staff-uid/items/public'),rate));
 await no(updateDoc(doc(owner,'investorCatalog/investor-a/items/public'),{agreedPrice:-1}));
 await no(updateDoc(doc(owner,'investorCatalog/investor-a/items/public'),{agreedPrice:'8000'}));
 await no(setDoc(doc(owner,'investorCatalog/investor-a/items/missing'),{...rate,productId:'missing'}));
 await ok(getDocs(collection(owner,'products')));
 await ok(getDoc(doc(owner,'settings/store')));
 await ok(setDoc(doc(owner,'settings/store'),{googleDriveUploadToken:'new-test-secret',updatedAt:now()}));
 await ok(setDoc(doc(owner,'products/new'),{name:'New fabric',price:1500,status:'Draft'}));
 await no(updateDoc(doc(owner,'products/new'),{costPrice:800}));
 await no(updateDoc(doc(owner,'products/new'),{price:-1}));
 await ok(updateDoc(doc(owner,'products/public'),{status:'Draft'}));
 await no(deleteDoc(doc(owner,'products/public')));
 await ok(setDoc(doc(staff,'sales/staff-sale'),receipt('staff-uid')));
 await ok(getDocs(query(collection(staff,'sales'),where('createdBy','==','staff-uid'))));
 await no(getDocs(collection(staff,'sales')));
 await no(setDoc(doc(staff,'sales/spoofed'),receipt(ownerId)));
 await no(setDoc(doc(staff,'expenses/not-allowed'),receipt('staff-uid')));
 for(const db of [staff,investor,other,inactive,impostor,anon]) {
  await no(getDoc(doc(db,'settings/store')));
  await no(setDoc(doc(db,'products/evil'),{name:'Forged',price:1,status:'Published'}));
  await no(setDoc(doc(db,'orders/spam'),{amount:1}));
  await no(setDoc(doc(db,'access/another-uid'),{role:'staff',active:true,label:'Attack',updatedAt:now()}));
  await no(setDoc(doc(db,'users/another-uid'),{role:'super_admin',active:true}));
  await no(getDocs(collection(db,'expenses')));
  await no(getDoc(doc(db,'financeSales/private')));
  await no(getDoc(doc(db,'customerOrders/private')));
  await no(updateDoc(doc(db,'investorCatalog/investor-a/items/public'),{agreedPrice:1}));
 }
 for(const [db,uid] of [[investor,'investor-a'],[inactive,'inactive'],[impostor,'another-uid']]) await no(setDoc(doc(db,'sales/forged-'+uid),receipt(uid)));
 for(const db of [staff,inactive,impostor,anon]) await no(getDoc(doc(db,'investorCatalog/investor-a/items/public')));
 for(const type of ['sales']) {
  const record=receipt(ownerId);
  await ok(setDoc(doc(owner,type+'/valid'),record));
  await no(getDoc(doc(staff,type+'/valid')));
  await no(setDoc(doc(owner,type+'/negative'),{...record,amount:-1}));
  await no(setDoc(doc(owner,type+'/private-extra'),{...record,investorPayout:8000}));
  await no(updateDoc(doc(owner,type+'/valid'),{amount:1}));
  await no(deleteDoc(doc(owner,type+'/valid')));
 }
 // Staff can submit but never approve expenses; owner alone reviews.
 const expense = (uid,amount=500) => ({description:'Shop supplies',amount,date:'2026-11-11',
   createdAt:now(),createdBy:uid,status:'pending'});
 await ok(setDoc(doc(staff,'expenseRequests/staff-one'),expense('staff-uid')));
 await ok(getDoc(doc(staff,'expenseRequests/staff-one')));
 await no(setDoc(doc(staff,'expenseRequests/approved-forged'),{...expense('staff-uid'),status:'approved'}));
 await no(setDoc(doc(staff,'expenseRequests/spoofed'),expense(ownerId)));
 await no(setDoc(doc(staff,'expenseRequests/negative'),expense('staff-uid',-2)));
 await no(updateDoc(doc(staff,'expenseRequests/staff-one'),{status:'approved'}));
 await no(deleteDoc(doc(staff,'expenseRequests/staff-one')));
 await no(getDoc(doc(investor,'expenseRequests/staff-one')));
 await no(getDoc(doc(other,'expenseRequests/staff-one')));
 await no(getDoc(doc(inactive,'expenseRequests/staff-one')));
 await ok(getDoc(doc(owner,'expenseRequests/staff-one')));
 await ok(updateDoc(doc(owner,'expenseRequests/staff-one'),{status:'approved',reviewedAt:now(),reviewedBy:ownerId}));
 await no(updateDoc(doc(owner,'expenseRequests/staff-one'),{status:'rejected'}));
 await ok(setDoc(doc(owner,'expenseRequests/owner-one'),expense(ownerId)));
 await no(setDoc(doc(owner,'expenses/new-legacy'),receipt(ownerId)));
 await no(setDoc(doc(staff,'expenses/new-legacy'),receipt('staff-uid')));
 await ok(setDoc(doc(staff,'restockRequests/staff-one'),{productId:'public',productName:'Fabric',
   note:'Low stock',status:'pending',createdAt:now(),createdBy:'staff-uid'}));
 await no(updateDoc(doc(staff,'restockRequests/staff-one'),{status:'resolved'}));
 await no(getDoc(doc(investor,'restockRequests/staff-one')));
 await ok(updateDoc(doc(owner,'restockRequests/staff-one'),{status:'resolved',reviewedAt:now(),reviewedBy:ownerId}));
 await no(deleteDoc(doc(staff,'restockRequests/staff-one')));
 // The exact prepared products must save through deployed-equivalent rules.
 const materials=JSON.parse(fs.readFileSync('data/material-variants.draft.json','utf8')).products;
 for(const {id,...product} of materials){
   console.log('Testing material',id);
   product.variants=product.variants.map(({imageStatus,...v})=>v);
   await ok(setDoc(doc(owner,'products/'+id),product));
   await no(getDoc(doc(anon,'products/'+id)));
   await ok(setDoc(doc(owner,'fabricProfiles/'+id),{}));
   await no(getDoc(doc(anon,'fabricProfiles/'+id)));
   await ok(updateDoc(doc(owner,'products/'+id),{status:'Published'}));
   await ok(getDoc(doc(anon,'products/'+id)));
   await ok(getDoc(doc(anon,'fabricProfiles/'+id)));
   for(const db of [anon,staff,investor]) await no(setDoc(doc(db,'fabricProfiles/'+id),{care:'Forged'}));
   for(const db of [anon,staff,investor]) await no(updateDoc(doc(db,'products/'+id),{price:1}));
   for(let index=0;index<product.variants.length;index++){
     const variants=structuredClone(product.variants);
     variants[index].investorEmail='private@example.test';
     await no(updateDoc(doc(owner,'products/'+id),{variants}));
   }
   await ok(updateDoc(doc(owner,'products/'+id),{variants:product.variants.map(v=>({...v,price:100,stockOnHand:5,sizes:['yard','metre']}))}));
   await ok(setDoc(doc(owner,'fabricProfiles/'+id),{composition:'Test fixture only',weight:'Test fixture',feel:'Test fixture',breathability:'Test fixture',care:'Test fixture',uses:'Test fixture',videoUrl:'https://example.com/fabric.mp4',occasions:['work']}));
   await no(setDoc(doc(owner,'fabricProfiles/'+id),{investorEmail:'private@example.test'}));
   await no(setDoc(doc(owner,'fabricProfiles/'+id),{composition:{investorPayout:1}}));
   await no(setDoc(doc(owner,'fabricProfiles/'+id),{occasions:['invented']}));
   await no(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],stockOnHand:-1}]}));
   await no(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],price:'100'}]}));
   await no(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],sizes:['yard',{investorPayout:1}]}]}));
   await no(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],sizes:[123]}]}));
   await no(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],sizes:['yard~metre']}]}));
   await ok(updateDoc(doc(owner,'products/'+id),{variants:[{...product.variants[0],price:100,stockOnHand:5,sizes:['yard']}]}));
 }
 console.log('PASS: Prepared material writes, draft privacy, public variants, every-slot investor-field rejection and commercial validation.');
 await ok(updateDoc(doc(owner,'access/investor-a'),{active:false,updatedAt:now()}));
 await no(getDoc(doc(investor,'investorCatalog/investor-a/items/public')));
 await ok(updateDoc(doc(owner,'access/staff-uid'),{active:false,updatedAt:now()}));
 await no(setDoc(doc(staff,'sales/after-disable'),receipt('staff-uid')));
 await no(getDoc(doc(staff,'sales/staff-sale')));
 console.log('PASS: Spark admin, staff, investor isolation, disabled access, privilege escalation and manual ledger validation.');
 } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
