const fs = require('node:fs');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,where,serverTimestamp} = require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-timzy-spark',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 try {
 const owner=env.authenticatedContext('sCkXSrVIlHNGBoufFtirvLBvaTi1',{email:'admin@timzyfashion.com'}).firestore();
 const staff=env.authenticatedContext('staff-uid',{email:'staff@example.com'}).firestore();
 const impostor=env.authenticatedContext('another-uid',{email:'admin@timzyfashion.com'}).firestore();
 const anon=env.unauthenticatedContext().firestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  for(const [path,data] of Object.entries({
   'products/public':{name:'Fabric',status:'Published',price:1000},
   'products/draft':{name:'Draft',status:'Draft',price:1000},
   'settings/store':{googleDriveUploadToken:'test-secret'},
   'users/staff-uid':{role:'super_admin',active:true},
   'financeSales/private':{amount:8000},
   'customerOrders/private':{customer:'test'}
  }))await setDoc(doc(db,path),data);
 });
 await assertSucceeds(getDocs(query(collection(anon,'products'),where('status','in',['Published','Out of Stock']))));
 await assertSucceeds(getDoc(doc(anon,'products/public')));
 await assertFails(getDoc(doc(anon,'products/draft')));
 await assertFails(getDocs(collection(anon,'products')));
 for(const db of [staff,impostor,anon]) {
  await assertFails(getDoc(doc(db,'settings/store')));
  await assertFails(setDoc(doc(db,'products/evil'),{name:'Forged',price:1,status:'Published'}));
  await assertFails(setDoc(doc(db,'orders/spam'),{amount:1}));
  await assertFails(setDoc(doc(db,'users/staff-uid'),{role:'super_admin',active:true}));
  await assertFails(getDocs(collection(db,'sales')));
  await assertFails(getDocs(collection(db,'expenses')));
  await assertFails(getDoc(doc(db,'financeSales/private')));
  await assertFails(getDoc(doc(db,'customerOrders/private')));
 }
 await assertSucceeds(getDocs(collection(owner,'products')));
 await assertSucceeds(getDoc(doc(owner,'settings/store')));
 await assertSucceeds(setDoc(doc(owner,'settings/store'),{googleDriveUploadToken:'new-test-secret',updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(owner,'products/new'),{name:'New fabric',price:1500,status:'Draft'}));
 await assertFails(updateDoc(doc(owner,'products/new'),{costPrice:800}));
 await assertFails(updateDoc(doc(owner,'products/new'),{price:-1}));
 await assertSucceeds(updateDoc(doc(owner,'products/public'),{status:'Draft'}));
 await assertFails(deleteDoc(doc(owner,'products/public')));
 for(const type of ['sales','expenses']) {
  const record={description:'Confirmed manual record',amount:15000,date:'2026-11-09',createdAt:serverTimestamp()};
  await assertSucceeds(setDoc(doc(owner,type+'/valid'),record));
  await assertFails(setDoc(doc(staff,type+'/forged'),record));
  await assertFails(setDoc(doc(owner,type+'/negative'),{...record,amount:-1}));
  await assertFails(setDoc(doc(owner,type+'/private-extra'),{...record,investorPayout:8000}));
  await assertFails(updateDoc(doc(owner,type+'/valid'),{amount:1}));
  await assertFails(deleteDoc(doc(owner,type+'/valid')));
 }
 console.log('PASS: Spark owner access, public catalogue, draft privacy, manual ledger, schema checks and privilege escalation protections.');
 } finally {await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
