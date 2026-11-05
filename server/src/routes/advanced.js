import { Router } from "express";
import mongoose from "mongoose";
import { Agenda,Attendance,Location,Organization,Reservation,TableBooking,Room,RoomNight,TableSlot,DeviceToken,MeetingResolution,Notification,OfflineEvent,QueueTicket,AuditLog,Campaign } from "../models/index.js";
import { requireAuth,allowRoles } from "../middleware/auth.js";
import { sendOrganizationPush } from "../services/push.js";
import { initiateStkPush, normalizePhone } from "../services/daraja.js";
import { replayOfflineCommand } from "../services/offlineSync.js";
const router=Router();router.use(requireAuth);
const edit=allowRoles("owner","manager","editor");
const idOk=id=>mongoose.isValidObjectId(id);
const locations=async org=>Location.find({organization:org}).distinct("_id");
async function audit(req,action,type,id,details={}){try{await AuditLog.create({organization:req.user.organization,actor:req.user._id,action,entityType:type,entityId:String(id||""),details,ipAddress:req.ip,userAgent:String(req.get("user-agent")||"").slice(0,300)});}catch(e){console.error("Audit write failed",e.message);}}
router.get("/reservations",async(req,res,next)=>{try{const ids=await locations(req.user.organization);res.json({reservations:await Reservation.find({location:{$in:ids}}).sort({createdAt:-1}).limit(300).lean()});}catch(e){next(e);}});
router.patch("/reservations/:id",edit,async(req,res,next)=>{let session;try{
 if(!idOk(req.params.id))return res.status(400).json({error:"Invalid reservation"});
 const ids=await locations(req.user.organization),reservation=await Reservation.findOne({_id:req.params.id,location:{$in:ids}});
 if(!reservation)return res.status(404).json({error:"Reservation not found"});
 const nextStatus=String(req.body?.status||reservation.status);
 if(!["requested","confirmed","checked_in","checked_out","cancelled"].includes(nextStatus))return res.status(400).json({error:"Invalid reservation status"});
 if(req.body.paymentStatus!==undefined)return res.status(403).json({error:"Payment status requires verified provider processing"});
 if(["confirmed","checked_in"].includes(nextStatus)&&!reservation.assignedRooms?.length){
   const start=new Date(reservation.checkIn);start.setUTCHours(0,0,0,0);const end=new Date(reservation.checkOut);end.setUTCHours(0,0,0,0);
   if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return res.status(400).json({error:"Check-in and check-out must be valid dates, with check-out after check-in"});
   const nights=[];for(let d=new Date(start);d<end;d.setUTCDate(d.getUTCDate()+1))nights.push(new Date(d));
   const perRoomCapacity=Math.ceil(reservation.guests/Math.max(1,reservation.rooms));
   const candidates=await Room.find({location:reservation.location,active:true,capacity:{$gte:perRoomCapacity},...(reservation.roomType?{roomType:reservation.roomType}:{})}).sort({roomNumber:1}).lean();
   const busy=await RoomNight.distinct("room",{location:reservation.location,night:{$in:nights}});
   const available=candidates.filter(r=>!busy.some(id=>String(id)===String(r._id))).slice(0,Math.max(1,reservation.rooms));
   if(available.length<Math.max(1,reservation.rooms))return res.status(409).json({error:"Insufficient rooms available for the requested dates and guest count"});
   session=await mongoose.startSession();session.startTransaction();
   const allocations=[];for(const room of available)for(const night of nights)allocations.push({room:room._id,location:reservation.location,night,reservation:reservation._id});
   await RoomNight.insertMany(allocations,{session,ordered:true});
   reservation.assignedRooms=available.map(r=>r._id);reservation.status=nextStatus;
   if(nextStatus==="checked_in")reservation.checkedInAt=new Date();
   await reservation.save({session});await session.commitTransaction();
 }else{
   if(nextStatus==="checked_in"&&!reservation.assignedRooms?.length)return res.status(409).json({error:"Confirm and allocate rooms before check-in"});
   if(["cancelled","checked_out"].includes(nextStatus)&&reservation.assignedRooms?.length){
     session=await mongoose.startSession();session.startTransaction();
     await RoomNight.deleteMany({reservation:reservation._id},{session});
     reservation.status=nextStatus;if(nextStatus==="checked_out")reservation.checkedOutAt=new Date();
     await reservation.save({session});await session.commitTransaction();
   }else{reservation.status=nextStatus;if(nextStatus==="checked_in")reservation.checkedInAt=new Date();await reservation.save();}
 }
 await audit(req,"reservation.status_changed","reservation",reservation._id,{status:reservation.status,assignedRooms:reservation.assignedRooms?.length||0});
 res.json({reservation,allocatedRooms:reservation.assignedRooms?.length||0});
 }catch(e){if(session?.inTransaction())await session.abortTransaction().catch(()=>{});if(e?.code===11000)return res.status(409).json({error:"Room inventory changed while confirming. Refresh availability and retry."});next(e);}finally{await session?.endSession().catch(()=>{});}});
