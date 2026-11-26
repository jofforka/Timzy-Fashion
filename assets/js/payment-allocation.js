(function(){
'use strict';
const form=document.getElementById('allocation'),status=document.getElementById('allocation-status'),button=form.querySelector('button'),uid=document.getElementById('investor-uid'),ownership=document.getElementById('ownership');
function sync(){uid.disabled=ownership.value==='merchant';uid.required=!uid.disabled;}
ownership.addEventListener('change',sync);sync();
form.addEventListener('submit',async e=>{
 e.preventDefault();
 const productId=document.getElementById('product-id').value.trim(),investorUid=uid.value.trim(),merchant=ownership.value==='merchant';
 if(!firebase.auth().currentUser||!productId||productId.includes('/')||(!merchant&&(!investorUid||investorUid.includes('/')))){status.textContent='Sign in and enter valid identifiers.';return;}
 if(!window.confirm('Confirm ownership for '+productId+'?'))return;
 button.disabled=true;
 try{
 await firebase.firestore().collection('paymentInvestorAllocations').doc(productId).set(merchant?{merchantOwned:true}:{investorUid});
 status.textContent='Allocation saved.';
 }catch(e){status.textContent='Allocation not saved. Check owner permissions, product ID and investor agreement.';}
 finally{button.disabled=false;}
});
})();
