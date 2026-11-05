import crypto from "node:crypto";
import mongoose from "mongoose";
import { Location,Agenda,Attendance,Visitor,Appointment,QueueTicket,InventoryItem,StockMovement } from "../models/index.js";

const validId=value=>mongoose.isValidObjectId(value);
const shortRef=prefix=>prefix+"-"+crypto.randomBytes(5).toString("hex").toUpperCase();

export async function replayOfflineCommand({ organization,user,eventType,payload,session }) {
  const data=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload:{};
  if(!validId(data.locationId))throw new Error("A valid locationId is required for this queued command");
  const location=await Location.findOne({_id:data.locationId,organization}).session(session);
  if(!location)throw new Error("Location is outside the authenticated workspace");
  if(eventType==="queue.create"){
    const ticket=await QueueTicket.create([{location:location._id,ticketNumber:shortRef("OFF"),service:String(data.service||"General").slice(0,80),customerName:String(data.customerName||"").slice(0,120),phone:String(data.phone||"").slice(0,40)}],{session});
    return {entity:"queue_ticket",id:String(ticket[0]._id),ticketNumber:ticket[0].ticketNumber};
  }
  if(eventType==="visitor.checkin"){
    const visitorName=String(data.visitorName||"").trim(),purpose=String(data.purpose||"").trim();
    if(!visitorName||!purpose)throw new Error("visitorName and purpose are required");
    const visitor=await Visitor.create([{location:location._id,visitorName:visitorName.slice(0,120),phone:String(data.phone||"").slice(0,40),organization:String(data.visitorOrganization||"").slice(0,120),hostName:String(data.hostName||"").slice(0,120),purpose:purpose.slice(0,500),passCode:shortRef("VIS")}],{session});
    return {entity:"visitor",id:String(visitor[0]._id),passCode:visitor[0].passCode};
  }
  if(eventType==="appointment.create"){
    const customerName=String(data.customerName||"").trim(),customerPhone=String(data.customerPhone||"").trim(),appointmentAt=new Date(data.appointmentAt);
    if(!customerName||!customerPhone||Number.isNaN(appointmentAt.getTime()))throw new Error("customerName, customerPhone and a valid appointmentAt are required");
    const appointment=await Appointment.create([{location:location._id,reference:shortRef("APT"),customerName:customerName.slice(0,120),customerPhone:customerPhone.slice(0,40),customerEmail:String(data.customerEmail||"").slice(0,160),service:String(data.service||"").slice(0,120),appointmentAt,notes:String(data.notes||"").slice(0,1000)}],{session});
    return {entity:"appointment",id:String(appointment[0]._id),reference:appointment[0].reference};
  }
  if(eventType==="attendance.checkin"){
    if(!validId(data.agendaId))throw new Error("A valid agendaId is required");
    const agenda=await Agenda.findOne({_id:data.agendaId,location:location._id}).session(session);
    if(!agenda)throw new Error("Meeting agenda was not found in this location");
    const attendeeName=String(data.attendeeName||"").trim();
    if(!attendeeName)throw new Error("attendeeName is required");
    const identity=String(data.attendeeEmail||data.attendeePhone||"").trim();
    let attendance=identity?await Attendance.findOne({agenda:agenda._id,$or:[{attendeeEmail:identity},{attendeePhone:identity}]}).session(session):null;
    if(attendance){attendance.attendanceStatus="present";attendance.checkedInAt=new Date();await attendance.save({session});}
    else{const rows=await Attendance.create([{location:location._id,agenda:agenda._id,attendeeName:attendeeName.slice(0,120),attendeeEmail:String(data.attendeeEmail||"").slice(0,160),attendeePhone:String(data.attendeePhone||"").slice(0,40),attendanceStatus:"present",checkedInAt:new Date(),checkinCode:shortRef("CHK")}],{session});attendance=rows[0];}
    return {entity:"attendance",id:String(attendance._id),status:"present"};
  }
  if(eventType==="inventory.receive"){
    if(!validId(data.inventoryItemId))throw new Error("A valid inventoryItemId is required");
    const quantity=Number(data.quantity);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new Error("quantity must be a positive whole number");
    const item=await InventoryItem.findOne({_id:data.inventoryItemId,location:location._id,active:true}).session(session);
    if(!item)throw new Error("Inventory item was not found in this location");
    const updated=await InventoryItem.findOneAndUpdate({_id:item._id,location:location._id},{$inc:{quantity}},{new:true,session});
    await StockMovement.create([{inventoryItem:item._id,location:location._id,organization,actor:user,type:"receive",quantity,before:updated.quantity-quantity,after:updated.quantity,reason:String(data.reason||"Offline sync").slice(0,300)}],{session});
    return {entity:"inventory_item",id:String(item._id),quantity:updated.quantity};
  }
  if(eventType==="inventory.issue"){
    if(!validId(data.inventoryItemId))throw new Error("A valid inventoryItemId is required");
    const quantity=Number(data.quantity);
    if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)throw new Error("quantity must be a positive whole number");
    const item=await InventoryItem.findOne({_id:data.inventoryItemId,location:location._id,active:true}).session(session);
    if(!item)throw new Error("Inventory item was not found in this location");
    const updated=await InventoryItem.findOneAndUpdate({_id:item._id,location:location._id,quantity:{$gte:quantity}},{$inc:{quantity:-quantity}},{new:true,session});
    if(!updated)throw new Error("Insufficient stock for this offline issue");
    await StockMovement.create([{inventoryItem:item._id,location:location._id,organization,actor:user,type:"issue",quantity,before:updated.quantity+quantity,after:updated.quantity,reason:String(data.reason||"Offline sync").slice(0,300)}],{session});
    return {entity:"inventory_item",id:String(item._id),quantity:updated.quantity};
  }
  throw new Error("Unsupported offline command. Allowed: queue.create, visitor.checkin, appointment.create, attendance.checkin, inventory.receive, inventory.issue");
}
