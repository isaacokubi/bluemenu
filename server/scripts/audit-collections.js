import "dotenv/config";
import mongoose from "mongoose";

const uri=process.env.MONGODB_URI;
if(!uri){console.error("MONGODB_URI is required. Copy server/.env.example and configure the database.");process.exit(1);}
try{
  await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,autoIndex:false,autoCreate:false});
  const database=mongoose.connection.db;
  const collections=await database.listCollections({}, {nameOnly:true}).toArray();
  const rows=[];
  for(const item of collections){
    try{rows.push({name:item.name,estimatedDocuments:await database.collection(item.name).estimatedDocumentCount()});}
    catch(error){rows.push({name:item.name,estimatedDocuments:null,error:error.message});}
  }
  rows.sort((a,b)=>(a.estimatedDocuments??-1)-(b.estimatedDocuments??-1));
  console.log(JSON.stringify({database:database.databaseName,totalCollections:rows.length,configuredLimit:500,emptyCollections:rows.filter(x=>x.estimatedDocuments===0).length,collections:rows},null,2));
  console.log("\nREAD-ONLY AUDIT ONLY. No collections or documents were changed or deleted.");
}catch(error){console.error("Collection audit failed:",error.message);process.exitCode=1;}
finally{await mongoose.disconnect().catch(()=>{});}
