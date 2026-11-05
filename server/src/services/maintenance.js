import {DeviceToken} from "../models/index.js";
export async function ensureDeviceTokenIndexes(){
 const collection=DeviceToken.collection;
 let indexes=[];try{indexes=await collection.indexes();}catch(error){if(error.code!==26&&error.codeName!=="NamespaceNotFound")throw error;}
 const legacy=indexes.find(index=>index.name==="token_1"&&index.unique);
 if(legacy)await collection.dropIndex("token_1");
 await collection.createIndex({token:1,organization:1,location:1},{unique:true,name:"token_org_location_unique"});
}
