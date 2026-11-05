import { Router } from "express";
import { Order } from "../models/index.js";
import { verifyDarajaCallback } from "../services/daraja.js";
const router=Router();
router.post("/daraja/callback",async(req,res,next)=>{try{
 const result=verifyDarajaCallback(req.body);if(!result)return res.status(400).json({ResultCode:1,ResultDesc:"Invalid callback payload"});
 const order=await Order.findOne({checkoutRequestId:result.checkoutRequestId});if(!order)return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});
 if(result.resultCode===0){if(result.amount!==Math.round(order.subtotal)){console.warn("Daraja amount mismatch for order",order.orderNumber);return res.status(200).json({ResultCode:0,ResultDesc:"Callback acknowledged"});}if(order.paymentStatus!=="paid"){order.paymentStatus="paid";order.paymentReference=result.receipt||"DARaja-confirmed";await order.save();}}
 else if(order.paymentStatus==="pending"){order.paymentStatus="failed";await order.save();}
 return res.status(200).json({ResultCode:0,ResultDesc:"Callback processed"});
}catch(e){next(e);}});
export default router;
