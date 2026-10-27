// Additive JSON migration: old completion dates stay unknown, never inferred.
export function completionFields(goal) {
 const completedAt=goal.completedAt??null, completionDate=goal.completionDate??null;
 const complete=goal.status==='completed'||(goal.status==='archived'&&goal.previousStatus==='completed');
 if(completedAt!==null){
  if(typeof completedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(completedAt)||!Number.isFinite(Date.parse(completedAt))||new Date(completedAt).toISOString()!==completedAt||Date.parse(completedAt)<Date.parse(goal.createdAt)||Date.parse(completedAt)>Date.now()+300000)throw new Error('Invalid completion timestamp.');
 }
 if(completionDate!==null){
  if(typeof completionDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)||!Number.isFinite(Date.parse(completionDate))||new Date(completionDate).toISOString().slice(0,10)!==completionDate||completionDate>new Date(Date.now()+86400000).toISOString().slice(0,10))throw new Error('Invalid completion date.');
 }
 if((completedAt||completionDate)&&!complete)throw new Error('Only completed goals may have a completion date.');
 if(completedAt&&completionDate)throw new Error('Choose a timestamp or a manual completion date, not both.');
 return {completedAt,completionDate};
}
export function setCompleted(goal,completed,now=new Date()){
 goal.status=completed?'completed':'active';goal.completedAt=completed?now.toISOString():null;goal.completionDate=null;
 return goal;
}