router.get("/table-bookings",async(req,res,next)=>{try{const ids=await locations(req.user.organization);res.json({bookings:await TableBooking.find({location:{$in:ids}}).sort({bookingAt:1}).limit(300).lean()});}catch(e){next(e);}});
router.patch("/table-bookings/:id",allowRoles("owner","manager"),async(req,res,next)=>{let session;try{
 if(!idOk(req.params.id)||!["requested","confirmed","seated","completed","cancelled","no_show"].includes(req.body.status))return res.status(400).json({error:"Invalid table booking or status"});
 const ids=await locations(req.user.organization),booking=await TableBooking.findOne({_id:req.params.id,location:{$in:ids}});
 if(!booking)return res.status(404).json({error:"Table booking not found"});
 const nextStatus=req.body.status,holding=["confirmed","seated"].includes(nextStatus);
 if(holding&&!booking.capacityHeld){
   const location=await Location.findOne({_id:booking.location,organization:req.user.organization}).select("tableCapacity");
   if(!location)return res.status(404).json({error:"Location not found"});
   const slotMs=30*60*1000,slotStart=new Date(Math.floor(new Date(booking.bookingAt).getTime()/slotMs)*slotMs);
   session=await mongoose.startSession();session.startTransaction();
   let slot=await TableSlot.findOne({location:booking.location,slotStart}).session(session);
   if(!slot){[slot]=await TableSlot.create([{location:booking.location,slotStart,capacity:location.tableCapacity||50,reservedCovers:0}],{session});}
   const updated=await TableSlot.findOneAndUpdate({_id:slot._id,$expr:{$lte:[{$add:["$reservedCovers",booking.partySize]},"$capacity"]}},{$inc:{reservedCovers:booking.partySize}},{new:true,session});
   if(!updated){await session.abortTransaction();return res.status(409).json({error:"This time slot has reached its table capacity"});}
   booking.capacitySlot=slotStart;booking.capacityHeld=true;booking.confirmedAt=new Date();booking.status=nextStatus;await booking.save({session});await session.commitTransaction();
 }else if(!holding&&booking.capacityHeld){
   session=await mongoose.startSession();session.startTransaction();
   await TableSlot.updateOne({location:booking.location,slotStart:booking.capacitySlot,reservedCovers:{$gte:booking.partySize}},{$inc:{reservedCovers:-booking.partySize}},{session});
   booking.capacityHeld=false;booking.status=nextStatus;await booking.save({session});await session.commitTransaction();
 }else{booking.status=nextStatus;await booking.save();}
 await audit(req,"table_booking.status_changed","table_booking",booking._id,{status:booking.status,capacityHeld:booking.capacityHeld});
 res.json({booking});
 }catch(e){if(session?.inTransaction())await session.abortTransaction().catch(()=>{});if(e?.code===11000)return res.status(409).json({error:"Another booking reserved this time slot. Refresh and retry."});next(e);}finally{await session?.endSession().catch(()=>{});}});
