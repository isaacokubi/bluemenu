import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Organization, Location } from "../src/models/index.js";
import { Subscription } from "../src/models/Subscription.js";

const email=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
const password=String(process.env.ADMIN_PASSWORD||"");
const name=String(process.env.ADMIN_NAME||"BlueMenu Super Administrator").trim();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Set a valid ADMIN_EMAIL.");
if(password.length<12)throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
if(!process.env.MONGODB_URI)throw new Error("MONGODB_URI is required.");
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
try{
 let user=await User.findOne({email}).select("+passwordHash");
 if(user&&user.role!=="super_admin")throw new Error("This email already belongs to a non-admin account. Refusing to elevate it automatically.");
 let organization=await Organization.findOne({slug:"bluemenu-platform"});
 if(!organization)organization=await Organization.create({name:"BlueMenu Platform",slug:"bluemenu-platform",type:"other",email,status:"active"});
 let location=await Location.findOne({organization:organization._id,publicSlug:"platform-hq"});
 if(!location)await Location.create({organization:organization._id,name:"Platform HQ",publicSlug:"platform-hq",timezone:"Africa/Nairobi"});
 if(!await Subscription.exists({organization:organization._id}))await Subscription.create({organization:organization._id,plan:"starter",status:"active"});
 const passwordHash=await bcrypt.hash(password,12);
 if(user){user.name=name;user.passwordHash=passwordHash;user.active=true;user.tokenVersion=(user.tokenVersion||0)+1;user.organization=organization._id;await user.save();}
 else user=await User.create({name,email,passwordHash,role:"super_admin",organization:organization._id,active:true});
 console.log("Super Administrator provisioned:",user.email);
 console.log("Sign in through the BlueMenu Business portal. Password is not printed.");
}finally{await mongoose.disconnect();}
