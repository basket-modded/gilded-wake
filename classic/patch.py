import re,sys
s=open('/home/claude/mp/classic.html').read()
rk=open('/home/claude/mp/rocks.js').read()
i=s.index(',Et=[];for(const[Rr,Sr,Hr,kr,zr]of')
j=s.index('const xt=new THREE.Sprite',i)
s=s[:i]+';'+rk+'\n'+s[j:]
a=s.index('function updateIsles(e){')
b=s.index('const zo=new Map',a)
s=s[:a]+'function updateIsles(e){RKS.update();const p=RKS.beacon();if(!p||Math.hypot(p[0],p[2])>5200){xt.visible=!1;return}xt.visible=!0;xt.position.set(p[0],p[1],p[2]);const n=xt.position.length(),a=Math.pow(Math.max(0,Math.sin(1.1*e)),12);xt.scale.setScalar(.012*n*(.4+a)),xt.material.opacity=(.25+.75*a)*(1-.6*o(5,12,x))}'+s[b:]
def one(a,b):
    global s
    assert s.count(a)==1,a
    s=s.replace(a,b)
one('const i=updateShip(s);','const i=updateShip(s);RKS.collide(s);')
one('!r&&s.y<waveH(s.x,s.z,kn)&&(splash(s)','!r&&RKS.ball(s)&&(r=!0),!r&&s.y<waveH(s.x,s.z,kn)&&(splash(s)')
one('function applySpawn(e){wt.set(','function applySpawn(e){e=RKS.safe(e);wt.set(')
one('function placeTarget(e){const t=a(0,s),n=a(90,240);e.x=wt.x+Math.cos(t)*n,e.z=wt.y+Math.sin(t)*n,e.alive=!0',
    'function placeTarget(e){for(let k=0;k<12;k++){const t=a(0,s),n=a(90,240);if(e.x=wt.x+Math.cos(t)*n,e.z=wt.y+Math.sin(t)*n,!RKS.inRock(e.x,e.z,30))break}e.alive=!0')
# debug hook only with ?debug
one('const i=updateShip(s);RKS.collide(s);','const i=updateShip(s);RKS.collide(s);if(DBG)DBG(s);')
s=s.replace(';'+rk, ';'+rk+'\nconst DBG=/[?&]debug/.test(location.search)?(dt)=>{window.__rk={RKS,wt,get h(){return Mn},set h(q){Mn=q},get sp(){return Rn},set sp(q){Rn=q},get hp(){return yn},get mode(){return dn},cam:v,ren:f,renderer:f,get wake(){return WAKE},get orbit(){return fn},get ft(){return ft},get jo(){return jo},get gull(){return GULL}}}:null;\n',1)
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('ok',len(s))


# ---------------- wakes: a foam ribbon laid on the water along the path sailed ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
def one2(a,b):
    global s
    assert s.count(a)==1,a[:80]
    s=s.replace(a,b)
# the water shader keeps only the foam hugging each hull; the trailing wake is now a mesh
old=r"""      float tz=lw.y-11.0;\n      if(tz>0.0){float wdt=2.6+tz*0.075;wake+=smoothstep(wdt,wdt*0.15,abs(lw.x))*exp(-tz/120.0)*sp;}\n      float bz=lw.y+15.0;\n      if(bz>0.0){wake+=smoothstep(1.8,0.0,abs(abs(lw.x)-bz*0.36-1.2))*exp(-bz/95.0)*sp*0.8;}\n"""
one2(old,"")
one2("if(updatePeers(s,zn,i),","if(updatePeers(s,zn,i),WAKE.update(),")
one2("uShips:{value:Array.from({length:8},()=>new THREE.Vector4)},","uShips:{value:Array.from({length:8},()=>new THREE.Vector4)},uWake:{value:null},uWakeE:{value:420},uWakeR:{value:1024},uWakeC:{value:new THREE.Vector2},")
one2("uniform vec4 uShips[8];uniform int uShipN;","uniform vec4 uShips[8];uniform int uShipN;uniform sampler2D uWake;uniform float uWakeE,uWakeR;uniform vec2 uWakeC;")
one2(r"vec3 n=normalize(normalize(vN)+vec3(a.x+b.x*0.6,0.0,a.y+b.y*0.6)*0.3*df+vec3(c.x,0.0,c.y)*0.16);",
 r"vec2 wuv=vec2(vWorld.x-uWakeC.x,-(vWorld.z-uWakeC.y))/(2.0*uWakeE)+0.5;vec4 W=vec4(0.0);\n    float we=max(abs(wuv.x-0.5),abs(wuv.y-0.5));\n    if(we<0.495){float tx=1.0/uWakeR;W=texture2D(uWake,wuv);vec4 Wx=texture2D(uWake,wuv+vec2(tx,0.0)),Wz=texture2D(uWake,wuv+vec2(0.0,tx));\n      float ef=1.0-smoothstep(0.42,0.495,we);W*=ef;Wx*=ef;Wz*=ef;\n      vec2 gw=vec2(Wx.g-W.g,W.g-Wz.g)*uWakeR/(2.0*uWakeE);\n      a=mix(a,a*1.8+vec2(0.15),W.g*0.6);b*=1.0+W.g*1.4;a*=1.0-W.b*0.55;b*=1.0-W.b*0.7;\n      a-=gw*1.1;}\n    vec3 n=normalize(normalize(vN)+vec3(a.x+b.x*0.6,0.0,a.y+b.y*0.6)*0.3*max(df,W.g*0.8)+vec3(c.x,0.0,c.y)*0.16);")
