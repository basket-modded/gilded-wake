import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:90])
    s=s.replace(a,b)
AVJ=open('/home/claude/mp/avspr.js').read()+open('/home/claude/mp/avatar.js').read()
one("function updatePeers(e,o,a){",AVJ+"\nfunction updatePeers(e,o,a){")
one("function playerPose(e,t,n){","function playerPose(e,t,n){playerPose0(e,t,n),AV.tp(e,t)}function playerPose0(e,t,n){")
one('"captain"===pn?captainPose(Jo,Zo,s):playerPose(Jo,Zo,zn),"intro"===dn','("captain"===pn?captainPose(Jo,Zo,s):playerPose(Jo,Zo,zn),AV.update(s)),"intro"===dn')
one('tl:"title"===dn?1:0})','tl:"title"===dn?1:0,pm:"walk"===pn?1:0,ax:+hn.x.toFixed(2),ay:+hn.y.toFixed(2),az:+hn.z.toFixed(2),ya:+hn.yaw.toFixed(2)})')
one('a={t:performance.now(),x:t.x,z:t.z,h:t.h,sp:t.sp,sl:t.sl,hp:t.hp,sk:t.sk,tl:t.tl}','a={t:performance.now(),x:t.x,z:t.z,h:t.h,sp:t.sp,sl:t.sl,hp:t.hp,sk:t.sk,tl:t.tl,pm:t.pm,ax:t.ax,ay:t.ay,az:t.az,ya:t.ya}')
one('F walks the deck ·','F walks the deck · V third person on deck ·')
one('<div><kbd>F</kbd>walk the deck</div>','<div><kbd>F</kbd>walk the deck</div><div><kbd>V</kbd>third person (on deck)</div>')
one('const d=new Set(Ne.map(e=>e.gm));pe.traverse(e=>{if(e===pe)return;','const d=new Set(Ne.map(e=>e.gm));pe.traverse(e=>{if(e===pe||e.userData.noKit)return;')
open(P,'w').write(s)
print('avatar ok')
