'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } = require('firebase/firestore');

const rules = fs.readFileSync(path.resolve(__dirname,'../../firestore.rules'),'utf8');
(async()=>{
  const test = await initializeTestEnvironment({
    projectId: 'demo-timzy-role-security',
    firestore: { rules }
  });
  try {
    await test.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      for (const [uid, role, active] of [
        ['owner','super_admin',true],
        ['clerk','staff',true],
        ['investor1','investor',true],
        ['investor2','investor',true],
        ['inactive','investor',false]
      ]) {
        await setDoc(doc(db,'users',uid),{
          email:uid+'@example.com',role,active,
          investorId:role==='investor'?uid:null
        });
      }
      await setDoc(doc(db,'products','fabric1'),{name:'Brocade',status:'Published',stockOnHand:2,price:15000});
      await setDoc(doc(db,'products','draft1'),{name:'Unreleased Fabric',status:'Draft',price:20000});
      await setDoc(doc(db,'sales','sale1'),{amount:15000,productId:'fabric1'});
      await setDoc(doc(db,'financeSales','sale1'),{actualRetailTotal:15000,investorTotalDue:8000,grossMarginBeforeCosts:7000});
      await setDoc(doc(db,'investorAgreements','fabric1'),{investorUid:'investor1',payoutPerUnit:8000});
      await setDoc(doc(db,'investorCatalog','investor1','items','fabric1'),{productName:'Brocade',payoutPerUnit:8000});
      await setDoc(doc(db,'investorSales','investor1','entries','sale1'),{productName:'Brocade',totalDue:8000});
      await setDoc(doc(db,'investorSales','investor2','entries','sale2'),{productName:'Other material',totalDue:3000});
      await setDoc(doc(db,'investorCatalog','investor1','history','amendment1'),{
        productId:'fabric1',version:2,previousPayoutPerUnit:8000,payoutPerUnit:9000,
        changeReason:'Signed amendment in shop'
      });
      await setDoc(doc(db,'settings','store'),{googleDriveUploadToken:'PRIVATE_TOKEN'});
      await setDoc(doc(db,'expenses','exp1'),{amount:100});
    });

    const owner=test.authenticatedContext('owner').firestore();
    const clerk=test.authenticatedContext('clerk').firestore();
    const investor=test.authenticatedContext('investor1').firestore();
    const otherInvestor=test.authenticatedContext('investor2').firestore();
    const inactive=test.authenticatedContext('inactive').firestore();
    const publicDb=test.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(publicDb,'products','fabric1')));
    await assertFails(getDoc(doc(publicDb,'products','draft1')));
    await assertFails(getDocs(collection(publicDb,'products')));
    await assertSucceeds(getDocs(query(collection(publicDb,'products'),where('status','in',['Published','Out of Stock']))));
    await assertSucceeds(getDocs(collection(clerk,'products')));

    await assertFails(getDoc(doc(publicDb,'settings','store')));
    await assertFails(setDoc(doc(publicDb,'sales','fraud'),{amount:9999}));
    await assertSucceeds(getDoc(doc(owner,'settings','store')));
    await assertSucceeds(getDoc(doc(owner,'financeSales','sale1')));
    await assertSucceeds(getDoc(doc(owner,'investorAgreements','fabric1')));
    await assertSucceeds(getDocs(collection(owner,'users')));
    await assertFails(setDoc(doc(owner,'financeSales','forged'),{actualRetailTotal:9999}));

    await assertSucceeds(getDoc(doc(clerk,'products','fabric1')));
    await assertSucceeds(getDoc(doc(clerk,'sales','sale1')));
    await assertSucceeds(getDoc(doc(clerk,'users','clerk')));
    await assertFails(getDoc(doc(clerk,'financeSales','sale1')));
    await assertFails(getDoc(doc(clerk,'investorAgreements','fabric1')));
    await assertFails(getDoc(doc(clerk,'settings','store')));
    await assertFails(getDoc(doc(clerk,'expenses','exp1')));
    await assertFails(updateDoc(doc(clerk,'products','fabric1'),{price:1}));
    await assertFails(setDoc(doc(clerk,'sales','fake'),{amount:1200}));

    await assertSucceeds(getDoc(doc(investor,'investorCatalog','investor1','items','fabric1')));
    await assertSucceeds(getDoc(doc(investor,'investorSales','investor1','entries','sale1')));
    await assertSucceeds(getDoc(doc(investor,'investorCatalog','investor1','history','amendment1')));
    await assertSucceeds(getDocs(collection(investor,'investorCatalog','investor1','history')));
    await assertFails(getDocs(collection(otherInvestor,'investorCatalog','investor1','history')));
    await assertFails(getDoc(doc(clerk,'investorCatalog','investor1','history','amendment1')));
    await assertSucceeds(getDoc(doc(owner,'investorCatalog','investor1','history','amendment1')));
    await assertFails(getDoc(doc(otherInvestor,'investorCatalog','investor1','history','amendment1')));
    await assertFails(getDoc(doc(publicDb,'investorCatalog','investor1','history','amendment1')));
    await assertFails(setDoc(doc(investor,'investorCatalog','investor1','history','forged'),{
      version:3,payoutPerUnit:1
    }));
    await assertSucceeds(getDoc(doc(investor,'users','investor1')));
    await assertFails(getDoc(doc(investor,'users','owner')));
    await assertFails(getDoc(doc(investor,'financeSales','sale1')));
    await assertFails(getDoc(doc(investor,'sales','sale1')));
    await assertFails(getDoc(doc(investor,'investorSales','investor2','entries','sale2')));
    await assertFails(getDoc(doc(otherInvestor,'investorSales','investor1','entries','sale1')));
    await assertFails(getDoc(doc(investor,'settings','store')));
    await assertFails(getDoc(doc(investor,'expenses','exp1')));
    await assertFails(setDoc(doc(investor,'users','investor1'),{role:'super_admin',active:true}));
    await assertFails(getDoc(doc(inactive,'investorSales','investor1','entries','sale1')));

    await assertSucceeds(updateDoc(doc(owner,'products','fabric1'),{stockOnHand:1}));
    await assertFails(updateDoc(doc(owner,'products','fabric1'),{stockOnHand:-1}));
    await assertFails(updateDoc(doc(owner,'products','fabric1'),{payoutPerUnit:8000}));
    await assertFails(updateDoc(doc(owner,'products','fabric1'),{investorProposedCost:8000}));
    await assertFails(updateDoc(doc(owner,'products','fabric1'),{debugNotes:'Private pricing memo'}));

    console.log('PASS: Firestore emulator enforced role restrictions, public settings secrecy, stock validation and investor isolation.');
  } finally {
    await test.cleanup();
  }
})().catch(error => { console.error(error); process.exitCode=1; });
