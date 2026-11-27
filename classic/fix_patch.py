import sys
P=sys.argv[1] if len(sys.argv)>1 else '/home/claude/mp/classic2.html'
s=open(P).read()
def one(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:100])
    s=s.replace(a,b)
# ---- bowsprit: a square spar resting on the stem head, heel in knighthead bitts, jib-boom, cap, gammoning, dolphin striker ----
k=0.234;a='Math.atan(.234)'
Y=lambda z:4.58+k*(-15-z)
BS=('te("dark",xf(box(.34,.34,8.01),0,%.3f,-15.9,%s,0,0)),'%(Y(-15.9),a)+
    'te("dark",xf(box(.2,.2,4.11),0,%.3f,-20.6,%s,0,0)),'%(Y(-20.6)+.26,a)+
    'te("dark",xf(box(.5,.62,.2),0,%.3f,-19.55,%s,0,0)),'%(Y(-19.55)+.12,a)+
    ''.join('te("iron",xf(box(.39,.39,.07),0,%.3f,%.2f,%s,0,0)),'%(Y(z),z,a) for z in (-14.55,-14.75,-15.55,-15.75,-18.9,-21.9))+
    'te("dark",xf(box(.2,1.75,.2),-.3,3.27,-12.25)),te("dark",xf(box(.2,1.75,.2),.3,3.27,-12.25)),te("dark",xf(box(.84,.16,.22),0,3.57,-12.25)),'+
    'te("dark",xf(box(.09,1.1,.09),0,%.3f,-19.4)),'%((Y(-19.4)-.17+Y(-19.4)-1.27)/2)+
    'te("rope",rodG(0,%.3f,-19.4,0,%.3f,-22.55,.025)),te("rope",rodG(0,%.3f,-19.4,0,3.25,-15.05,.025));'%(Y(-19.4)-1.27,Y(-22.55)+.26,Y(-19.4)-1.27))
one('te("dark",xf(cyl(.16,.24,9.5,10),0,4.6,-17.8,-Math.PI/2+me,0,0)),te("gold",xf(new THREE.TorusGeometry(.3,.06,6,14),0,4.15,-14.6,0,0,0));',BS)
# ---- the stern lantern stands on its post: no swinging; all lanterns burn steadily ----
one('n.pivot.rotation.set(n.ax,0,n.az)','"stern"===n.name?n.pivot.rotation.set(0,0,0):n.pivot.rotation.set(n.ax,0,n.az)')
one('const s=.88+.08*Math.sin(13*t+n.flick)+.05*Math.sin(23.7*t+2*n.flick)+.03*Math.sin(41*t+n.flick)','const s=.95+.03*Math.sin(1.7*t+n.flick)+.02*Math.sin(2.9*t+2*n.flick)')
one('pt.flame.material.opacity=.8+.2*Math.sin(17*t)*Math.sin(7.3*t),pt.flame.scale.set(.1+.02*Math.sin(11*t),.2+.03*Math.sin(9*t),1)','pt.flame.material.opacity=.92+.06*Math.sin(2.1*t),pt.flame.scale.set(.1+.006*Math.sin(1.9*t),.2+.01*Math.sin(2.3*t),1)')
# ---- shadow acne (black shimmer): closed voxel solids cast from their back faces, with more normal bias ----
one('Kt.shadow.bias=-4e-4,Kt.shadow.normalBias=.035','Kt.shadow.bias=-6e-4,Kt.shadow.normalBias=.07')
one("_.sail.shadowSide=THREE.DoubleSide;","_.sail.shadowSide=THREE.DoubleSide;for(const q in _){const m=_[q];m&&m.isMaterial&&m!==_.flag&&(m.shadowSide=THREE.BackSide)}")
# ---- black flashes: a canvas resize wipes the frame already drawn; redraw straight away ----
one('f.setSize(innerWidth,innerHeight,!1),v.aspect=innerWidth/innerHeight,v.updateProjectionMatrix()}','f.setSize(innerWidth,innerHeight,!1),v.aspect=innerWidth/innerHeight,v.updateProjectionMatrix(),y.children.length>2&&f.render(y,v)}')
open(P,'w').write(s)
print('fix ok')
