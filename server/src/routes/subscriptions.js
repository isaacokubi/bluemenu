import { Router } from "express";
import { Subscription,PLAN_CATALOG } from "../models/Subscription.js";
import { Organization } from "../models/index.js";
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
export default router;
