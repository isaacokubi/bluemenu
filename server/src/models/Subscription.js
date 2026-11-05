import mongoose from "mongoose";
const { Schema, model } = mongoose;
const subscriptionSchema = new Schema({
  organization:{type:Schema.Types.ObjectId,ref:"Organization",required:true,index:true,unique:true},
  plan:{type:String,enum:["starter","business","professional","enterprise"],default:"starter"},
  status:{type:String,enum:["trialing","active","past_due","suspended","cancelled"],default:"trialing",index:true},
  billingCycle:{type:String,enum:["monthly","annual"],default:"monthly"},
  trialStartsAt:{type:Date,default:Date.now},
  trialEndsAt:{type:Date,default:()=>new Date(Date.now()+14*86400000)},
  currentPeriodStartsAt:Date,
  currentPeriodEndsAt:Date,
  graceEndsAt:Date,
  lastPaymentReference:String,
  lastPaymentAt:Date,
  mpesaPhone:String,
  cancellationRequestedAt:Date,\n  requestedPlan:{type:String,enum:["starter","business","professional","enterprise"]},\n  requestedBillingCycle:{type:String,enum:["monthly","annual"]},\n  planRequestAt:Date
},{timestamps:true});
subscriptionSchema.index({status:1,currentPeriodEndsAt:1});
export const Subscription=model("Subscription",subscriptionSchema);
export const PLAN_CATALOG={
  starter:{name:"Starter",monthly:500,annual:5000,limits:{locations:1,menus:5,teamMembers:2,monthlyOrders:100},features:["Digital menus","QR sharing","Basic agendas"]},
  business:{name:"Business",monthly:1500,annual:15000,limits:{locations:3,menus:30,teamMembers:10,monthlyOrders:1000},features:["Menus and agendas","Orders","Hotel requests","Attendance","Basic reports"]},
  professional:{name:"Professional",monthly:3500,annual:35000,limits:{locations:10,menus:150,teamMembers:40,monthlyOrders:10000},features:["All Business features","Advanced analytics","Multi-location","Priority support"]},
  enterprise:{name:"Enterprise",monthly:null,annual:null,limits:{locations:null,menus:null,teamMembers:null,monthlyOrders:null},features:["Custom limits","Dedicated onboarding","Enterprise integrations"]}
};
