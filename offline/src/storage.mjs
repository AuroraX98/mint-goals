export const OFFLINE_KEY='mint-goals.offline.v1';
export function readLocal(storage){
 const raw=storage.getItem(OFFLINE_KEY);if(raw===null)return {state:null,version:0};
 let data;try{data=JSON.parse(raw);}catch{throw new Error('Saved browser data could not be read. It has not been overwritten. Keep this browser profile and restore a backup in a separate browser if needed.');}
 if(!data||!Number.isSafeInteger(data.version)||data.version<1||!data.state)throw new Error('Saved browser data is invalid. It has not been overwritten.');
 return data;
}
export function writeLocal(storage,state,version){
 const current=readLocal(storage);
 if(current.version!==version || (current.state && current.state.version > state.version))return {conflict:true,...current};
 if(version>=Number.MAX_SAFE_INTEGER)throw new Error('The save counter is full. Export a backup.');
 const next={state,version:version+1};storage.setItem(OFFLINE_KEY,JSON.stringify(next));return next;
}
