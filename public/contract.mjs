const schemas = {
  shelf_status: { state: v => ['full','low','empty'].includes(v), occupancy: v => Number.isFinite(v) && v >= 0 && v <= 100 },
  stockout_duration: { seconds: v => Number.isInteger(v) && v >= 0 && v <= 86400 },
  shelf_interaction: { count: v => Number.isInteger(v) && v >= 1 && v <= 1000 },
  congestion: { count: v => Number.isInteger(v) && v >= 0 && v <= 1000 }
};
export function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return {ok:false, reason:'INVALID_OBJECT'};
  if (typeof event.type !== 'string' || !Object.hasOwn(schemas, event.type)) return {ok:false, reason:'UNKNOWN_EVENT'};
  const fields = schemas[event.type];
  const allowed = ['type','shelf_id','timestamp',...Object.keys(fields)];
  if (Object.keys(event).some(k => !allowed.includes(k))) return {ok:false, reason:'FORBIDDEN_FIELD'};
  if (allowed.some(k => !Object.hasOwn(event,k))) return {ok:false, reason:'MISSING_FIELD'};
  if (event.shelf_id !== 'shelf-01' || typeof event.timestamp !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(event.timestamp) || !Number.isFinite(Date.parse(event.timestamp))) return {ok:false, reason:'INVALID_METADATA'};
  if (Object.entries(fields).some(([k,test]) => !test(event[k]))) return {ok:false, reason:'INVALID_VALUE'};
  return {ok:true};
}
