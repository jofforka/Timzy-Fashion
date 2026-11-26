'use strict';
function sandboxConfig(env){
 const projectId=env.PAYMENT_SANDBOX_PROJECT_ID;
 const productionId=env.PRODUCTION_FIREBASE_PROJECT_ID;
 const valid=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id);
 if(!valid(projectId)||!valid(productionId)||projectId===productionId)throw Error('Separate valid sandbox and production Firebase project IDs required');
 if(!/^sk_test_\S+$/.test(env.PAYSTACK_SECRET||''))throw Error('Sandbox Paystack key required');
 return {projectId};
}
module.exports={sandboxConfig};
