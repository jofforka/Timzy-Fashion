(function(){
 const config=window.TimzyPaymentConfig;
 if(!config?.enabled||!config.endpoint)return;
 const panel=document.getElementById('testPayment'),button=document.getElementById('testPayBtn'),status=document.getElementById('testPayStatus');
 const client=window.TimzyPaymentClient(config.endpoint,firebase.auth());
 panel.hidden=false;
 button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
   const items=window.App.cart.list();
   if(!items.length)throw Error('Your bag is empty');
   if(!confirm('Test only: pickup without custom measurements or delivery. Continue?'))return;
   const result=await client.initialize(items);
   sessionStorage.setItem('timzyTestReference',result.reference);
   location.assign(result.authorizationUrl);
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 });
 firebase.auth().onAuthStateChanged(async user=>{
  const reference=sessionStorage.getItem('timzyTestReference');
  if(!user||!reference)return;
  try{const order=await client.reconcile(reference);status.textContent='Test order '+order.reference+': '+order.status;}catch(e){status.textContent=e.message;}
 });
})();
