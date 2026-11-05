import { Router } from "express";
import { Order,Campaign,Location,PaymentTransaction } from "../models/index.js";
import { Subscription } from "../models/Subscription.js";
import { normalizePhone, verifyDarajaCallback } from "../services/daraja.js";

const router = Router();

router.post("/daraja/callback", async (req, res, next) => {
  try {
    const result = verifyDarajaCallback(req.body);
    if (!result) return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });

    const subscription=await Subscription.findOne({checkoutRequestId:result.checkoutRequestId});
    if(subscription){
      if(subscription.paymentStatus!=="pending")return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});
      if(result.resultCode===0){
        const callbackPhone=normalizePhone(result.phone),expectedPhone=normalizePhone(subscription.checkoutPhone);
        const validReceipt=Boolean(result.receipt&&/^[A-Z0-9]{6,20}$/i.test(result.receipt));
        const validAmount=Number.isSafeInteger(result.amount)&&result.amount===subscription.requestedAmount;
        if(!validReceipt||!validAmount||!callbackPhone||callbackPhone!==expectedPhone){
          console.warn("Daraja subscription callback validation failed",String(subscription.organization));
          return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});
        }
        const now=new Date(),duration=subscription.requestedBillingCycle==="annual"?365:30;
        subscription.plan=subscription.requestedPlan;subscription.billingCycle=subscription.requestedBillingCycle;
        subscription.status="active";subscription.currentPeriodStartsAt=now;subscription.currentPeriodEndsAt=new Date(now.getTime()+duration*86400000);
        subscription.graceEndsAt=new Date(subscription.currentPeriodEndsAt.getTime()+7*86400000);
        await PaymentTransaction.create({checkoutRequestId:result.checkoutRequestId,merchantRequestId:subscription.merchantRequestId,organization:subscription.organization,kind:"subscription",entityId:subscription._id,amount:result.amount,phone:callbackPhone,status:"paid",receipt:result.receipt,resultCode:result.resultCode,resultDescription:result.resultDescription,callbackAt:now});\n        subscription.lastPaymentReference=result.receipt;subscription.lastPaymentAt=now;subscription.paymentStatus="paid";
      }else{subscription.paymentStatus="failed";}
      await subscription.save();
      return res.status(200).json({ResultCode:0,ResultDesc:"Subscription callback processed"});
    }


    const campaign=await Campaign.findOne({checkoutRequestId:result.checkoutRequestId});
    if(campaign){
      if(campaign.paymentStatus!=="pending")return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});
      const callbackPhone=normalizePhone(result.phone),expectedPhone=normalizePhone(campaign.checkoutPhone);
      const validReceipt=Boolean(result.receipt&&/^[A-Z0-9]{6,20}$/i.test(result.receipt));
      const validAmount=Number.isSafeInteger(result.amount)&&result.amount===campaign.price;
      if(result.resultCode!==0){campaign.paymentStatus="failed";await campaign.save();return res.status(200).json({ResultCode:0,ResultDesc:"Campaign payment failed"});}
      if(!validReceipt||!validAmount||!callbackPhone||callbackPhone!==expectedPhone){console.warn("Daraja sponsored campaign callback validation failed",String(campaign._id));return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});}
      const location=await Location.findById(campaign.location).select("organization");
      await PaymentTransaction.create({checkoutRequestId:result.checkoutRequestId,organization:location?.organization,kind:"campaign",entityId:campaign._id,amount:result.amount,phone:callbackPhone,status:"paid",receipt:result.receipt,resultCode:result.resultCode,resultDescription:result.resultDescription,callbackAt:new Date()});
      campaign.paymentStatus="paid";campaign.paymentReference=result.receipt;campaign.reviewStatus="pending";campaign.published=false;await campaign.save();
      return res.status(200).json({ResultCode:0,ResultDesc:"Sponsored campaign payment confirmed; awaiting moderation"});
    }

    const order = await Order.findOne({ checkoutRequestId: result.checkoutRequestId });
    if (!order) return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });

    // A checkout ID is only valid for the M-Pesa transaction that created it.
    // Never allow a callback to change cash/card orders or overwrite a settled payment.
    if (order.paymentMethod !== "mpesa" || order.paymentStatus !== "pending") {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
    }

    if (result.resultCode === 0) {
      const callbackPhone = normalizePhone(result.phone);
      const orderPhone = normalizePhone(order.customerPhone);
      const validReceipt = Boolean(result.receipt && /^[A-Z0-9]{6,20}$/i.test(result.receipt));
      const validAmount = Number.isSafeInteger(result.amount) && result.amount === Math.round(order.subtotal);
      if (!validReceipt || !validAmount || !callbackPhone || !orderPhone || callbackPhone !== orderPhone) {
        console.warn("Daraja callback validation failed for order", order.orderNumber);
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
      }
      order.paymentStatus = "paid";
      order.paymentReference = result.receipt;
      await order.save();
    } else {
      order.paymentStatus = "failed";
      await order.save();
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processed" });
  } catch (error) {
    return next(error);
  }
});

export default router;
