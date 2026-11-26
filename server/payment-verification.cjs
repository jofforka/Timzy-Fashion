// Pure payment verification helpers. No credentials or network calls.
const {createHmac,timingSafeEqual}=require('node:crypto');
function verifySignature(raw,signature,secret){
 if(!Buffer.isBuffer(raw)||typeof secret!=='string'||!secret||typeof signature!=='string'||!/^[a-f0-9]{128}$/i.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature,'hex'),createHmac('sha512',secret).update(raw).digest());
}
function verifyTransaction(order,tx){
 if(!order||!tx||!Number.isSafeInteger(order.amountKobo)||order.amountKobo<=0||typeof order.reference!=='string'||!order.reference)return false;
 if(order.paymentMode&&tx.domain!==order.paymentMode)return false;
 return tx.status==='success'&&tx.reference===order.reference&&tx.currency==='NGN'&&tx.amount===order.amountKobo&&Number.isSafeInteger(tx.id)&&tx.id>0;
}
module.exports={verifySignature,verifyTransaction};
