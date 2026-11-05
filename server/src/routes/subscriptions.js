import { Router } from "express";
import { Subscription,PLAN_CATALOG } from "../models/Subscription.js";
import crypto from "node:crypto";
import { Organization,Notification } from "../models/index.js";
import { sendOrganizationPush } from "../services/push.js";
import { initiateStkPush } from "../services/daraja.js";
import { normalizePhone } from "../services/daraja.js";
import { requireAuth,allowRoles } from "../middleware/auth.js";
const router=Router();
router.get("/plans",(_req,res)=>res.json({currency:"KES",trialDays:14,plans:Object.entries(PLAN_CATALOG).map(([id,p])=>({id,...p}))}));
router.get("/me",requireAuth,async(req,res,next)=>{try{
 let subscription=await Subscription.findOne({organization:req.user.organization});
 if(!subscription){subscription=await Subscription.create({organization:req.user.organization});}
 const plan=PLAN_CATALOG[subscription.plan]||PLAN_CATALOG.starter;
 const now=new Date();
 const trialExpired=subscription.status==="trialing"&&subscription.trialEndsAt&&subscription.trialEndsAt<=now;
 const periodExpired=["active","past_due"].includes(subscription.status)&&subscription.currentPeriodEndsAt&&subscription.currentPeriodEndsAt<=now;
 const effectiveStatus=trialExpired?"past_due":periodExpired?"past_due":subscription.status;
 res.json({subscription:{...subscription.toObject(),effectiveStatus},plan,plans:Object.entries(PLAN_CATALOG).map(([id,p])=>({id,...p}))});
}catch(e){next(e);}});
router.post("/checkout",requireAuth,allowRoles("owner"),async(req,res,next)=>{try{
 const plan=String(req.body?.plan||"");const cycle=String(req.body?.billingCycle||"monthly");const phone=normalizePhone(req.body?.phone);
 if(!PLAN_CATALOG[plan]||plan==="enterprise"||!["monthly","annual"].includes(cycle)||!phone)return res.status(400).json({error:"Choose a self-service plan, billing cycle and valid Kenyan M-Pesa phone"});
 const amount=PLAN_CATALOG[plan][cycle];if(!Number.isSafeInteger(amount)||amount<1)return res.status(400).json({error:"This plan cannot be purchased online"});
 let subscription=await Subscription.findOne({organization:req.user.organization});if(!subscription)subscription=await Subscription.create({organization:req.user.organization});
 const stk=await initiateStkPush({phone,amount,accountReference:"BM-"+String(req.user.organization).slice(-8),transactionDesc:"BlueMenu "+PLAN_CATALOG[plan].name+" subscription"});
 subscription.requestedPlan=plan;subscription.requestedBillingCycle=cycle;subscription.requestedAmount=amount;subscription.checkoutPhone=phone;subscription.checkoutRequestId=stk.checkoutRequestId;subscription.merchantRequestId=stk.merchantRequestId;subscription.paymentStatus="pending";subscription.planRequestAt=new Date();await subscription.save();
 res.status(202).json({message:stk.customerMessage,awaitingPin:true,amount,plan,billingCycle:cycle});
}catch(e){next(e);}});
router.post("/plan-request",requireAuth,allowRoles("owner"),async(req,res,next)=>{try{
 const plan=String(req.body?.plan||"");const cycle=String(req.body?.billingCycle||"monthly");
 if(!PLAN_CATALOG[plan]||!["monthly","annual"].includes(cycle))return res.status(400).json({error:"Choose a valid plan and billing cycle"});
 if(plan==="enterprise")return res.status(400).json({error:"Enterprise plans require a custom quotation. Contact BlueMenu sales."});
 let subscription=await Subscription.findOne({organization:req.user.organization});
 if(!subscription)subscription=await Subscription.create({organization:req.user.organization});
 subscription.requestedPlan=plan;subscription.requestedBillingCycle=cycle;subscription.planRequestAt=new Date();await subscription.save();
 res.json({message:"Plan request recorded. Your current access remains unchanged until payment is confirmed.",requestedPlan:plan,billingCycle:cycle});
}catch(e){next(e);}});
router.post("/cancel-request",requireAuth,allowRoles("owner"),async(req,res,next)=>{try{const subscription=await Subscription.findOne({organization:req.user.organization});if(!subscription)return res.status(404).json({error:"Subscription not found"});subscription.cancellationRequestedAt=new Date();await subscription.save();res.json({message:"Cancellation request recorded. Access remains active through the paid period.",cancellationRequestedAt:subscription.cancellationRequestedAt});}catch(e){next(e);}});

router.post("/reconcile",async(req,res,next)=>{try{
 const expected=String(process.env.BILLING_RECONCILE_SECRET||""),provided=String(req.get("x-billing-reconcile-secret")||"");
 if(!expected||provided.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return res.status(401).json({error:"Unauthorized billing reconciliation"});
 const now=new Date(),subscriptions=await Subscription.find({$or:[{status:"trialing",trialEndsAt:{$lte:now}},{status:"active",currentPeriodEndsAt:{$lte:now}},{status:"past_due",$or:[{graceEndsAt:null},{graceEndsAt:{$lte:now}}]}]}).limit(500);
 let pastDue=0,suspended=0;
 for(const subscription of subscriptions){
  if(subscription.status==="active"||subscription.status==="trialing"){
   subscription.status="past_due";subscription.graceEndsAt=new Date(now.getTime()+7*86400000);pastDue++;
   const organization=await Organization.findById(subscription.organization).select("name");
   const title="BlueMenu subscription payment due",message="Your "+(organization?.name||"workspace")+" subscription period has ended. Renew to avoid service suspension.";
   await Notification.create({organization:subscription.organization,title,message,type:"billing"});
   try{await sendOrganizationPush({organization:subscription.organization,title,body:message,data:{type:"billing"}});}catch(error){console.warn("Billing push failed:",error.message);}
  }else if(subscription.graceEndsAt&&subscription.graceEndsAt<=now){subscription.status="suspended";suspended++;}
  await subscription.save();
 }
 res.json({checked:subscriptions.length,pastDue,suspended,note:"Standard Daraja STK Push requires a customer PIN for each charge; this job enforces expiry/grace policy and does not silently debit customers."});
 }catch(e){next(e);}});
export default router;
