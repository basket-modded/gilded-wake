import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:90])
    s=s.replace(a,b)
# decks follow the hull's true inner width at deck height (top and underside), all the way into the bow
D2=r'''function hullW(z,h){const ty=topY(z),ky=keelY(z),t0=Math.min(1,Math.max(0,(ty-h)/Math.max(.01,ty-ky))),w=secPt(z,t0)[0];return Math.max(0,w)}
function deckSlab2(z0,z1,h,dp){const N=96,sh=new THREE.Shape,W=z=>Math.max(0,Math.min(hullW(z,h),hullW(z,h-dp))-.012);
  for(let i=0;i<=N;i++){const z=z0+(z1-z0)*i/N;i?sh.lineTo(W(z),-z):sh.moveTo(W(z),-z)}
  for(let i=N;i>=0;i--){const z=z0+(z1-z0)*i/N;sh.lineTo(-W(z),-z)}
  const r=new THREE.ExtrudeGeometry(sh,{depth:dp,bevelEnabled:!1,curveSegments:1});r.rotateX(-Math.PI/2),r.translate(0,h-dp,0);
  const uv=r.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,.5*uv.getX(i),.5*uv.getY(i));return r}
'''
one('te("deck",deckSlab(-13.9,13.7,se,.962,.3)),te("deck",deckSlab(ie,13.75,re,.948,.14));',
    'te("deck",deckSlab2(ne+.06,ne+ae-.03,se,.3)),te("deck",deckSlab2(ie,ne+ae-.03,re,.14));')
one('function deckSlab(e,t,n,o,a){',D2+'function deckSlab(e,t,n,o,a){')
# cabin front wall tops sat exactly in the quarterdeck surface: drop them 1 cm under it
one('te("wall",xf(box(fe-.6,re-se,.12),-(.6+(fe-.6)/2),(re+se)/2,ie)),te("wall",xf(box(fe-.6,re-se,.12),.6+(fe-.6)/2,(re+se)/2,ie)),te("wall",xf(box(1.2,.2,.12),0,re-.1,ie));',
    'te("wall",xf(box(fe-.6,re-se-.012,.12),-(.6+(fe-.6)/2),(re+se-.012)/2,ie)),te("wall",xf(box(fe-.6,re-se-.012,.12),.6+(fe-.6)/2,(re+se-.012)/2,ie)),te("wall",xf(box(1.2,.19,.12),0,re-.107,ie));')
# cabin door edges were flush with the door frame
one('{const Fs=[xf(box(1.18,2,.07),.59,1,0)];','{const Fs=[xf(box(1.16,2,.07),.59,1,0)];')
# lantern glass sat a millimetre from the frame bars
one("Ye=merge([xf(box(.22,.245,.005),0,-.006,.116),xf(box(.22,.245,.005),0,-.006,-.116),xf(box(.005,.245,.22),.116,-.006,0),xf(box(.005,.245,.22),-.116,-.006,0)])",
    "Ye=merge([xf(box(.205,.24,.004),0,-.006,.106),xf(box(.205,.24,.004),0,-.006,-.106),xf(box(.004,.24,.205),.106,-.006,0),xf(box(.004,.24,.205),-.106,-.006,0)])")
one('te("gold",xf(box(2*fe,.08,.06),0,re-.04,ie-.07));','te("gold",xf(box(2*fe,.08,.06),0,re-.03,ie-.07));')
one('xf(box(.3,.05,.02),.15,.4,-.05),xf(box(.3,.05,.02),.15,1.6,-.05)','xf(box(.3,.05,.02),.165,.4,-.05),xf(box(.3,.05,.02),.165,1.6,-.05)')
one('te("gold",xf(box(5.2,.12,.12),0,4.45,oe+.06))','te("gold",xf(box(5.2,.12,.12),0,4.45,oe+.072))')
open(P,'w').write(s)
print('seams ok')
