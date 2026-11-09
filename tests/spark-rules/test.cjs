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
 await ok(setDoc(doc(owner,'access/new-investor'),{role:'investor',active:true,label:'New Investor',updatedAt:now()}));
 await ok(setDoc(doc(owner,'investorCatalog/investor-a/items/public'),rate));
 await ok(setDoc(doc(owner,'investorCatalog/investor-b/items/public'),{...rate,agreedPrice:9000}));
 await ok(getDocs(collection(investor,'investorCatalog/investor-a/items')));
 await no(getDoc(doc(investor,'investorCatalog/investor-b/items/public')));
 await no(getDoc(doc(other,'investorCatalog/investor-a/items/public')));
 for(const key of ['retailPrice','grossMargin','profit','investorUid']) await no(updateDoc(doc(owner,'investorCatalog/investor-a/items/public'),{[key]:1}));
 await no(setDoc(doc(owner,'investorCatalog/staff-uid/items/public'),rate));
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
 for(const type of ['sales','expenses']) {
  const record=receipt(ownerId);
  await ok(setDoc(doc(owner,type+'/valid'),record));
  await no(getDoc(doc(staff,type+'/valid')));
  await no(setDoc(doc(owner,type+'/negative'),{...record,amount:-1}));
  await no(setDoc(doc(owner,type+'/private-extra'),{...record,investorPayout:8000}));
  await no(updateDoc(doc(owner,type+'/valid'),{amount:1}));
  await no(deleteDoc(doc(owner,type+'/valid')));
 }
 await ok(updateDoc(doc(owner,'access/investor-a'),{active:false,updatedAt:now()}));
 await no(getDoc(doc(investor,'investorCatalog/investor-a/items/public')));
 await ok(updateDoc(doc(owner,'access/staff-uid'),{active:false,updatedAt:now()}));
 await no(setDoc(doc(staff,'sales/after-disable'),receipt('staff-uid')));
 await no(getDoc(doc(staff,'sales/staff-sale')));
 console.log('PASS: Spark admin, staff, investor isolation, disabled access, privilege escalation and manual ledger validation.');
 } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
