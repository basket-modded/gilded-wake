import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:90])
    s=s.replace(a,b)

# ---- A. materials, textures, window glass ----
A=r'''
/* richer deck materials */
function clothTex(kind){const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");
  if(kind==="rug"){x.fillStyle="#5a1513";x.fillRect(0,0,256,256);
    const band=(m,w,col)=>{x.strokeStyle=col;x.lineWidth=w;x.strokeRect(m,m,256-2*m,256-2*m)};
    band(9,14,"#24182e");band(22,5,"#b88a3e");band(31,4,"#24182e");band(44,2,"#b88a3e");
    x.save();x.translate(128,128);x.rotate(Math.PI/4);for(const[w,col]of[[92,"#b88a3e"],[76,"#5a1513"],[50,"#24182e"],[26,"#b88a3e"],[12,"#5a1513"]]){x.fillStyle=col;x.fillRect(-w/2,-w/2,w,w)}x.restore();
    for(const[cx,cy]of[[64,64],[192,64],[64,192],[192,192]]){x.save();x.translate(cx,cy);x.rotate(Math.PI/4);x.fillStyle="#24182e";x.fillRect(-10,-10,20,20);x.fillStyle="#b88a3e";x.fillRect(-4,-4,8,8);x.restore()}
    for(let i=0;i<7000;i++){const v=Math.random();x.fillStyle=v<.5?"rgba(0,0,0,0.07)":"rgba(255,220,170,0.05)";x.fillRect(Math.random()*256,Math.random()*256,2,1)}}
  else{x.fillStyle="#6a1a19";x.fillRect(0,0,256,256);
    for(let i=0;i<256;i+=64){x.fillStyle="rgba(15,8,8,0.35)";x.fillRect(i,0,14,256);x.fillRect(0,i,256,14)}
    x.fillStyle="#d6c7a2";x.fillRect(0,26,256,7);x.fillRect(0,222,256,7);
    for(let i=0;i<9000;i++){x.fillStyle=`rgba(255,240,220,${Math.random()*0.06})`;x.fillRect(Math.random()*256,Math.random()*256,1,2)}}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
_.bronze=new THREE.MeshStandardMaterial({color:8017200,roughness:.44,metalness:.82,envMapIntensity:.55});
_.felt=new THREE.MeshStandardMaterial({color:1316372,roughness:.95});
_.linen=new THREE.MeshStandardMaterial({color:14077362,roughness:.95});
_.wool=new THREE.MeshStandardMaterial({map:clothTex("wool"),roughness:.97});
_.rug=new THREE.MeshStandardMaterial({map:clothTex("rug"),roughness:1});
_.coat=new THREE.MeshStandardMaterial({color:1844278,roughness:.9});
'''
one("_.sail.shadowSide=THREE.DoubleSide;","_.sail.shadowSide=THREE.DoubleSide;"+A)

# ---- B. lanterns: real lantern, glass panes, candle, chains and brackets ----
one('Ue=(()=>{const e=[];e.push(xf(box(.24,.04,.24),0,-.16,0)),e.push(xf(new THREE.ConeGeometry(.19,.16,4),0,.21,0,0,Math.PI/4,0));for(const[t,n]of[[-.1,-.1],[.1,-.1],[-.1,.1],[.1,.1]])e.push(xf(box(.02,.34,.02),t,.02,n));return e.push(xf(new THREE.TorusGeometry(.05,.012,4,10),0,.33,0)),e.push(xf(box(.24,.03,.24),0,.14,0)),merge(e)})()',
 'Ue=(()=>{const e=[];e.push(xf(cyl(.1,.14,.04,4),0,-.165,0,0,Math.PI/4,0)),e.push(xf(box(.255,.022,.255),0,-.137,0)),e.push(xf(box(.255,.022,.255),0,.124,0));for(const[t,n]of[[-.118,-.118],[.118,-.118],[-.118,.118],[.118,.118]])e.push(xf(cyl(.012,.012,.265,5),t,-.006,n));for(const t of[-.119,.119])e.push(xf(box(.009,.25,.009),t,-.006,0),xf(box(.009,.25,.009),0,-.006,t),xf(box(.009,.009,.235),t,-.006,0),xf(box(.235,.009,.009),0,-.006,t));return e.push(xf(new THREE.ConeGeometry(.2,.12,4),0,.195,0,0,Math.PI/4,0),xf(cyl(.03,.042,.06,8),0,.27,0),xf(new THREE.ConeGeometry(.06,.05,8),0,.32,0),xf(new THREE.TorusGeometry(.045,.01,5,12),0,.385,0)),merge(e)})()')
