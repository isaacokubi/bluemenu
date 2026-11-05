import { Router } from "express";
import mongoose from "mongoose";
import { InformationItem,Location,AuditLog } from "../models/index.js";
import { requireAuth,allowRoles } from "../middleware/auth.js";
import { isSafeInformationUrl,parsePublicationWindow,sanitizeInformationMetadata } from "../services/informationValidation.js";
const router=Router();
router.use(requireAuth);
const editable=allowRoles("owner","manager","editor");
const validId=id=>mongoose.isValidObjectId(id);

async function audit(req,action,id,details={}){try{await AuditLog.create({organization:req.user.organization,actor:req.user._id,action,entityType:"information",entityId:String(id||""),details,ipAddress:req.ip,userAgent:String(req.get("user-agent")||"").slice(0,300)});}catch(error){console.error("Information audit failed:",error.message);}}
router.get("/information",async(req,res,next)=>{try{const ids=await Location.find({organization:req.user.organization}).distinct("_id");const items=await InformationItem.find({organization:req.user.organization,$or:[{location:null},{location:{$in:ids}}]}).populate("location","name publicSlug").sort({createdAt:-1}).limit(300).lean();res.json({items});}catch(error){next(error);}});
router.post("/information",editable,async(req,res,next)=>{try{
 const {locationId,type,title,body,linkUrl,imageUrl,visibility,priority,startsAt,endsAt,eventCapacity,ticketPriceKES}=req.body||{};
 if(!["announcement","document","signage","event","lost_found","directory"].includes(type)||!String(title||"").trim()||!String(body||"").trim())return res.status(400).json({error:"A valid content type, title and description are required"});
 let location=null;if(locationId){if(!validId(locationId))return res.status(400).json({error:"Invalid location"});location=await Location.findOne({_id:locationId,organization:req.user.organization});if(!location)return res.status(404).json({error:"Location not found"});}
 if(!isSafeInformationUrl(linkUrl)||!isSafeInformationUrl(imageUrl))return res.status(400).json({error:"Links must be safe relative paths or HTTPS URLs"});
 const schedule=parsePublicationWindow(startsAt,endsAt);if(!schedule.valid)return res.status(400).json({error:"Enter a valid publication date range"});const {start,end}=schedule;
 const capacity=Number(eventCapacity||0),ticketPrice=Number(ticketPriceKES||0);if(type==="event"&&(!Number.isSafeInteger(capacity)||capacity<0||!Number.isSafeInteger(ticketPrice)||ticketPrice<0))return res.status(400).json({error:"Event capacity and ticket price must be non-negative whole numbers"});const item=await InformationItem.create({organization:req.user.organization,location:location?._id||null,type,eventCapacity:type==="event"?capacity:0,ticketPriceKES:type==="event"?ticketPrice:0,title:String(title).trim().slice(0,180),body:String(body).trim().slice(0,10000),linkUrl:String(linkUrl||"").trim().slice(0,1000),imageUrl:String(imageUrl||"").trim().slice(0,1000),metadata:(type==="lost_found"||type==="directory")?sanitizeInformationMetadata(req.body.metadata,type):{},visibility:visibility==="internal"?"internal":"public",priority:["normal","important","emergency"].includes(priority)?priority:"normal",startsAt:start,endsAt:end,createdBy:req.user._id});
 await audit(req,"information.created",item._id,{title:item.title,type:item.type});res.status(201).json({item});
}catch(error){next(error);}});
router.patch("/information/:id",editable,async(req,res,next)=>{try{
 if(!validId(req.params.id))return res.status(400).json({error:"Invalid information item"});
 const item=await InformationItem.findOne({_id:req.params.id,organization:req.user.organization});if(!item)return res.status(404).json({error:"Information item not found"});
 if(req.body.published!==undefined){if(!["owner","manager"].includes(req.user.role))return res.status(403).json({error:"Only owners and managers can publish information"});item.published=Boolean(req.body.published);item.publishedAt=item.published?new Date():null;}
 for(const key of ["title","body","linkUrl","imageUrl","visibility","priority","startsAt","endsAt"])if(req.body[key]!==undefined)item[key]=req.body[key];if(req.body.metadata!==undefined){if(!["lost_found","directory"].includes(item.type))return res.status(400).json({error:"Metadata is only supported for directory and lost-and-found records"});item.metadata=sanitizeInformationMetadata(req.body.metadata,item.type);}if(req.body.eventCapacity!==undefined||req.body.ticketPriceKES!==undefined){if(item.type!=="event")return res.status(400).json({error:"Ticket settings apply only to events"});const capacity=Number(req.body.eventCapacity??item.eventCapacity),price=Number(req.body.ticketPriceKES??item.ticketPriceKES);if(!Number.isSafeInteger(capacity)||capacity<item.ticketsIssued||!Number.isSafeInteger(price)||price<0)return res.status(400).json({error:"Capacity cannot be below tickets already issued; ticket price must be a non-negative whole number"});item.eventCapacity=capacity;item.ticketPriceKES=price;}
 if(req.body.locationId!==undefined){if(!req.body.locationId)item.location=null;else{if(!validId(req.body.locationId))return res.status(400).json({error:"Invalid location"});const loc=await Location.findOne({_id:req.body.locationId,organization:req.user.organization});if(!loc)return res.status(404).json({error:"Location not found"});item.location=loc._id;}}
 if(!isSafeInformationUrl(item.linkUrl)||!isSafeInformationUrl(item.imageUrl))return res.status(400).json({error:"Links must be safe relative paths or HTTPS URLs"});
 const schedule=parsePublicationWindow(item.startsAt,item.endsAt);if(!schedule.valid)return res.status(400).json({error:"End date must be after start date"});
 await item.save();await audit(req,item.published?"information.published":"information.updated",item._id,{title:item.title,published:item.published});res.json({item});
}catch(error){next(error);}});
router.delete("/information/:id",allowRoles("owner","manager"),async(req,res,next)=>{try{if(!validId(req.params.id))return res.status(400).json({error:"Invalid information item"});const result=await InformationItem.deleteOne({_id:req.params.id,organization:req.user.organization});if(result.deletedCount)await audit(req,"information.deleted",req.params.id);res.json({deleted:result.deletedCount===1});}catch(error){next(error);}});
export default router;
