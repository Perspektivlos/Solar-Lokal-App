import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getSmartShuntPhase2Live, getSmartShuntPreview } from "../lib/api";
import { Phase2Header } from "../components/phase2/Phase2Header";
import { Phase2Dashboard } from "../components/phase2/Phase2Dashboard";
import { Phase2Energy } from "../components/phase2/Phase2Energy";
import { Phase2Devices } from "../components/phase2/Phase2Devices";
import { Phase2Diagnose } from "../components/phase2/Phase2Diagnose";
import { Phase2History } from "../components/phase2/Phase2History";

export default function SmartShuntPhase2(){
  const [live,setLive]=useState(null);const [phase1,setPhase1]=useState(null);const [error,setError]=useState("");const [refreshing,setRefreshing]=useState(false);
  const load=useCallback(async()=>{setRefreshing(true);const [next,probe]=await Promise.allSettled([getSmartShuntPhase2Live(),getSmartShuntPreview()]);if(next.status==="fulfilled"){setLive(next.value);setError("");if(probe.status==="fulfilled")setPhase1(probe.value);else setPhase1({current:next.value.smartshunt,topic_base:"N/<Portal-ID>/battery/290/",diagnostics:{checks:[],raw_field_count:Object.keys(next.value.smartshunt?.raw||{}).length,message_count:0},events:[]});}else setError("Phase-2-Vorschau konnte nicht geladen werden.");setRefreshing(false);},[]);
  useEffect(()=>{load();const id=setInterval(load,5000);return()=>clearInterval(id);},[load]);
  return <div className="min-h-screen text-white page-reveal" data-testid="phase2-preview-page"><Phase2Header live={live} refreshing={refreshing} onRefresh={load}/><main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-6">{error&&<div role="alert" className="glass border-l-[3px] border-l-red-400 p-3 text-red-200 mb-5" data-testid="phase2-error">{error}</div>}{!live||!phase1?<div className="glass min-h-[320px] grid place-items-center font-mono text-sm text-white/45" data-testid="phase2-loading">Phase-2-Quellen werden geladen…</div>:<Routes><Route index element={<Phase2Dashboard live={live}/>}/><Route path="energiefluss" element={<Phase2Energy live={live}/>}/><Route path="geraete" element={<Phase2Devices live={live}/>}/><Route path="diagnose" element={<Phase2Diagnose live={live} phase1={phase1}/>}/><Route path="verlauf" element={<Phase2History/>}/><Route path="*" element={<Navigate to="/smartshunt-phase2" replace/>}/></Routes>}</main></div>;
}