router.get("/rooms",async(req,res,next)=>{try{const ids=await locations(req.user.organization);res.json({rooms:await Room.find({location:{$in:ids}}).sort({roomNumber:1}).lean()});}catch(e){next(e);}});
router.post("/rooms",edit,async(req,res,next)=>{try{const {locationId,roomNumber,roomType,capacity,ratePerNight}=req.body||{};if(!idOk(locationId)||!String(roomNumber||"").trim()||!String(roomType||"").trim())return res.status(400).json({error:"Location, room number and room type are required"});const loc=await Location.findOne({_id:locationId,organization:req.user.organization});if(!loc)return res.status(404).json({error:"Location not found"});const room=await Room.create({location:loc._id,roomNumber:String(roomNumber).trim().slice(0,40),roomType:String(roomType).trim().slice(0,80),capacity:Math.max(1,Math.min(20,Number(capacity)||2)),ratePerNight:Math.max(0,Number(ratePerNight)||0)});await audit(req,"room.created","room",room._id);res.status(201).json({room});}catch(e){next(e);}});
router.patch("/rooms/:id",edit,async(req,res,next)=>{try{if(!idOk(req.params.id))return res.status(400).json({error:"Invalid room"});const ids=await locations(req.user.organization);const room=await Room.findOne({_id:req.params.id,location:{$in:ids}});if(!room)return res.status(404).json({error:"Room not found"});for(const k of ["roomNumber","roomType","capacity","ratePerNight","active"])if(req.body[k]!==undefined)room[k]=req.body[k];await room.save();await audit(req,"room.updated","room",room._id);res.json({room});}catch(e){next(e);}});
router.get("/room-availability",async(req,res,next)=>{try{const {locationId,checkIn,checkOut,roomType}=req.query;if(!idOk(locationId)||!checkIn||!checkOut||Number.isNaN(new Date(checkIn).getTime())||Number.isNaN(new Date(checkOut).getTime())||new Date(checkOut)<=new Date(checkIn))return res.status(400).json({error:"Valid location, check-in and later check-out dates are required"});const loc=await Location.findOne({_id:locationId,organization:req.user.organization});if(!loc)return res.status(404).json({error:"Location not found"});const rooms=await Room.find({location:loc._id,active:true,...(roomType?{roomType}: {})}).lean();const start=new Date(checkIn);start.setUTCHours(0,0,0,0);const end=new Date(checkOut);end.setUTCHours(0,0,0,0);const nights=[];for(let d=new Date(start);d<end;d.setUTCDate(d.getUTCDate()+1))nights.push(new Date(d));const allocations=await RoomNight.distinct("room",{location:loc._id,night:{$in:nights}});const occupied=new Set(allocations.map(String));const legacy=await Reservation.find({location:loc._id,status:{$in:["confirmed","checked_in"]},assignedRooms:{$size:0},checkIn:{$lt:end},checkOut:{$gt:start}}).lean();for(const booking of legacy){rooms.filter(room=>!booking.roomType||room.roomType===booking.roomType).slice(0,Math.max(1,booking.rooms||1)).forEach(room=>occupied.add(String(room._id)));}res.json({availableRooms:rooms.filter(r=>!occupied.has(String(r._id))),totalRooms:rooms.length,occupiedRooms:occupied.size,period:{checkIn,checkOut}});}catch(e){next(e);}});
router.get("/meeting-resolutions",async(req,res,next)=>{try{const ids=await locations(req.user.organization);const agendas=await Agenda.find({location:{$in:ids}}).distinct("_id");res.json({resolutions:await MeetingResolution.find({agenda:{$in:agendas}}).sort({createdAt:-1}).populate("agenda","title meetingDate").lean()});}catch(e){next(e);}});
router.post("/meeting-resolutions",edit,async(req,res,next)=>{try{const {agendaId,title,decision,description}=req.body||{};if(!idOk(agendaId)||!String(title||"").trim()||!String(decision||"").trim())return res.status(400).json({error:"Agenda, resolution title and decision are required"});const ids=await locations(req.user.organization);const agenda=await Agenda.findOne({_id:agendaId,location:{$in:ids}});if(!agenda)return res.status(404).json({error:"Agenda not found"});const item=await MeetingResolution.create({agenda:agenda._id,organization:req.user.organization,title:String(title).slice(0,180),decision:String(decision).slice(0,4000),description:String(description||"").slice(0,2000),proposedBy:req.user._id});await audit(req,"resolution.created","meeting_resolution",item._id);res.status(201).json({resolution:item});}catch(e){next(e);}});
router.patch("/meeting-resolutions/:id",allowRoles("owner","manager"),async(req,res,next)=>{try{if(!idOk(req.params.id)||!["proposed","approved","rejected","deferred"].includes(req.body.status))return res.status(400).json({error:"Valid resolution ID and status are required"});const item=await MeetingResolution.findOne({_id:req.params.id,organization:req.user.organization});if(!item)return res.status(404).json({error:"Resolution not found"});item.status=req.body.status;if(item.status==="approved"){item.approvedBy=req.user._id;item.approvedAt=new Date();}await item.save();await audit(req,"resolution.status_changed","meeting_resolution",item._id,{status:item.status});res.json({resolution:item});}catch(e){next(e);}});
router.get("/attendance-report",allowRoles("owner","manager"),async(req,res,next)=>{try{const ids=await locations(req.user.organization);const from=req.query.from?new Date(req.query.from):new Date(Date.now()-30*86400000),to=req.query.to?new Date(req.query.to):new Date();if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||to<from)return res.status(400).json({error:"Invalid report date range"});const rows=await Attendance.aggregate([{$match:{location:{$in:ids},createdAt:{$gte:from,$lte:to}}},{$group:{_id:"$agenda",registered:{$sum:1},present:{$sum:{$cond:[{$eq:["$attendanceStatus","present"]},1,0]}},absent:{$sum:{$cond:[{$eq:["$attendanceStatus","absent"]},1,0]}}}},{$lookup:{from:"agendas",localField:"_id",foreignField:"_id",as:"agenda"}},{$unwind:{path:"$agenda",preserveNullAndEmptyArrays:true}},{$project:{meeting:"$agenda.title",meetingDate:"$agenda.meetingDate",registered:1,present:1,absent:1,attendanceRate:{$cond:[{$gt:["$registered",0]},{$multiply:[{$divide:["$present","$registered"]},100]},0]}}},{$sort:{meetingDate:-1}}]);res.json({from,to,meetings:rows,totals:rows.reduce((a,r)=>({registered:a.registered+r.registered,present:a.present+r.present,absent:a.absent+r.absent}),{registered:0,present:0,absent:0})});}catch(e){next(e);}});
router.get("/notifications",async(req,res,next)=>{try{const filter={organization:req.user.organization,$or:[{user:req.user._id},{user:null}]};res.json({notifications:await Notification.find(filter).sort({createdAt:-1}).limit(100).lean()});}catch(e){next(e);}});
router.post("/notifications",allowRoles("owner","manager"),async(req,res,next)=>{try{
 const title=String(req.body?.title||"").trim(),message=String(req.body?.message||"").trim(),userId=req.body?.userId||null;
 if(!title||!message)return res.status(400).json({error:"Title and message are required"});
 if(userId&&!idOk(userId))return res.status(400).json({error:"Invalid target user"});
 const notification=await Notification.create({organization:req.user.organization,user:userId,title:title.slice(0,160),message:message.slice(0,2000),type:String(req.body.type||"info").slice(0,30)});
 let push={configured:false,sent:0,failed:0};try{push=await sendOrganizationPush({organization:req.user.organization,user:userId,title:notification.title,body:notification.message,data:{notificationId:notification._id,type:notification.type}});}catch(error){console.error("Push delivery failed:",error.message);}
 notification.delivery=push.sent>0?"push":"in_app";await notification.save();
 await audit(req,"notification.created","notification",notification._id,{push});
 res.status(201).json({notification,delivery:notification.delivery,push});
 }catch(e){next(e);}});
