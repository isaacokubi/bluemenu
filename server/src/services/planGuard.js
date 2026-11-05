import { Subscription,PLAN_CATALOG } from "../models/Subscription.js";
import { Location,Menu,Agenda,User } from "../models/index.js";
const resourceModels={locations:Location,menus:Menu,agendas:Agenda,teamMembers:User};
export async function assertPlanAllows(organization,resource){
 let subscription=await Subscription.findOne({organization});
 if(!subscription)subscription=await Subscription.create({organization});
 const now=new Date();
 if(subscription.status==="trialing"&&subscription.trialEndsAt<=now)return {status:402,error:"Your 14-day trial has ended. Choose a plan to continue creating content."};
 if(["past_due","suspended","cancelled"].includes(subscription.status))return {status:402,error:"Your subscription is not active. Resolve billing to continue creating content."};\n if(subscription.status==="active"&&subscription.currentPeriodEndsAt<=now&&(!subscription.graceEndsAt||subscription.graceEndsAt<=now))return {status:402,error:"Your subscription renewal is overdue. Renew to continue creating content."};
 const plan=PLAN_CATALOG[subscription.plan]||PLAN_CATALOG.starter;
 const limit=plan.limits[resource];
 if(limit===null||limit===undefined)return null;
 const Model=resourceModels[resource];
 let query={};
 if(resource!=="locations")query={organization};
 if(resource==="menus"||resource==="agendas"){
  const ids=await Location.find({organization}).distinct("_id");query={location:{$in:ids}};
 }
 const count=await Model.countDocuments(query);
 if(count>=limit)return {status:402,error:`Your ${plan.name} plan allows ${limit} ${resource}. Upgrade your plan to add more.`,limit,used:count,plan:subscription.plan};
 return null;
}
