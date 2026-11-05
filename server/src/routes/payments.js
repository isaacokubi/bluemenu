import { Router } from "express";
import { Order } from "../models/index.js";
import { Subscription } from "../models/Subscription.js";
import { normalizePhone, verifyDarajaCallback } from "../services/daraja.js";

const router = Router();

router.post("/daraja/callback", async (req, res, next) => {
  try {
    const result = verifyDarajaCallback(req.body);
    if (!result) return res.status(400).json({ ResultCode: 1, ResultDesc: "Invalid callback payload" });

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
