import { Router } from "express";
import { Order, Campaign, Location, PaymentTransaction } from "../models/index.js";
import { Subscription } from "../models/Subscription.js";
import { normalizePhone, verifyDarajaCallback } from "../services/daraja.js";

const router = Router();

async function ensurePaymentLedger(record) {
  try {
    await PaymentTransaction.create(record);
    return true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await PaymentTransaction.findOne({ checkoutRequestId: record.checkoutRequestId }).lean();
    return Boolean(existing &&
      existing.kind === record.kind &&
      String(existing.entityId) === String(record.entityId) &&
      existing.amount === record.amount &&
      existing.phone === record.phone &&
      (existing.receipt || null) === (record.receipt || null) &&
      existing.status === record.status);
  }
}

router.post("/daraja/callback", async (req, res, next) => {
  try {
    const result = verifyDarajaCallback(req.body);
    if (!result) return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });

    const subscription = await Subscription.findOne({ checkoutRequestId: result.checkoutRequestId });
    if (subscription) {
      if (subscription.paymentStatus !== "pending") return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
      const expectedPhone = normalizePhone(subscription.checkoutPhone);
      if (result.resultCode === 0) {
        const callbackPhone = normalizePhone(result.phone);
        const validReceipt = Boolean(result.receipt && /^[A-Z0-9]{6,20}$/i.test(result.receipt));
        const validAmount = Number.isSafeInteger(result.amount) && result.amount === subscription.requestedAmount;
        if (!validReceipt || !validAmount || !callbackPhone || callbackPhone !== expectedPhone) {
          console.warn("Daraja subscription callback validation failed", String(subscription.organization));
          return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
        }
        const ledgerSaved = await ensurePaymentLedger({
          checkoutRequestId: result.checkoutRequestId, merchantRequestId: subscription.merchantRequestId,
          organization: subscription.organization, kind: "subscription", entityId: subscription._id,
          amount: result.amount, phone: callbackPhone, status: "paid", receipt: result.receipt,
          resultCode: result.resultCode, resultDescription: result.resultDescription, callbackAt: new Date()
        });
        if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Receipt already used by another payment" });
        const now = new Date(), duration = subscription.requestedBillingCycle === "annual" ? 365 : 30;
        subscription.plan = subscription.requestedPlan;
        subscription.billingCycle = subscription.requestedBillingCycle;
        subscription.status = "active";
        subscription.currentPeriodStartsAt = now;
        subscription.currentPeriodEndsAt = new Date(now.getTime() + duration * 86400000);
        subscription.graceEndsAt = new Date(subscription.currentPeriodEndsAt.getTime() + 7 * 86400000);
        subscription.lastPaymentReference = result.receipt;
        subscription.lastPaymentAt = now;
        subscription.mpesaPhone = expectedPhone;
        subscription.renewalPhone = subscription.renewalPhone || expectedPhone;
        subscription.paymentStatus = "paid";
        subscription.nextBillingAt = new Date(subscription.currentPeriodEndsAt);
        subscription.lastRenewalError = undefined;
      } else {
        const ledgerSaved = await ensurePaymentLedger({
          checkoutRequestId: result.checkoutRequestId, merchantRequestId: subscription.merchantRequestId,
          organization: subscription.organization, kind: "subscription", entityId: subscription._id,
          amount: Number(subscription.requestedAmount || 0), phone: expectedPhone || "unknown",
          status: "failed", resultCode: result.resultCode, resultDescription: result.resultDescription, callbackAt: new Date()
        });
        if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Payment reference already used" });
        subscription.paymentStatus = "failed";
        if (subscription.autoRenewEnabled) subscription.status = subscription.graceEndsAt && subscription.graceEndsAt > new Date() ? "past_due" : "past_due";
        subscription.lastRenewalError = result.resultDescription.slice(0, 300);
      }
      await subscription.save();
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Subscription callback processed" });
    }

    const campaign = await Campaign.findOne({ checkoutRequestId: result.checkoutRequestId });
    if (campaign) {
      if (campaign.paymentStatus !== "pending") return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
      const expectedPhone = normalizePhone(campaign.paymentPhone);
      if (result.resultCode === 0) {
        const callbackPhone = normalizePhone(result.phone);
        const validReceipt = Boolean(result.receipt && /^[A-Z0-9]{6,20}$/i.test(result.receipt));
        const validAmount = Number.isSafeInteger(result.amount) && result.amount === campaign.budgetKES;
        if (!validReceipt || !validAmount || !callbackPhone || callbackPhone !== expectedPhone) {
          console.warn("Daraja advert callback validation failed", String(campaign._id));
          return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
        }
        const ledgerSaved = await ensurePaymentLedger({
          checkoutRequestId: result.checkoutRequestId, organization: campaign.advertiserOrganization,
          kind: "campaign", entityId: campaign._id, amount: result.amount, phone: callbackPhone,
          status: "paid", receipt: result.receipt, resultCode: result.resultCode,
          resultDescription: result.resultDescription, callbackAt: new Date()
        });
        if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Receipt already used by another payment" });
        campaign.paymentStatus = "paid";
        campaign.paymentReference = result.receipt;
      } else {
        const ledgerSaved = await ensurePaymentLedger({
          checkoutRequestId: result.checkoutRequestId, organization: campaign.advertiserOrganization,
          kind: "campaign", entityId: campaign._id, amount: Number(campaign.budgetKES || 0),
          phone: expectedPhone || "unknown", status: "failed", resultCode: result.resultCode,
          resultDescription: result.resultDescription, callbackAt: new Date()
        });
        if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Payment reference already used" });
        campaign.paymentStatus = "failed";
      }
      await campaign.save();
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Campaign payment callback processed" });
    }

    const order = await Order.findOne({ checkoutRequestId: result.checkoutRequestId });
    if (!order) return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
    if (order.paymentMethod !== "mpesa" || order.paymentStatus !== "pending") {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
    }
    const location = await Location.findById(order.location).select("organization");
    const expectedAmount = Math.round(order.subtotal);
    const expectedPhone = normalizePhone(order.customerPhone);
    if (result.resultCode === 0) {
      const callbackPhone = normalizePhone(result.phone);
      const validReceipt = Boolean(result.receipt && /^[A-Z0-9]{6,20}$/i.test(result.receipt));
      const validAmount = Number.isSafeInteger(result.amount) && result.amount === expectedAmount;
      if (!validReceipt || !validAmount || !callbackPhone || !expectedPhone || callbackPhone !== expectedPhone) {
        console.warn("Daraja callback validation failed for order", order.orderNumber);
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback acknowledged" });
      }
      const ledgerSaved = await ensurePaymentLedger({
        checkoutRequestId: result.checkoutRequestId, organization: location?.organization,
        kind: "order", entityId: order._id, amount: result.amount, phone: callbackPhone,
        status: "paid", receipt: result.receipt, resultCode: result.resultCode,
        resultDescription: result.resultDescription, callbackAt: new Date()
      });
      if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Receipt already used by another payment" });
      order.paymentStatus = "paid";
      order.paymentReference = result.receipt;
    } else {
      const ledgerSaved = await ensurePaymentLedger({
        checkoutRequestId: result.checkoutRequestId, organization: location?.organization,
        kind: "order", entityId: order._id, amount: expectedAmount,
        phone: expectedPhone || "unknown", status: "failed", resultCode: result.resultCode,
        resultDescription: result.resultDescription, callbackAt: new Date()
      });
      if (!ledgerSaved) return res.status(200).json({ ResultCode: 0, ResultDesc: "Payment reference already used" });
      order.paymentStatus = "failed";
    }
    await order.save();
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Callback processed" });
  } catch (error) {
    return next(error);
  }
});

export default router;
