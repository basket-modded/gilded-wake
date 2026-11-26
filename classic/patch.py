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
s=s.replace(';'+rk, ';'+rk+'\nconst DBG=/[?&]debug/.test(location.search)?(dt)=>{window.__rk={RKS,wt,get h(){return Mn},set h(q){Mn=q},get sp(){return Rn},set sp(q){Rn=q},get hp(){return yn},get mode(){return dn},cam:v,ren:f,renderer:f}}:null;\n',1)
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('ok',len(s))

# ---------------- wake follows the ship's actual path ----------------
s=open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html').read()
def one2(a,b):
    global s
    assert s.count(a)==1,a[:80]
    s=s.replace(a,b)
old=r"""      float tz=lw.y-11.0;\n      if(tz>0.0){float wdt=2.6+tz*0.075;wake+=smoothstep(wdt,wdt*0.15,abs(lw.x))*exp(-tz/120.0)*sp;}\n      float bz=lw.y+15.0;\n      if(bz>0.0){wake+=smoothstep(1.8,0.0,abs(abs(lw.x)-bz*0.36-1.2))*exp(-bz/95.0)*sp*0.8;}\n    }\n"""
new=r"""    }\n    for(int k=0;k<3;k++){\n      vec4 H0=uTrail[k*13];if(H0.w<0.0)continue;\n      vec2 d0=vWorld.xz-H0.xy;if(dot(d0,d0)>202500.0)continue;\n      float bd=1e9,bs=0.0,bi=0.0;\n      for(int i=0;i<12;i++){\n        vec4 A=uTrail[k*13+i],B=uTrail[k*13+i+1];if(B.w<0.0)break;\n        vec2 ab=B.xy-A.xy,ap=vWorld.xz-A.xy;float L=dot(ab,ab);\n        float t=L>1e-4?clamp(dot(ap,ab)/L,0.0,1.0):0.0;\n        float dd=length(ap-ab*t);\n        if(dd<bd){bd=dd;bs=mix(A.z,B.z,t);bi=mix(A.w,B.w,t);}\n      }\n      float tz=bs-26.0;\n      if(tz>0.0){float wdt=2.6+tz*0.075;wake+=smoothstep(wdt,wdt*0.15,bd)*exp(-tz/120.0)*bi;}\n      wake+=smoothstep(1.8,0.0,abs(bd-bs*0.36-1.2))*exp(-bs/95.0)*bi*0.8*smoothstep(0.0,8.0,bs);\n    }\n"""
one2(old,new)
one2("uniform vec4 uShips[8];uniform int uShipN;","uniform vec4 uShips[8];uniform vec4 uTrail[39];uniform int uShipN;")
one2("uShips:{value:Array.from({length:8},()=>new THREE.Vector4)},","uShips:{value:Array.from({length:8},()=>new THREE.Vector4)},uTrail:{value:Array.from({length:39},()=>new THREE.Vector4(0,0,0,-1))},")
one2("if(updatePeers(s,zn,i),","if(updatePeers(s,zn,i),updateTrails(),")
TR=r"""
/* ship wakes are laid down along the path actually sailed, so turning curves the wake instead of swinging it like a decal */
const TRL={me:[]};
function trailFill(list,o,n,x,z,h,spd,now){const fx=-Math.sin(h),fz=-Math.cos(h),bx=x+fx*15,bz=z+fz*15,sx=x-fx*11,sz=z-fz*11,U=ft.uTrail.value;
  if(list.length&&Math.hypot(list[0].x-sx,list[0].z-sz)>60)list.length=0;
  if(!list.length||Math.hypot(list[0].x-sx,list[0].z-sz)>7){list.unshift({x:sx,z:sz,i:spd,t:now});
    for(let i=1;i<list.length-1;i++){const a=list[i-1],c=list[i+1];if(Math.hypot(a.x-c.x,a.z-c.z)<8+i*5){list.splice(i,1);break}}}else list[0].i=Math.max(list[0].i,spd);
  U[o].set(bx-wt.x,bz-wt.y,0,spd);U[o+1].set(sx-wt.x,sz-wt.y,26,spd);let acc=26,px=sx,pz=sz,k=o+2;
  for(let i=1;i<list.length&&k<o+n;i++){const p=list[i];acc+=Math.hypot(p.x-px,p.z-pz);px=p.x;pz=p.z;
    const last=i===list.length-1||k===o+n-1||acc>300;U[k++].set(p.x-wt.x,p.z-wt.y,acc,last?0:p.i*Math.exp(-(now-p.t)/35));if(acc>300){list.length=i+1;break}}
  if(list.length>n+4)list.length=n+4;
  for(;k<o+n;k++)U[k].w=-1}
function updateTrails(){const now=performance.now()/1e3,U=ft.uTrail.value;
  trailFill(TRL.me,0,13,wt.x,wt.y,Mn,vn?0:Math.min(1,Math.max(0,Rn/6)),now);
  const near=[...Kn.values()].filter(c=>c.root.visible&&c.dist<1400).sort((a,b)=>a.dist-b.dist).slice(0,2);
  for(let j=0;j<2;j++){const o=13+j*13,c=near[j];if(!c){U[o].w=-1;continue}c.trail=c.trail||[];
    trailFill(c.trail,o,13,c.root.position.x+wt.x,c.root.position.z+wt.y,c.h,c.sk?0:Math.min(1,Math.max(0,(c.sp||0)/6)),now)}}
"""
one2("function updatePeers(e,o,a){",TR+"function updatePeers(e,o,a){")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('wake ok')
