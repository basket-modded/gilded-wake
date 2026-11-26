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
s=s.replace(';'+rk, ';'+rk+'\nconst DBG=/[?&]debug/.test(location.search)?(dt)=>{window.__rk={RKS,wt,get h(){return Mn},set h(q){Mn=q},get sp(){return Rn},set sp(q){Rn=q},get hp(){return yn},get mode(){return dn},cam:v,ren:f,renderer:f,get wake(){return WAKE}}}:null;\n',1)
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
one2(r"float foam=clamp(crest+wake*smoothstep(0.2,0.75,fA*0.6+fB*0.6),0.0,1.0)*(1.0-smoothstep(250.0,1000.0,dist));",
 r"float foam=clamp(crest+wake*smoothstep(0.2,0.75,fA*0.6+fB*0.6),0.0,1.0)*(1.0-smoothstep(250.0,1000.0,dist));\n    float near=1.0-smoothstep(60.0,220.0,dist);\n    float fD=texture2D(uFoam,wp*0.42+vec2(0.0,uTime*0.025)).r,fE=mix(0.5,texture2D(uFoam,wp*0.95-vec2(uTime*0.018,0.0)).r,near);\n    float lace=smoothstep(0.22,0.45,W.r*1.05+(fD-0.5)*0.5+(fE-0.5)*0.35+(fB-0.5)*0.2);\n    col=mix(col,vec3(0.05,0.2,0.21)*(0.3+0.6*uSunI)+refl*0.15,W.g*0.22);col*=1.0-W.b*0.12;\n    foam=max(foam,clamp(lace,0.0,1.0)*(1.0-smoothstep(300.0,900.0,dist)));")
WK=open('/home/claude/mp/wake.js').read()
one2("function updatePeers(e,o,a){",WK+"\nft.uWakeR.value=WAKE.RES;\nfunction updatePeers(e,o,a){")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('wake ok')
