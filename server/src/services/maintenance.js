import {DeviceToken} from "../models/index.js";

export async function ensureDeviceTokenIndexes(){
 const collection=DeviceToken.collection;
 const database=collection.conn.db;
 if(!database)return {skipped:true,reason:"database_not_ready"};
 const exists=await database.listCollections({name:collection.collectionName},{nameOnly:true}).hasNext();
 if(!exists)return {skipped:true,reason:"collection_not_yet_provisioned"};
 let indexes=await collection.indexes();
 const legacy=indexes.find(index=>index.name==="token_1"&&index.unique);
 if(legacy)await collection.dropIndex("token_1");
 indexes=await collection.indexes();
 if(!indexes.some(index=>index.name==="token_org_location_unique")){
  await collection.createIndex({token:1,organization:1,location:1},{unique:true,name:"token_org_location_unique"});
 }
 return {skipped:false,collection:collection.collectionName};
}