router.patch("/notifications/:id/read",async(req,res,next)=>{try{if(!idOk(req.params.id))return res.status(400).json({error:"Invalid notification"});const n=await Notification.findOne({_id:req.params.id,organization:req.user.organization,$or:[{user:req.user._id},{user:null}]});if(!n)return res.status(404).json({error:"Notification not found"});n.readAt=new Date();await n.save();res.json({notification:n});}catch(e){next(e);}});
router.post("/offline-sync",edit,async(req,res,next)=>{try{
 const events=Array.isArray(req.body?.events)?req.body.events:[];if(!events.length||events.length>100)return res.status(400).json({error:"Submit between 1 and 100 queued events"});
 const results=[];
 for(const ev of events){
  const eventId=String(ev?.eventId||"").trim(),eventType=String(ev?.eventType||"").trim();
  if(!eventId||eventId.length>100||!eventType||eventType.length>80){results.push({eventId:eventId||null,status:"rejected",reason:"eventId and eventType are required"});continue;}
  let record;
  try{record=await OfflineEvent.create({organization:req.user.organization,user:req.user._id,eventId,eventType,payload:ev.payload||{},state:"queued"});}
  catch(err){if(err.code!==11000)throw err;record=await OfflineEvent.findOne({organization:req.user.organization,user:req.user._id,eventId});if(!record){results.push({eventId,status:"retry",reason:"Duplicate event is being processed"});continue;}if(record.state==="processed"){results.push({eventId,status:"duplicate",result:record.result});continue;}}
  const session=await mongoose.startSession();
  try{
   let replayResult;
   await session.withTransaction(async()=>{
    const locked=await OfflineEvent.findOneAndUpdate({_id:record._id,state:{$in:["queued","rejected"]},$or:[{leaseUntil:null},{leaseUntil:{$lt:new Date()}}]},{$set:{state:"processing",leaseUntil:new Date(Date.now()+60000)},$inc:{attempts:1}},{new:true,session});
    if(!locked)throw Object.assign(new Error("Event is already being processed"),{code:"EVENT_BUSY"});
    replayResult=await replayOfflineCommand({organization:req.user.organization,user:req.user._id,eventType,payload:ev.payload||{},session});
    locked.state="processed";locked.processedAt=new Date();locked.leaseUntil=null;locked.result={ok:true,...replayResult};await locked.save({session});
   });
   results.push({eventId,status:"processed",result:replayResult});
  }catch(err){
   if(err.code==="EVENT_BUSY"){results.push({eventId,status:"processing"});}
   else{await OfflineEvent.updateOne({_id:record._id,state:{$ne:"processed"}},{$set:{state:"rejected",leaseUntil:null,result:{ok:false,error:String(err.message||"Command failed").slice(0,300)}}});results.push({eventId,status:"rejected",reason:String(err.message||"Command failed").slice(0,300)});}
  }finally{await session.endSession();}
 }
 res.json({results,processed:results.filter(x=>x.status==="processed").length,duplicates:results.filter(x=>x.status==="duplicate").length,rejected:results.filter(x=>x.status==="rejected").length});
 }catch(e){next(e);}});