one('Ye=new THREE.BoxGeometry(.17,.27,.17)','Ye=merge([xf(box(.22,.245,.005),0,-.006,.116),xf(box(.22,.245,.005),0,-.006,-.116),xf(box(.005,.245,.22),.116,-.006,0),xf(box(.005,.245,.22),-.116,-.006,0)])')
one('const Vs=_.glass.clone(),Is=new THREE.Mesh(Ye,Vs);','const Vs=_.glass.clone();Vs.transparent=!0,Vs.opacity=.82,Vs.depthWrite=!1,Vs.side=THREE.DoubleSide;const Is=new THREE.Mesh(Ye,Vs);')
one('if(Ls.scale.setScalar(1.1),Gs.add(Ls),!As.scale){const Ds=new THREE.Mesh(cyl(.008,.008,.17,4),_.iron);Ds.position.y=.42,Gs.add(Ds)}',
 'Ls.scale.setScalar(1.1),Gs.add(Ls);{const Lf=new THREE.Sprite(Ls.material);Lf.scale.set(.07,.12,1),Lf.position.y=-.005,Gs.add(Lf);const Cn=new THREE.Mesh(cyl(.022,.026,.1,8),_.candle);Cn.position.y=-.075,Gs.add(Cn)}')
one('Gs.position.y=-.5*(As.scale||1)','Gs.position.y=-.66*(As.scale||1)')
one('As.name.startsWith("door")&&put2(xfMesh(box(.05,.05,.3),_.iron,As.x,As.y,As.z+.03)),"stern"===As.name&&(put2(xfMesh(cyl(.05,.06,1.6,6),_.dark,0,re+.8,13.6)),put2(xfMesh(box(.05,.05,.4),_.iron,0,re+1.6,13.6)),Ps.position.y=re+2.15,Gs.position.y=-.35),"cabin"===As.name&&(Gs.position.y=-.24),"mast"===As.name&&put2(xfMesh(box(.05,.05,.5),_.iron,0,As.y,-.78)),"fore"===As.name&&put2(xfMesh(box(.05,.05,.5),_.iron,0,As.y,-8.3));',
 'LBR(As,Ps,Gs);')
LBR=r'''
/* lantern hardware: every lantern hangs from something real */
function rodG(ax,ay,az,bx,by,bz,r,seg=6){const d=new THREE.Vector3(bx-ax,by-ay,bz-az),L=d.length()||1e-3,gq=cyl(r,r,L,seg);
  gq.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((ax+bx)/2,(ay+by)/2,(az+bz)/2),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()),new THREE.Vector3(1,1,1)));return gq}
function chainG(y0,y1){const e=[],n=Math.max(2,Math.round((y1-y0)/.05)),st=(y1-y0)/n;
  for(let i=0;i<n;i++){const t=new THREE.TorusGeometry(.017,.0045,4,8);t.scale(1,1.45,1);e.push(xf(t,0,y0+st*(i+.5),0,0,i%2?Math.PI/2:0,0))}return merge(e)}
function LBR(A,P,G){const nm=A.name,ir=[],y=A.y;
  const arm=(ax,az)=>{const px=A.x,pz=A.z,dx=px-ax,dz=pz-az,L=Math.hypot(dx,dz)||1,ang=Math.atan2(dx,dz),ux=dx/L,uz=dz/L;
    ir.push(rodG(ax,y+.07,az,px+ux*.03,y+.07,pz+uz*.03,.016));
    ir.push(rodG(ax,y-.22,az,ax+ux*L*.6,y+.07,az+uz*L*.6,.012));
    ir.push(rodG(px,y+.07,pz,px,y+.012,pz,.008));
    ir.push(xf(new THREE.TorusGeometry(.04,.009,4,12,Math.PI*1.4),px+ux*.03,y+.115,pz+uz*.03,0,ang+Math.PI/2,0));
    ir.push(xf(box(.1,.36,.024),ax,y-.07,az,0,ang,0));
    ir.push(xf(new THREE.TorusGeometry(.016,.005,4,8),px,y+.005,pz,0,ang,0))};
  if(nm==="mast"||nm==="fore"){const mz=nm==="mast"?-.5:-8,mr=.335;arm(0,mz-mr+.012);
    ir.push(xf(new THREE.TorusGeometry(mr+.012,.022,5,22),0,y+.07,mz,Math.PI/2,0,0),xf(new THREE.TorusGeometry(mr+.016,.022,5,22),0,y-.22,mz,Math.PI/2,0,0))}
  else if(nm.startsWith("door"))arm(A.x,ie-.03);
  else if(nm==="cabin"){G.position.y=-.5;ir.push(rodG(A.x,re-.03,A.z,A.x,A.y+.01,A.z,.012),xf(cyl(.07,.07,.025,10),A.x,re-.04,A.z),xf(new THREE.TorusGeometry(.016,.005,4,8),A.x,A.y,A.z))}
  else if(nm==="stern"){P.position.y=re+2.15;G.position.y=-.21;
    ir.push(xf(cyl(.05,.065,1.62,8),0,re+.81,13.57),xf(box(.32,.03,.32),0,re+1.625,13.57),xf(cyl(.09,.11,.06,8),0,re+.03,13.57),
      rodG(0,re+1.2,13.57,.15,re+1.61,13.57,.013),rodG(0,re+1.2,13.57,-.15,re+1.61,13.57,.013),rodG(0,re+1.2,13.57,0,re+1.61,13.72,.013),rodG(0,re+1.2,13.57,0,re+1.61,13.42,.013))}
  if(ir.length){const hm=put2(new THREE.Mesh(merge(ir),_.iron));hm.castShadow=!0}
  if(!A.scale){const top=.43,L=-G.position.y;if(L>top+.02)G.add(new THREE.Mesh(chainG(top,L),_.iron))}}
'''
one("const Ne=[],Ue=(()=>{","\n"+LBR+"\nconst Ne=[],Ue=(()=>{")

