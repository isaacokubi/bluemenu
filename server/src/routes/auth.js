import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Organization,Location,User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
const router=Router();
const slugify=value=>String(value||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const tokenFor=user=>jwt.sign({sub:user._id.toString(),role:user.role,organization:user.organization.toString()},process.env.JWT_SECRET,{expiresIn:"7d"});
router.post("/register",async(req,res,next)=>{try{
  const {name,email,password,organizationName,organizationType,locationName,address}=req.body||{};
  if(!name||!email||!password||!organizationName||!organizationType||!locationName)return res.status(400).json({error:"Name, email, password, organization name, organization type and first location are required"});
  if(String(password).length<10)return res.status(400).json({error:"Password must contain at least 10 characters"});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address"});
  if(await User.exists({email:String(email).toLowerCase().trim()}))return res.status(409).json({error:"An account with this email already exists"});
  if(!process.env.JWT_SECRET)return res.status(503).json({error:"Authentication is not configured"});
  const slug=slugify(organizationName)+"-"+Math.random().toString(36).slice(2,7);
  const organization=await Organization.create({name:organizationName,slug,type:organizationType,email:String(email).toLowerCase().trim()});
  try{
    const location=await Location.create({organization:organization._id,name:locationName,address,publicSlug:slugify(locationName)+"-"+Math.random().toString(36).slice(2,7)});
    const user=await User.create({name,email:String(email).toLowerCase().trim(),passwordHash:await bcrypt.hash(password,12),role:"owner",organization:organization._id});
    res.status(201).json({token:tokenFor(user),user:{id:user._id,name:user.name,email:user.email,role:user.role},organization:{id:organization._id,name:organization.name,type:organization.type},location:{id:location._id,name:location.name,publicSlug:location.publicSlug}});
  }catch(error){await Location.deleteMany({organization:organization._id});await Organization.findByIdAndDelete(organization._id);throw error;}
}catch(error){next(error);}});
router.post("/login",async(req,res,next)=>{try{
  const email=String(req.body?.email||"").toLowerCase().trim(),password=String(req.body?.password||"");
  if(!email||!password)return res.status(400).json({error:"Email and password are required"});
  if(!process.env.JWT_SECRET)return res.status(503).json({error:"Authentication is not configured"});
  const user=await User.findOne({email}).select("+passwordHash");
  if(!user||!user.active||!(await bcrypt.compare(password,user.passwordHash)))return res.status(401).json({error:"Email or password is incorrect"});
  user.lastLoginAt=new Date();await user.save();
  res.json({token:tokenFor(user),user:{id:user._id,name:user.name,email:user.email,role:user.role,organization:user.organization}});
}catch(error){next(error);}});
router.get("/me",requireAuth,(req,res)=>res.json({user:{id:req.user._id,name:req.user.name,email:req.user.email,role:req.user.role,organization:req.user.organization}}));
export default router;
