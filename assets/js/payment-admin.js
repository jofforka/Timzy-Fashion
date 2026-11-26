(function(){
'use strict';
const rows=document.getElementById('orders'),status=document.getElementById('status'),button=document.getElementById('refresh');
let generation=0;
async function load(){
 const current=++generation;rows.replaceChildren();button.disabled=true;
 const user=firebase.auth().currentUser;
 if(!user){status.textContent='Sign in as an administrator.';return;}
 status.textContent='Loading…';
 try{
 const result=await firebase.firestore().collection('orders').orderBy('createdAt','desc').limit(100).get();
 if(current!==generation||firebase.auth().currentUser?.uid!==user.uid)return;
 for(const doc of result.docs){
 const d=doc.data(),tr=document.createElement('tr');
 for(const value of [d.reference||doc.id,d.status||'Unknown',Number.isSafeInteger(d.amountKobo)?(d.amountKobo/100).toFixed(2):'Unavailable',d.transactionId??'—']){
 const td=document.createElement('td');td.textContent=String(value);tr.append(td);
 }
 rows.append(tr);
 }
 status.textContent=result.size+' recent orders (maximum 100).';
 }catch(e){if(current===generation)status.textContent='Orders unavailable. Administrator access is required.';}
 finally{if(current===generation)button.disabled=false;}
}
firebase.auth().onAuthStateChanged(load);button.addEventListener('click',load);
})();