# ---- C. bell ----
one('const Ks=[[0,-.02],[.08,-.04],[.12,-.08],[.15,-.2],[.18,-.34],[.25,-.46],[.26,-.49],[.2,-.48]].map(([e,t])=>new THREE.Vector2(e,t)),Xs=new THREE.Mesh(new THREE.LatheGeometry(Ks,18),_.brass);',
 'const Ks=[[0,-.035],[.07,-.04],[.11,-.07],[.135,-.14],[.15,-.26],[.175,-.37],[.215,-.45],[.245,-.485],[.25,-.505],[.27,-.5],[.278,-.485],[.255,-.46],[.208,-.39],[.183,-.27],[.166,-.15],[.146,-.06],[.112,-.01],[.06,.015],[0,.02]].map(([e,t])=>new THREE.Vector2(e,t)),Xs=new THREE.Mesh(new THREE.LatheGeometry(Ks,28),_.bronze);')
one('const Zs=new THREE.Mesh(cyl(.015,.015,.6,4),_.rope);Zs.position.y=-.75,Ke.pivot.add(Zs)}',
 'const Zs=new THREE.Mesh(merge([cyl(.013,.013,.85,5).translate(0,-.88,0),new THREE.SphereGeometry(.036,8,6).translate(0,-1.31,0),cyl(.016,.012,.09,6).translate(0,-1.37,0)]),_.rope);Ke.pivot.add(Zs);const Yk=new THREE.Mesh(merge([xf(new THREE.TorusGeometry(.045,.014,6,12),0,.06,0),xf(box(.2,.05,.07),0,.04,0),xf(box(.025,.17,.2),-.115,.108,0),xf(box(.025,.17,.2),.115,.108,0),xf(cyl(.009,.009,.4,5),0,-.22,0)]),_.iron);Yk.castShadow=!0,Ke.pivot.add(Yk)}')
one('put2(meshOf([xf(box(.14,2.3,.14),-.55,se+1.15,-11.4),xf(box(.14,2.3,.14),.55,se+1.15,-11.4),xf(box(1.4,.16,.18),0,se+2.3,-11.4),xf(box(1.3,.12,.5),0,se+.06,-11.4)],_.dark))',
 'put2(meshOf([xf(box(.14,2.3,.14),-.55,se+1.15,-11.4),xf(box(.14,2.3,.14),.55,se+1.15,-11.4),xf(box(1.5,.16,.2),0,se+2.3,-11.4),xf(box(1.3,.12,.5),0,se+.06,-11.4),rodG(-.55,se+1.55,-11.4,-.22,se+2.22,-11.4,.045,6),rodG(.55,se+1.55,-11.4,.22,se+2.22,-11.4,.045,6),xf(box(.16,.06,.6),-.55,se+.15,-11.4),xf(box(.16,.06,.6),.55,se+.15,-11.4)],_.dark))')

# ---- D. cabin interior: bunk, rug, coat hooks ----
one('te("red",xf(box(1.9,.35,.9),2.4,se+.25,9.3)),te("paper",xf(box(1.8,.12,.8),2.4,se+.47,9.3)),','')
# collision for the bunk footprint stays as before; rug and hooks are walk-through.

# ---- E. window glass follows the sun ----
open(P,'w').write(s)
print('deck ok')
