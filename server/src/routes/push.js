import { Router } from "express";
import { DeviceToken } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router();
router.get("/config",(_req,res)=>res.json({firebase:{apiKey:process.env.FIREBASE_WEB_API_KEY||"",authDomain:process.env.FIREBASE_WEB_AUTH_DOMAIN||"",projectId:process.env.FIREBASE_WEB_PROJECT_ID||"",messagingSenderId:process.env.FIREBASE_WEB_MESSAGING_SENDER_ID||"",appId:process.env.FIREBASE_WEB_APP_ID||""},vapidKey:process.env.FIREBASE_WEB_VAPID_KEY||""}));
router.use(requireAuth);
router.post("/register",async(req,res,next)=>{try{const token=String(req.body?.token||"").trim(),platform=String(req.body?.platform||"web");if(token.length<40||token.length>4096||!["web","android","ios"].includes(platform))return res.status(400).json({error:"A valid FCM registration token and platform are required"});await DeviceToken.findOneAndUpdate({token},{organization:req.user.organization,user:req.user._id,token,platform,active:true,lastSeenAt:new Date()},{upsert:true,new:true,setDefaultsOnInsert:true});res.status(201).json({registered:true});}catch(e){next(e);}});
router.delete("/register",async(req,res,next)=>{try{const token=String(req.body?.token||"").trim();if(!token)return res.status(400).json({error:"Token is required"});await DeviceToken.updateOne({token,organization:req.user.organization,user:req.user._id},{$set:{active:false}});res.json({removed:true});}catch(e){next(e);}});
export default router;
