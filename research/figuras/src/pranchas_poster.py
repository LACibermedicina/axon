# -*- coding: utf-8 -*-
"""Pranchas didaticas desenhadas para o poster (escala grande, poucos rotulos)."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, chalk as K
from matplotlib.patches import Rectangle, Polygon, Wedge
from chalk import (canvas, stroke, circle, ellipse, box, arrow, txt, hatch,
                   chalkdust, save, CHALK, CHALK_D, OCRE, TERRA, TEAL, VIOLET)
rng=np.random.default_rng(11)

# ============================================================ PP1 — a ordem errada
f, ax = canvas(8.0, 3.9, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,55)
X0,X1 = 20, 92
stroke(ax,[(X0,8),(X1,8)],c=CHALK,lw=2.0,amp=.2)
arrow(ax,(X1-2,8),(X1+3,8),c=CHALK,lw=2.0,amp=.1,head=1.8)
txt(ax,(X0+X1)/2,4.0,"CORRENTE APLICADA  →",c=CHALK,size=10,ha="center",w="bold")

FIB=[("Aα","motora",16,2.9,CHALK_D,24),
     ("Aβ","tato",9,2.2,TEAL,33),
     ("Aδ","DOR",3,1.3,TERRA,62),
     ("C","dor lenta",1,0.8,TERRA,86)]
y=50
for nome,fun,D,r,c,xth in FIB:
    circle(ax,9,y,r,c=c,lw=1.6,fill=c,falpha=.35)
    txt(ax,14,y+1.0,nome,c=c,size=11,w="bold")
    txt(ax,14,y-2.2,fun,c=CHALK_D,size=7.4)
    # trilho
    stroke(ax,[(X0,y),(X1,y)],c=CHALK_D,lw=.8,amp=.2,passes=1,alpha=.35)
    # marcador de limiar
    stroke(ax,[(xth,y-3.2),(xth,y+3.2)],c=c,lw=2.4,amp=.12,passes=1)
    ax.add_patch(Rectangle((xth,y-1.3),X1-xth,2.6,fc=c,ec="none",alpha=.30,zorder=2))
    txt(ax,xth+2.0,y+4.6,"acende aqui",c=c,size=7.2)
    y-=11.5
# dose confortavel
xd=44
stroke(ax,[(xd,6),(xd,52)],c=OCRE,lw=2.2,amp=.15)
txt(ax,xd+1.6,52.6,"dose tolerável\npelo paciente",c=OCRE,size=8.6,w="bold")
for nome,fun,D,r,c,xth in FIB:
    pass
txt(ax,X0,11.0,"nesta dose: Aα e Aβ já acesas · Aδ e C ainda apagadas",c=OCRE,size=8.6)
save(f,"pp1_ordem_errada")

# ============================================================ PP2 — duas reguas
f, ax = canvas(8.0, 3.1, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,40)

def painel(x0,x1,passo,c,titulo,subt,rot):
    xc=(x0+x1)/2
    xx=np.linspace(x0,x1,300)
    V=30-15/np.sqrt(((xx-xc)/6.5)**2+1)
    ax.plot(xx,V,color=CHALK,lw=2.4,alpha=.95,zorder=3)
    pts=np.array([xc-passo,xc,xc+passo])
    vs=30-15/np.sqrt(((pts-xc)/6.5)**2+1)
    for xi,vi in zip(pts,vs):
        stroke(ax,[(xi,vi),(xi,10)],c=c,lw=1.0,amp=.15,passes=1,alpha=.5)
        circle(ax,xi,vi,1.0,c=c,lw=1.3,fill=c,falpha=.95)
    stroke(ax,[(pts[0],10),(pts[-1],10)],c=c,lw=2.2,amp=.1,passes=1)
    for xi in pts: stroke(ax,[(xi,8.8),(xi,11.2)],c=c,lw=1.8,amp=.08,passes=1)
    # degrau medido
    xb=x1-1.5
    stroke(ax,[(xb,vs[1]),(xb,vs[0])],c=c,lw=2.6,amp=.08,passes=1)
    for yy in (vs[0],vs[1]): stroke(ax,[(xb-1.2,yy),(xb+1.2,yy)],c=c,lw=1.4,amp=.08,passes=1)
    txt(ax,xb-2.0,(vs[0]+vs[1])/2,rot,c=c,size=9.2,ha="right",w="bold")
    txt(ax,xc,36.0,titulo,c=c,size=10.4,ha="center",w="bold")
    txt(ax,xc,6.0,subt,c=CHALK_D,size=8.0,ha="center")

painel(8,46,13,TEAL,"FIBRA GROSSA","nós distantes → régua longa","degrau\nGRANDE")
painel(54,92,4.5,TERRA,"FIBRA FINA","nós próximos → régua curta","degrau\npequeno")
stroke(ax,[(50,8),(50,38)],c=CHALK_D,lw=.8,amp=.2,passes=1,alpha=.3)
save(f,"pp2_duas_reguas")

# ============================================================ PP3 — quatro portas
f, ax = canvas(8.0, 2.8, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,36)
W=22.0; gap=3.2; x=2.0
P=[("DIFRAÇÃO","o foco nunca fica\nmenor que a onda",TEAL),
   ("ATENUAÇÃO","encurtar a onda\nvira calor no caminho",TERRA),
   ("AMORTECIMENTO","nervo imerso em líquido:\nnão há ressonância",OCRE),
   ("ESCALA MOLECULAR","canais vibram em GHz–THz,\nfora do ultrassom médico",VIOLET)]
for i,(t,s,c) in enumerate(P):
    box(ax,x,4,W,26,c=c,lw=1.6,amp=.4,fill=c,falpha=.08)
    cx=x+W/2
    if i==0:
        for rr in (3.2,5.4,7.6): stroke(ax,K.ellipse_pts(cx-6,20,rr,rr,a0=-.9,a1=.9),c=c,lw=1.4,amp=.2,passes=1,alpha=.8)
        circle(ax,cx+5,20,2.6,c=c,lw=1.8,fill=c,falpha=.35)
        stroke(ax,[(cx+2.4,20),(cx+7.6,20)],c=CHALK,lw=1.2,amp=.1,passes=1)
    if i==1:
        xs=np.linspace(cx-8,cx+8,120); ys=20+6*np.exp(-(xs-(cx-8))/6)*np.sin((xs-(cx-8))*2.2)
        ax.plot(xs,ys,color=c,lw=1.8,alpha=.9)
        for k in range(4):
            arrow(ax,(cx+1+k*2.2,15.5),(cx+1.8+k*2.2,12.5),c=TERRA,lw=1.0,amp=.1,head=.8)
    if i==2:
        for yy in (16,20,24): stroke(ax,[(cx-8,yy),(cx+8,yy)],c=c,lw=.8,amp=.6,passes=1,alpha=.35)
        xs=np.linspace(cx-6,cx+6,80); ax.plot(xs,20+1.1*np.sin((xs-cx)*2.0),color=CHALK,lw=1.6,alpha=.85)
        txt(ax,cx,12.5,"≈ mel",c=c,size=7.6,ha="center")
    if i==3:
        stroke(ax,[(cx-8,18),(cx+8,18)],c=CHALK_D,lw=1.2,amp=.15,passes=1)
        for xx,lab in ((cx-6,"MHz"),(cx+5,"THz")):
            stroke(ax,[(xx,17),(xx,19)],c=CHALK_D,lw=1.1,amp=.1,passes=1)
            txt(ax,xx,15.0,lab,c=CHALK_D,size=7.2,ha="center")
        circle(ax,cx-6,22.5,1.6,c=TEAL,lw=1.4,fill=TEAL,falpha=.5)
        circle(ax,cx+5,22.5,1.6,c=c,lw=1.4,fill=c,falpha=.5)
        txt(ax,cx,26.5,"muito longe",c=c,size=7.4,ha="center")
    txt(ax,cx,32.6,t,c=c,size=9.6,ha="center",w="bold")
    txt(ax,cx,7.6,s,c=CHALK_D,size=7.8,ha="center")
    x+=W+gap
save(f,"pp3_quatro_portas")

# ============================================================ PP4 — semaforo da seguranca
f, ax = canvas(8.0, 2.5, dark=True); chalkdust(ax,500)
ax.set_xlim(0,100); ax.set_ylim(0,32)
S=[("CARGA","relação de Shannon","k < 1,75",TEAL,.42),
   ("CALOR","ΔT ou dose térmica","≤ 2 °C · 2 CEM43",OCRE,.58),
   ("PRESSÃO","índice mecânico","MI ≤ 1,9",OCRE,.66),
   ("TEMPO","resposta do tecido (meses)","sem limite definido",TERRA,.90)]
W=22.0; gap=3.2; x=2.0
for t,sub,lim,c,frac in S:
    box(ax,x,5,W,22,c=c,lw=1.5,amp=.35,fill=c,falpha=.07)
    bx,by,bw,bh = x+3, 8, W-6, 4.4
    stroke(ax,[(bx,by),(bx+bw,by),(bx+bw,by+bh),(bx,by+bh),(bx,by)],c=CHALK_D,lw=1.0,amp=.15,passes=1)
    ax.add_patch(Rectangle((bx,by),bw*frac,bh,fc=c,ec="none",alpha=.55,zorder=2))
    stroke(ax,[(bx+bw*frac,by-1.4),(bx+bw*frac,by+bh+1.4)],c=CHALK,lw=1.8,amp=.1,passes=1)
    txt(ax,x+W/2,23.0,t,c=c,size=10.4,ha="center",w="bold")
    txt(ax,x+W/2,19.2,sub,c=CHALK_D,size=7.4,ha="center")
    txt(ax,x+W/2,15.0,lim,c=CHALK,size=8.4,ha="center",w="bold")
    x+=W+gap
txt(ax,4,1.4,"As barras são ilustrativas: mostram que as margens não coincidem entre si, não valores medidos.",
    c=CHALK_D,size=7.4,style="italic",font=K.SERIF)
save(f,"pp4_semaforo")
print("POSTER PLATES OK")
