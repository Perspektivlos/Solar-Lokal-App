import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { fmt } from "../smartshunt/format";

const TICK={fontSize:9,fontFamily:"JetBrains Mono",fill:"#64748b"};
const tip=({active,payload,label})=>active&&payload?.length?<div className="rounded border border-white/15 bg-[#080d17] p-2" data-testid="phase2-history-tooltip"><div className="font-mono text-[9px] text-white/40">{new Date(label).toLocaleTimeString("de-DE")}</div>{payload.map(x=><div key={x.dataKey} className="font-mono text-[10px] mt-1" style={{color:x.color}}>{x.name}: {fmt(x.value,x.dataKey.includes("power")?0:2)} {x.unit}</div>)}</div>:null;

const Panel=({id,title,children})=><section className="glass p-4" data-testid={`phase2-chart-${id}`}><div className="border-b border-white/[0.07] pb-3 text-xs font-semibold uppercase tracking-[0.14em]">{title}</div><div className="mt-4 h-[260px]">{children}</div></section>;

const BATTERY_FIELDS=["battery_dc_power_w","battery_voltage_v","battery_current_a","battery_soc_pct"];

export const preparePhase2ChartPoints=(points=[])=>{
  const rows=[];let lastPoll=null;let lastSource=null;let lastBattery={};
  points.forEach(point=>{
    const poll=new Date(point.ts).getTime();
    if(Number.isFinite(lastPoll)&&Number.isFinite(poll)&&poll-lastPoll>600000){
      rows.push({ts:new Date((lastPoll+poll)/2).toISOString(),status:"unavailable",battery_dc_power_w:null,inverter_ac_power_w:null,battery_voltage_v:null,battery_current_a:null,battery_soc_pct:null});
      lastSource=null;lastBattery={};
    }
    const row={...point};
    const source=point.battery_source_ts?new Date(point.battery_source_ts).getTime():null;
    const sameSource=Number.isFinite(source)&&source===lastSource&&point.status==="current";
    if(sameSource){
      BATTERY_FIELDS.forEach(field=>{if(row[field]==null&&lastBattery[field]!=null)row[field]=lastBattery[field];});
    }else if(point.status==="current"){
      if(Number.isFinite(source)&&Number.isFinite(lastSource)&&source-lastSource>600000){
        const sourceBarrier={...row,ts:new Date(Number.isFinite(poll)?poll-1:source-1).toISOString(),status:"unavailable"};
        BATTERY_FIELDS.forEach(field=>{sourceBarrier[field]=null;});
        rows.push(sourceBarrier);
      }
      lastSource=Number.isFinite(source)?source:null;
      lastBattery={};
      BATTERY_FIELDS.forEach(field=>{if(row[field]!=null)lastBattery[field]=row[field];});
    }else{
      lastSource=null;lastBattery={};
    }
    rows.push(row);lastPoll=poll;
  });
  return rows;
};

export const Phase2TrendCharts=({points})=>{
  const chartPoints=useMemo(()=>preparePhase2ChartPoints(points),[points]);
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
  <Panel id="dc-ac" title="SmartShunt DC × SUN-2000 AC"><ResponsiveContainer minWidth={0} initialDimension={{width:700,height:260}}><LineChart data={chartPoints} margin={{top:5,right:5,left:0,bottom:0}}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="ts" tickFormatter={v=>new Date(v).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} tick={TICK} minTickGap={28}/><YAxis tick={TICK} width={50} tickFormatter={v=>`${v}W`}/><Tooltip content={tip}/><ReferenceLine y={0} stroke="rgba(255,255,255,.2)"/><Line name="SmartShunt DC" unit="W" dataKey="battery_dc_power_w" stroke="#06B6D4" strokeWidth={2.2} dot={false} connectNulls={false} isAnimationActive={false}/><Line name="SUN Ausgang AC" unit="W" dataKey="inverter_ac_power_w" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></Panel>
  <Panel id="voltage-soc" title="Batteriespannung × SoC"><ResponsiveContainer minWidth={0} initialDimension={{width:700,height:260}}><LineChart data={chartPoints} margin={{top:5,right:5,left:0,bottom:0}}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="ts" tickFormatter={v=>new Date(v).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} tick={TICK} minTickGap={28}/><YAxis yAxisId="v" domain={["dataMin - .3","dataMax + .3"]} tick={TICK} width={48} tickFormatter={v=>`${Number(v).toFixed(1)}V`}/><YAxis yAxisId="soc" orientation="right" domain={[0,100]} tick={TICK} width={36} tickFormatter={v=>`${v}%`}/><Tooltip content={tip}/><Line yAxisId="v" name="Spannung" unit="V" dataKey="battery_voltage_v" stroke="#06B6D4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false}/><Line yAxisId="soc" name="SoC" unit="%" dataKey="battery_soc_pct" stroke="#A3E635" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></Panel>
</div>;};