one2(r"wake=clamp(wake,0.0,1.0);\n    float foam=clamp(crest",r"wake=clamp(max(wake,W.r*1.15),0.0,1.0);\n    float foam=clamp(crest")
one2(r"float foam=clamp(crest+wake*smoothstep(0.2,0.75,fA*0.6+fB*0.6),0.0,1.0)*(1.0-smoothstep(250.0,1000.0,dist));",
 r"float foam=clamp(crest+wake*smoothstep(0.2,0.75,fA*0.6+fB*0.6),0.0,1.0)*(1.0-smoothstep(250.0,1000.0,dist));\n    float near=1.0-smoothstep(60.0,220.0,dist);\n    float fD=texture2D(uFoam,wp*0.42+vec2(0.0,uTime*0.025)).r,fE=mix(0.5,texture2D(uFoam,wp*0.95-vec2(uTime*0.018,0.0)).r,near);\n    float lace=0.0;\n    col=mix(col,vec3(0.05,0.2,0.21)*(0.3+0.6*uSunI)+refl*0.15,W.g*0.22);col*=1.0-W.b*0.12;\n    foam=max(foam,clamp(lace,0.0,1.0)*(1.0-smoothstep(300.0,900.0,dist)));")
WK=open('/home/claude/mp/wake.js').read()
one2("function updatePeers(e,o,a){",WK+"\nft.uWakeR.value=WAKE.RES;\nfunction updatePeers(e,o,a){")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('wake ok')

# ---------------- cannon aim: tracer arc + landing zone painted into the sea ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
def one3(a,b):
    global s
    assert s.count(a)==1,a[:80]
    s=s.replace(a,b)
one3("uWake:{value:null},","uWake:{value:null},uAim:{value:new THREE.Vector4(0,0,0,0)},uAimAx:{value:new THREE.Vector2(0,-1)},uAimR:{value:new THREE.Vector2(12,5)},")
one3("uniform sampler2D uWake;","uniform vec4 uAim;uniform vec2 uAimAx,uAimR;uniform sampler2D uWake;")
RET=r"""    if(uAim.w>0.002){\n      vec2 r=vWorld.xz-uAim.xy;vec2 lc=vec2(dot(r,uAimAx),dot(r,vec2(-uAimAx.y,uAimAx.x)));\n      float e=length(lc/uAimR),lw=0.016+dist*0.00005;\n      float ang=atan(lc.y,lc.x)/6.28318+0.5;\n      float rdy=step(0.999,uAim.z);\n      float ring=1.0-smoothstep(lw*0.4,lw*1.4,abs(e-1.0));\n      float dash=smoothstep(0.25,0.4,fract(ang*36.0-uTime*0.15))*smoothstep(0.95,0.8,fract(ang*36.0-uTime*0.15));\n      float filled=step(ang,uAim.z);\n      float inner=(1.0-smoothstep(lw*0.3,lw*1.0,abs(e-0.5)))*0.35*step(0.5,fract(ang*12.0));\n      float pp=fract(uTime*0.55);float pulse=(1.0-smoothstep(0.0,lw*1.6,abs(e-pp)))*(1.0-pp)*0.6*rdy;\n      float fill=0.0;\n      float dot0=(1.0-smoothstep(0.02,0.045,e));\n      float A=ring*mix(0.25,1.0,dash*filled)+inner+pulse+fill+dot0*0.8;\n      vec3 ac=mix(vec3(0.62,0.64,0.7),vec3(1.0,0.72,0.36),mix(0.25,1.0,rdy));\n      col=mix(col,ac*(0.7+1.1*uSunI),clamp(A,0.0,1.0)*0.8*uAim.w);\n    }\n"""
one3(r"    vec3 hz=skyBase(normalize(vec3(-V.x,0.0,-V.z)));\n    float fog=1.0-exp(-dist*0.00045);",RET+r"    vec3 hz=skyBase(normalize(vec3(-V.x,0.0,-V.z)));\n    float fog=1.0-exp(-dist*0.00045);")
one3("if(_o.visible=jo.visible=e,!e)return;","if(_o.visible=jo.visible=!1,AIM.show(e),!e)return;")
one3("$o.color.set(o?16765578:11575440)}","$o.color.set(o?16765578:11575440),AIM.set(i,a,o,t)}")
AJ=open('/home/claude/mp/aim.js').read()
one3("function updateArc(){",AJ+"\nfunction updateArc(){")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('aim ok')

