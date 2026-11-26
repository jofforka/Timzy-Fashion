'use strict';
const {sandboxConfig}=require('./payment-sandbox-config.cjs');
function runtimeConfig(env){
 const mode=env.PAYMENT_MODE||'test';
 if(mode==='test')return {...sandboxConfig(env),mode};
 if(mode!=='live')throw Error('Invalid payment mode');
 if(env.PAYMENT_LIVE_APPROVED!=='true')throw Error('Live mode not approved');
 const projectId=env.PRODUCTION_FIREBASE_PROJECT_ID;
 const sandbox=env.PAYMENT_SANDBOX_PROJECT_ID;
 const valid=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id);
 if(!valid(projectId)||!valid(sandbox)||projectId===sandbox)throw Error('Separate valid projects required');
 if(!/^sk_live_\S+$/.test(env.PAYSTACK_SECRET||''))throw Error('Live key required');
 return {projectId,mode};
}
module.exports={runtimeConfig};