router.post("/queue",async(req,res,next)=>{try{const {locationId,service,customerName,phone}=req.body||{};if(!idOk(locationId))return res.status(400).json({error:"A valid location is required"});const loc=await Location.findOne({_id:locationId,organization:req.user.organization});if(!loc)return res.status(404).json({error:"Location not found"});const day=new Date();day.setHours(0,0,0,0);const count=await QueueTicket.countDocuments({location:loc._id,createdAt:{$gte:day}});const ticket=await QueueTicket.create({location:loc._id,ticketNumber:String(count+1).padStart(3,"0"),service:String(service||"General").slice(0,80),customerName:String(customerName||"").slice(0,120),phone:String(phone||"").slice(0,40)});res.status(201).json({ticket});}catch(e){next(e);}});

router.get("/advertising/campaigns",async(req,res,next)=>{try{const ids=await locations(req.user.organization);res.json({campaigns:await Campaign.find({location:{$in:ids}}).sort({createdAt:-1}).limit(100).lean()});}catch(e){next(e);}});
router.post("/advertising/campaigns",allowRoles("owner","manager"),async(req,res,next)=>{try{
 const {locationId,title,message,sponsorName,price,phone,targetUrl,startsAt,endsAt}=req.body||{};
 if(!idOk(locationId)||!String(title||"").trim()||!String(message||"").trim()||!String(sponsorName||"").trim())return res.status(400).json({error:"Location, title, message and sponsor name are required"});
 const amount=Math.round(Number(price)),normalized=normalizePhone(phone);
 if(!Number.isSafeInteger(amount)||amount<1||amount>1000000||!normalized)return res.status(400).json({error:"Provide a valid campaign price (KES) and Kenyan M-Pesa phone"});
 const loc=await Location.findOne({_id:locationId,organization:req.user.organization});if(!loc)return res.status(404).json({error:"Location not found"});
 if(targetUrl&&!/^https:\/\//i.test(targetUrl))return res.status(400).json({error:"Target URL must use HTTPS"});
 const campaign=await Campaign.create({location:loc._id,title:String(title).trim().slice(0,160),message:String(message).trim().slice(0,2000),sponsorName:String(sponsorName).trim().slice(0,160),price:amount,targetUrl:String(targetUrl||"").slice(0,500),startsAt:startsAt?new Date(startsAt):undefined,endsAt:endsAt?new Date(endsAt):undefined,published:false,paymentStatus:"pending"});
 try{const stk=await initiateStkPush({phone:normalized,amount,accountReference:"AD-"+String(campaign._id).slice(-8),transactionDesc:"BlueMenu sponsored campaign"});campaign.checkoutRequestId=stk.checkoutRequestId;campaign.checkoutPhone=normalized;await campaign.save();res.status(202).json({campaign,awaitingPin:true,message:stk.customerMessage});}
 catch(error){campaign.paymentStatus="failed";await campaign.save();throw error;}
 }catch(e){next(e);}});
router.patch("/advertising/campaigns/:id/review",allowRoles("owner","manager"),async(req,res,next)=>{try{
 if(!idOk(req.params.id)||!["approved","rejected"].includes(req.body?.reviewStatus))return res.status(400).json({error:"Valid campaign and review status required"});
 const ids=await locations(req.user.organization),campaign=await Campaign.findOne({_id:req.params.id,location:{$in:ids}});
 if(!campaign)return res.status(404).json({error:"Campaign not found"});
 campaign.reviewStatus=req.body.reviewStatus;campaign.published=campaign.reviewStatus==="approved"&&campaign.paymentStatus==="paid";
 await campaign.save();await audit(req,"campaign.reviewed","campaign",campaign._id,{reviewStatus:campaign.reviewStatus,published:campaign.published});
 res.json({campaign,message:campaign.published?"Paid campaign approved and published":"Campaign review saved"});
 }catch(e){next(e);}});
export default router;
