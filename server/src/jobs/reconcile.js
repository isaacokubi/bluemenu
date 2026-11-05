import process from "node:process";

const base=String(process.env.API_BASE_URL||"").replace(/\/$/,"");
if(!/^https:\/\//i.test(base)) {
  console.error("API_BASE_URL must be the public HTTPS base URL for the BlueMenu API");
  process.exit(1);
}
const jobs=[
  {path:"/api/payments/daraja/reconcile",header:"x-reconcile-secret",secret:process.env.DARAJA_RECONCILE_SECRET},
  {path:"/api/subscriptions/reconcile",header:"x-billing-reconcile-secret",secret:process.env.BILLING_RECONCILE_SECRET}
];
let failed=false;
for(const job of jobs){
  if(!job.secret){console.error("Missing secret for "+job.path);failed=true;continue;}
  try{
    const response=await fetch(base+job.path,{method:"POST",headers:{[job.header]:job.secret,"Content-Type":"application/json"},signal:AbortSignal.timeout(30000)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){console.error(job.path+" failed ("+response.status+")",body);failed=true;}
    else console.log(job.path,JSON.stringify(body));
  }catch(error){console.error(job.path,error.message);failed=true;}
}
if(failed)process.exit(1);