# ---------------- aim: smooth range changes ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
def one4(a,b):
    global s
    assert s.count(a)==1,a[:80]
    s=s.replace(a,b)
one4("function updateArc(){const e=\"captain\"===pn&&\"play\"===dn&&!vn&&!Gn;","function updateArc(){const e=\"captain\"===pn&&\"play\"===dn&&!vn&&!Gn;const _now=performance.now(),_dt=Math.min(.1,(_now-(updateArc.t||_now))/1e3);updateArc.t=_now;")
one4("const t=aimSide(),n=ro(),o=io(t)","const t=AIM.side(aimSide(),_dt),_tg=ro();updateArc.el=updateArc.el==null||!e?_tg:updateArc.el+(_tg-updateArc.el)*Math.min(1,_dt*10);const n=updateArc.el,o=io(t)")
one4("!(a.y<.2));i++);Yo.setDrawRange(0,i)","!(a.y<.2));i++);let _n=i;if(i<No-1){const _p=3*i,_py=Uo[_p+1],_k=(_py-.2)/Math.max(1e-4,_py-a.y);a.set(Uo[_p]+(a.x-Uo[_p])*_k,.2,Uo[_p+2]+(a.z-Uo[_p+2])*_k);Uo[_p+3]=a.x;Uo[_p+4]=a.y;Uo[_p+5]=a.z;_n=i+2}Yo.setDrawRange(0,i)")
one4("AIM.set(i,a,o,t)}","AIM.set(_n,a,o,t)}")
one4("e(\"#range\").textContent=`~${Math.round(Ko(ro()))} m`","e(\"#range\").textContent=`~${Math.round(Ko(updateArc.el??ro()))} m`")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('smooth ok')

# ---------------- old landing ring must never show (it defaulted to the ship's centre during the deploy intro) ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
assert s.count('jo.rotation.x=-Math.PI/2,y.add(jo);')==1
s=s.replace('jo.rotation.x=-Math.PI/2,y.add(jo);','jo.rotation.x=-Math.PI/2,y.add(jo),jo.visible=_o.visible=!1;')
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('ring ok')

# ---------------- seagulls: Dayvable's "Seagull" (CC-BY-4.0), GPU-skinned instances ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
def one5(a,b):
    global s
    assert s.count(a)==1,a[:80]
    s=s.replace(a,b)
GD=open('/home/claude/mp/gulldata.js').read();GJ=open('/home/claude/mp/gull.js').read()
one5("for(const Fr of[Rt,St,Ht])Fr.frustumCulled=!1,y.add(Fr);","for(const Fr of[Rt,St,Ht])Fr.frustumCulled=!1,y.add(Fr),Fr.visible=!1;\n"+GD+GJ+"\n")
one5("Rt.setMatrixAt(o,At);","Rt.setMatrixAt(o,At);GULL.inst(o,At,s,e);")
one5("Rt.instanceMatrix.needsUpdate=St.instanceMatrix.needsUpdate=Ht.instanceMatrix.needsUpdate=!0}","GULL.done()}")
one5('<div class="chips" style="margin-top:8px"><span>Best with headphones · A/D steer · W/S sails · click to fire</span></div>',
     '<div class="chips" style="margin-top:8px"><span>Best with headphones · A/D steer · W/S sails · click to fire</span></div>\n  <div class="chips" style="margin-top:6px;opacity:.55;font-size:11px"><span>Seagull model: “Seagull” by <a href="https://sketchfab.com/Dayvable" target="_blank" rel="noopener" style="color:inherit">Dayvable</a>, <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener" style="color:inherit">CC BY 4.0</a></span></div>')
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('gull ok')
