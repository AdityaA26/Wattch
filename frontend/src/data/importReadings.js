const units={electricity:'kWh',water:'gal',gas:'therms'};
export function parseReadingsCSV(text,utility){
 if(!units[utility])throw Error('Choose a metered utility.');
 if(text.length>1000000)throw Error('CSV must be smaller than 1 MB.');
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(l=>l.trim());
 if(lines.shift()?.replace(/\s/g,'')!=='date,quantity,unitRateUsd')throw Error('Use the header date,quantity,unitRateUsd.');
 if(!lines.length||lines.length>1500)throw Error('Supply 1–1500 daily rows.');
 const seen=new Set();
 return lines.map((line,i)=>{
  const values=line.split(',').map(v=>v.trim());
  if(values.length!==3)throw Error('Row '+(i+2)+' must have date, quantity and rate.');
  const [date,q,rate]=values;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Row '+(i+2)+' has an invalid date.');
  if(seen.has(date))throw Error('Duplicate date: '+date);seen.add(date);
  const quantity=Number(q),unitRateUsd=rate===''?null:Number(rate);
  if(q===''||!Number.isFinite(quantity)||quantity<0||quantity>1000000||unitRateUsd!==null&&(!Number.isFinite(unitRateUsd)||unitRateUsd<0||unitRateUsd>10000))throw Error('Row '+(i+2)+' needs nonnegative consumption and an optional numeric rate.');
  return {date,utility,unit:units[utility],quantity,unitRateUsd,source:'observed'};
 });
}
