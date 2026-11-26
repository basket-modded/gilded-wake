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
WK=open('/home/claude/mp/wake.js').read()
one2("function updatePeers(e,o,a){",WK+"\nfunction updatePeers(e,o,a){")
open(sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html','w').write(s)
print('wake ok')
