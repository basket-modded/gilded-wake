import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:100])
    s=s.replace(a,b)
one("Be.frustumCulled=!1,pe.add(Be);","Be.frustumCulled=!1,pe.add(Be);\n"+open('/home/claude/mp/vox.js').read()+"\n")
one("if(updatePeers(s,zn,i),WAKE.update(),","if(updatePeers(s,zn,i),VOX.run(),VOX.frame(),WAKE.update(),")
one("function buildPeerTemplate(){","function buildPeerTemplate(){VOX.run();VOX.swap(0);bpt0();const lo=Zn.parts;VOX.swap(1);bpt0();Zn.partsLo=lo}function bpt0(){")
one("for(const[e,t]of Zn.parts){const o=new THREE.Mesh(t,e);n.add(o)}n.add(new THREE.LineSegments(xe,Te.material));",
    "n.userData.hi=[],n.userData.lo=[];for(const[e,t]of Zn.parts){const o=new THREE.Mesh(t,e);n.add(o),n.userData.hi.push(o)}{const o=new THREE.Mesh(VOX.rig,_.rope);n.add(o),n.userData.hi.push(o)}for(const[e,t]of Zn.partsLo){const o=new THREE.Mesh(t,e);o.visible=!1,n.add(o),n.userData.lo.push(o)}{const o=new THREE.LineSegments(xe,Te.material);o.visible=!1,n.add(o),n.userData.lo.push(o)}")
one("for(const c of Kn.values()){const L=c.snaps;","for(const c of Kn.values()){const L=c.snaps;{const B=c.body.userData,nr=c.dist<160;if(B.hi&&B.nr!==nr){B.nr=nr;for(const q of B.hi)q.visible=nr;for(const q of B.lo)q.visible=!nr}}")
open(P,'w').write(s)
print('vox ok')
