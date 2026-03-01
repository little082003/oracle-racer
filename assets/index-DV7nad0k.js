(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))r(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const l of a.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function n(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(s){if(s.ep)return;s.ep=!0;const a=n(s);fetch(s.href,a)}})();const I="wss://dustboy-wss-bridge.laris.workers.dev/mqtt",d="oracle-racer/state/",f="oracle-racer/hall-of-fame",p=100,L=5e3;let o=null,t={id:k(),name:"",distance:0,startTime:null,endTime:null,finished:!1};const u={};let c=[];const M=document.getElementById("join-screen"),h=document.getElementById("race-screen"),O=document.getElementById("btn-join"),T=document.getElementById("player-name"),y=document.getElementById("mqtt-status-dot"),m=document.getElementById("mqtt-status-text"),$=document.getElementById("track-list"),C=document.getElementById("local-time"),g=document.getElementById("leaderboard-body");function k(){return Math.random().toString(16).substring(2,8)}function v(e){const i=new Date(e),n=i.getUTCMinutes().toString().padStart(2,"0"),r=i.getUTCSeconds().toString().padStart(2,"0"),s=i.getUTCMilliseconds().toString().padStart(3,"0");return`${n}:${r}.${s}`}O.addEventListener("click",b);T.addEventListener("keypress",e=>{e.key==="Enter"&&b()});function b(){const e=T.value.trim();if(!e)return alert("Please enter an Oracle Name!");t.name=e,document.getElementById("hud-name").textContent=e,M.classList.remove("active"),h.classList.remove("hidden"),h.classList.add("active"),B(),P(),requestAnimationFrame(w)}function B(){m.textContent="Connecting...",o=mqtt.connect(I),o.on("connect",()=>{y.className="dot on",m.textContent="Connected",o.subscribe(d+"#"),o.subscribe(f),E()}),o.on("offline",()=>{y.className="dot off",m.textContent="Disconnected"}),o.on("message",(e,i)=>{try{const n=JSON.parse(i.toString());if(e===f){Array.isArray(n)&&(c=n,S());return}if(e.startsWith(d)){const r=e.replace(d,"");if(r===t.id)return;u[r]={name:n.name,distance:n.distance,finished:n.finished,lastUpdate:Date.now()}}}catch(n){console.warn("MQTT Parse Error:",n)}})}function E(){if(!o||!o.connected)return;const e=JSON.stringify({name:t.name,distance:t.distance,finished:t.finished});o.publish(d+t.id,e,{qos:0})}function N(){const e=t.endTime-t.startTime;c.push({name:t.name,timeMs:e}),c.sort((i,n)=>i.timeMs-n.timeMs),c.length>10&&(c=c.slice(0,10)),o&&o.connected&&o.publish(f,JSON.stringify(c),{qos:1,retain:!0}),S()}function P(){window.addEventListener("keydown",e=>{e.code==="Space"&&(e.preventDefault(),q())})}function q(){t.finished||(t.startTime||(t.startTime=Date.now()),t.distance+=1,t.distance>=p&&(t.distance=p,t.finished=!0,t.endTime=Date.now(),N()),E())}function w(){let e=0;t.startTime&&!t.finished?e=Date.now()-t.startTime:t.finished&&(e=t.endTime-t.startTime),C.textContent=v(e),D(),requestAnimationFrame(w)}function D(){const e=Date.now();let i="";i+=`
    <div class="track-row local-player ${t.finished?"finished":""}">
      <div class="finish-line"></div>
      <div class="track-info">
        <span>${t.name} (You)</span>
        <span>${t.distance}%</span>
      </div>
      <div class="track-progress-bg">
        <div class="track-progress-fill" style="width: ${t.distance}%"></div>
      </div>
    </div>
  `;for(const[n,r]of Object.entries(u)){if(e-r.lastUpdate>L&&!r.finished){delete u[n];continue}i+=`
      <div class="track-row ${r.finished?"finished":""}">
        <div class="finish-line"></div>
        <div class="track-info">
          <span style="color: var(--text-secondary)">${r.name}</span>
          <span style="color: var(--text-secondary)">${r.distance}%</span>
        </div>
        <div class="track-progress-bg">
          <div class="track-progress-fill" style="width: ${r.distance}%"></div>
        </div>
      </div>
    `}$.innerHTML=i}function S(){if(c.length===0){g.innerHTML='<tr><td colspan="3" class="loading-td">No records yet. Be the first!</td></tr>';return}let e="";c.forEach((i,n)=>{const r=n<3?`rank-${n+1}`:"",s=n===0?"🥇":n===1?"🥈":n===2?"🥉":`${n+1}.`;e+=`
      <tr>
        <td class="${r}">${s}</td>
        <td>${i.name}</td>
        <td class="time-col">${v(i.timeMs)}</td>
      </tr>
    `}),g.innerHTML=e}
