# -*- coding: utf-8 -*-
"""Pranchas de dispositivos, anatomia e conceitos — para completar paginas."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, chalk as K
from matplotlib.patches import Rectangle, Polygon, Wedge
from chalk import (canvas, stroke, circle, ellipse, box, arrow, txt, hatch,
                   chalkdust, save, CHALK, CHALK_D, OCRE, TERRA, TEAL, VIOLET)
rng=np.random.default_rng(23)

# ================================================== P12 — familias de eletrodos
f, ax = canvas(7.2, 3.6, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,46)
W=29.5; gap=3.5; x=3.0
# (a) cuff
cx=x+W/2
stroke(ax,[(x+3,26),(x+W-3,26)],c=CHALK,lw=1.2,amp=.2)
stroke(ax,[(x+3,20),(x+W-3,20)],c=CHALK,lw=1.2,amp=.2)
ax.add_patch(Rectangle((x+3,20),W-6,6,fc=CHALK,ec="none",alpha=.07,zorder=1))
stroke(ax,K.ellipse_pts(cx,23,6.5,5.2,a0=-np.pi*.42,a1=np.pi*1.42),c=OCRE,lw=2.2,amp=.25)
for a_ in (-0.5,0.5):
    circle(ax,cx+a_*3.2,27.6,.9,c=OCRE,lw=1.2,fill=OCRE,falpha=.8)
txt(ax,cx,33.5,"BRAÇADEIRA (cuff)",c=OCRE,size=8.0,ha="center",w="bold")
txt(ax,cx,13.5,"envolve o nervo por fora;\nnão perfura o perineuro",c=CHALK_D,size=6.8,ha="center")
txt(ax,cx,9.0,"seletividade: baixa\ninvasividade: baixa",c=CHALK,size=6.8,ha="center")
x+=W+gap
# (b) intrafascicular
cx=x+W/2
stroke(ax,[(x+3,26),(x+W-3,26)],c=CHALK,lw=1.2,amp=.2)
stroke(ax,[(x+3,20),(x+W-3,20)],c=CHALK,lw=1.2,amp=.2)
ax.add_patch(Rectangle((x+3,20),W-6,6,fc=CHALK,ec="none",alpha=.07,zorder=1))
for dx in (-4,0,4):
    stroke(ax,[(cx+dx,30),(cx+dx,21)],c=TEAL,lw=1.8,amp=.12)
    circle(ax,cx+dx,21.6,.7,c=TEAL,lw=1.0,fill=TEAL,falpha=.9)
stroke(ax,[(cx-6,30),(cx+6,30)],c=TEAL,lw=1.6,amp=.15)
txt(ax,cx,33.5,"INTRAFASCICULAR",c=TEAL,size=8.0,ha="center",w="bold")
txt(ax,cx,13.5,"atravessa o perineuro e põe\ncontatos junto aos axônios",c=CHALK_D,size=6.8,ha="center")
txt(ax,cx,9.0,"seletividade: alta\ninvasividade: alta",c=CHALK,size=6.8,ha="center")
x+=W+gap
# (c) epidural paddle
cx=x+W/2
ellipse(ax,cx,22,8.5,5.0,c=CHALK,lw=1.3,amp=.3)
butt=[(cx-4,25.4),(cx-1.6,23),(cx-4,20.4),(cx-1.6,18.6),(cx+1.6,18.6),(cx+4,20.4),(cx+1.6,23),(cx+4,25.4),(cx-4,25.4)]
stroke(ax,butt,c=CHALK_D,lw=.9,amp=.3,passes=1)
ax.add_patch(Rectangle((cx-7,27.2),14,2.6,fc=VIOLET,ec="none",alpha=.35,zorder=3))
stroke(ax,[(cx-7,27.2),(cx+7,27.2),(cx+7,29.8),(cx-7,29.8),(cx-7,27.2)],c=VIOLET,lw=1.4,amp=.15,passes=1)
for dx in (-4.5,-1.5,1.5,4.5): circle(ax,cx+dx,28.5,.75,c=VIOLET,lw=.9,fill=VIOLET,falpha=.9)
txt(ax,cx,33.5,"PLACA EPIDURAL (SCS)",c=VIOLET,size=8.0,ha="center",w="bold")
txt(ax,cx,13.5,"sobre a dura-máter, atua nas\ncolunas dorsais da medula",c=CHALK_D,size=6.8,ha="center")
txt(ax,cx,9.0,"seletividade: de população\ninvasividade: cirúrgica",c=CHALK,size=6.8,ha="center")
txt(ax,3,42,"PRANCHA XIII",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,38.3,"Três famílias de interface e o que cada uma compra com a sua invasividade",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,3.4,"Esquemas fora de escala. A seletividade cresce com a proximidade ao axônio — e com o preço cirúrgico e a reação tecidual.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p12_eletrodos")

# ================================================== P13 — a via da dor
f, ax = canvas(7.2, 3.4, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,44)
y=24
# pele
stroke(ax,[(5,y+6),(16,y+6)],c=CHALK,lw=1.6,amp=.3)
stroke(ax,[(5,y+3.4),(16,y+3.4)],c=CHALK_D,lw=1.0,amp=.3,passes=1)
for xx in np.linspace(6.5,14.5,5):
    stroke(ax,[(xx,y+3.4),(xx,y)],c=TERRA,lw=1.0,amp=.25,passes=1)
    circle(ax,xx,y+3.4,.5,c=TERRA,lw=.8,fill=TERRA,falpha=.9)
txt(ax,10.5,y+9.0,"pele",c=CHALK,size=7.6,ha="center",w="bold")
txt(ax,10.5,y-3.6,"terminais\nnociceptivos",c=TERRA,size=6.8,ha="center")
# axonio ate o ganglio
stroke(ax,[(16,y),(34,y)],c=TERRA,lw=1.6,amp=.2)
circle(ax,38,y,3.6,c=CHALK,lw=1.4,amp=.2,fill=CHALK,falpha=.10)
txt(ax,38,y+6.0,"gânglio da raiz\ndorsal",c=CHALK,size=6.8,ha="center")
stroke(ax,[(41.6,y),(50,y)],c=TERRA,lw=1.6,amp=.2)
# medula
ellipse(ax,57,y,7.5,6.0,c=CHALK,lw=1.4,amp=.3)
b=[(53.6,y+3.2),(55.6,y+1.4),(53.6,y-0.6),(55.6,y-2.6),(58.4,y-2.6),(60.4,y-0.6),(58.4,y+1.4),(60.4,y+3.2),(53.6,y+3.2)]
stroke(ax,b,c=CHALK_D,lw=.9,amp=.3,passes=1)
txt(ax,57,y+8.6,"medula espinhal",c=CHALK,size=6.8,ha="center")
stroke(ax,[(64.5,y+1),(74,y+4)],c=CHALK,lw=1.4,amp=.25)
# talamo e cortex
circle(ax,79,y+5,3.2,c=VIOLET,lw=1.3,amp=.2,fill=VIOLET,falpha=.25)
txt(ax,79,y+0.2,"tálamo",c=VIOLET,size=6.8,ha="center")
stroke(ax,K.ellipse_pts(91,y+8,6.5,4.5,a0=np.pi*0.05,a1=np.pi*0.95),c=CHALK,lw=1.6,amp=.4)
for k in range(3): stroke(ax,K.ellipse_pts(91,y+8,6.5-k*1.6,4.5-k*1.1,a0=np.pi*0.1,a1=np.pi*0.9),c=CHALK_D,lw=.7,amp=.4,passes=1,alpha=.5)
stroke(ax,[(82.2,y+5.6),(85.5,y+7.6)],c=VIOLET,lw=1.3,amp=.2)
txt(ax,91,y+1.6,"córtex\nsomatossensorial",c=CHALK,size=6.8,ha="center")
# onde cada tecnica atua
TEC=[("TENS",10.5,TEAL),("bloqueio por kHz",25,TEAL),("SCS",57,VIOLET),("LIFU",70,OCRE),("ETCC / EMT",91,OCRE)]
for nome,xx,c in TEC:
    stroke(ax,[(xx,8.5),(xx,11.5)],c=c,lw=1.4,amp=.15,passes=1)
    txt(ax,xx,6.8,nome,c=c,size=6.6,ha="center")
stroke(ax,[(4,11.8),(96,11.8)],c=CHALK_D,lw=.7,amp=.3,passes=1,alpha=.35)
txt(ax,4,13.6,"onde cada técnica atua",c=CHALK_D,size=6.8)
txt(ax,3,40,"PRANCHA XV",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,36.3,"A via da dor, da pele ao córtex — e os pontos de intervenção",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,1.6,"Esquema simplificado: omite interneurônios, vias descendentes moduladoras e a projeção límbica da dor.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p13_via_dor")

# ================================================== P14 — escala comparativa
f, ax = canvas(7.2, 3.1, dark=True); chalkdust(ax,500)
ax.set_xlim(0,100); ax.set_ylim(0,40)
X0,X1,Y=9,93,19
def px(um): return X0+(np.log10(um)-np.log10(.1))/(np.log10(1e4)-np.log10(.1))*(X1-X0)
stroke(ax,[(X0,Y),(X1,Y)],c=CHALK,lw=1.8,amp=.2)
for um,lab in ((.1,"0,1 µm"),(1,"1 µm"),(10,"10 µm"),(100,"100 µm"),(1000,"1 mm"),(10000,"1 cm")):
    stroke(ax,[(px(um),Y-1.4),(px(um),Y+1.4)],c=CHALK_D,lw=1.0,amp=.1,passes=1)
    txt(ax,px(um),Y+2.6,lab,c=CHALK_D,size=6.4,ha="center",va="bottom")
IT=[(0.8,"fibra C",TERRA,-1,4),(3,"fibra Aδ",TERRA,-1,9),(9,"fibra Aβ",TEAL,1,8),
    (20,"ponta optoacústica",OCRE,-1,4),(70,"cabelo humano",CHALK_D,1,13),
    (1000,"foco de ultrassom (1,5 MHz)",OCRE,-1,9),(3000,"eletrodo em braçadeira",VIOLET,1,8),
    (8000,"placa epidural",VIOLET,-1,4)]
for um,lab,c,s,dy in IT:
    x=px(um)
    circle(ax,x,Y,1.0,c=c,lw=1.1,fill=c,falpha=.9)
    stroke(ax,[(x,Y+s*1.6),(x,Y+s*dy)],c=c,lw=.8,amp=.2,passes=1,alpha=.7)
    txt(ax,x,Y+s*(dy+1.2),lab,c=c,size=6.6,ha="center",va="bottom" if s>0 else "top")
ax.add_patch(Rectangle((px(1),Y-0.9),px(16)-px(1),1.8,fc=TERRA,ec="none",alpha=.22,zorder=2))
txt(ax,3,36,"PRANCHA XVII",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,32.3,"As escalas do problema, lado a lado",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,1.6,"A faixa destacada é a dos axônios mielinizados. Note que o foco acústico clínico está duas ordens de grandeza acima dela.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p14_escalas")
print("P8a OK")

# ================================================== P15 — intensidade x duracao
f, ax = canvas(7.2, 3.2, dark=True); chalkdust(ax,500)
ax.set_xlim(0,100); ax.set_ylim(0,42)
X0,X1,Y0,Y1=16,70,8,28
stroke(ax,[(X0,Y0),(X1,Y0)],c=CHALK_D,lw=1.2,amp=.15)
stroke(ax,[(X0,Y0),(X0,Y1+2)],c=CHALK_D,lw=1.2,amp=.15)
t=np.linspace(0.08,1.0,200)
for D,c,lab in ((9,TEAL,"Aβ (9 µm)"),(3,TERRA,"Aδ (3 µm)")):
    reo = 3.0 if D==3 else 1.0
    I = reo*(1+0.16/t)
    xs=X0+(t-0.08)/(1.0-0.08)*(X1-X0); ys=Y0+I*2.1
    ax.plot(xs,ys,color=c,lw=2.2,alpha=.95,zorder=3)
    stroke(ax,[(X0,Y0+reo*2.1),(X1,Y0+reo*2.1)],c=c,lw=.8,amp=.15,passes=1,alpha=.5)
    txt(ax,X1+1.6,Y0+reo*2.1,f"reobase {lab}",c=c,size=6.6)
xc=X0+(0.16-0.08)/(1.0-0.08)*(X1-X0)
stroke(ax,[(xc,Y0),(xc,Y0+2*1.0*2.1)],c=CHALK,lw=1.2,amp=.12,passes=1)
txt(ax,xc+1.4,Y0+3.0,"cronaxia",c=CHALK,size=6.8)
xw=X0+(0.10-0.08)/(1.0-0.08)*(X1-X0)
stroke(ax,[(xw,Y0),(xw,Y1+1)],c=OCRE,lw=1.6,amp=.12,passes=1)
txt(ax,xw+1.6,Y1-1.0,"ponto de trabalho\ndeste modelo: 100 µs",c=OCRE,size=6.8)
txt(ax,(X0+X1)/2,Y0-3.4,"duração do pulso  t$_p$  →",c=CHALK,size=7.4,ha="center")
txt(ax,X0-2.0,(Y0+Y1)/2,"corrente\nnecessária",c=CHALK,size=7.4,ha="right")
txt(ax,3,38,"PRANCHA XVI",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,34.3,"A curva intensidade–duração e por que o pulso foi fixado em 100 µs",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,2.2,"Curvas ilustrativas da forma I = reobase · (1 + cronaxia/t$_p$). Fixar t$_p$ para todos os calibres é o que permite atribuir\n"
             "a diferença de limiar ao diâmetro, e não à forma do estímulo.",c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p15_intensidade_duracao")

# ================================================== P16 — transdutor e grandezas de dose
f, ax = canvas(7.2, 3.5, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,44)
stroke(ax,[(8,30),(8,14)],c=CHALK,lw=2.6,amp=.2)
for yy in np.linspace(15,29,8): stroke(ax,[(8,yy),(10,yy)],c=CHALK_D,lw=.8,amp=.1,passes=1)
txt(ax,6,32,"transdutor",c=CHALK,size=7.4)
foc=(46,22)
ax.add_patch(Polygon([[10,30],[10,14],[foc[0],foc[1]+1.2],[foc[0],foc[1]-1.2]],fc=TEAL,ec="none",alpha=.14,zorder=1))
stroke(ax,[(10,30),(foc[0],foc[1]+1.2)],c=TEAL,lw=1.3,amp=.3)
stroke(ax,[(10,14),(foc[0],foc[1]-1.2)],c=TEAL,lw=1.3,amp=.3)
circle(ax,foc[0],foc[1],2.4,c=OCRE,lw=1.6,fill=OCRE,falpha=.45)
txt(ax,foc[0],foc[1]+5.0,"foco",c=OCRE,size=7.2,ha="center")
# onda e grandezas
xs=np.linspace(56,94,300); ys=24+4.4*np.sin((xs-56)*1.1)*np.exp(-((xs-70)/26)**2)
ax.plot(xs,ys,color=CHALK,lw=1.6,alpha=.9,zorder=3)
stroke(ax,[(56,24),(94,24)],c=CHALK_D,lw=.7,amp=.2,passes=1,alpha=.4)
pk=np.argmin(ys); stroke(ax,[(xs[pk],24),(xs[pk],ys[pk])],c=TERRA,lw=1.6,amp=.1,passes=1)
stroke(ax,[(xs[pk],ys[pk]),(xs[pk]+4,17.2)],c=TERRA,lw=.7,amp=.2,passes=1,alpha=.8)
txt(ax,xs[pk]+4.4,16.6,"p$_r$ pressão de rarefação → MI = p$_r$/√f",c=TERRA,size=6.6,ha="left")
ax.add_patch(Rectangle((60,29.5),26,3.2,fc=OCRE,ec="none",alpha=.25,zorder=2))
stroke(ax,[(60,29.5),(86,29.5),(86,32.7),(60,32.7),(60,29.5)],c=OCRE,lw=1.0,amp=.15,passes=1)
txt(ax,73,31.1,"I$_{SPTA}$ — intensidade média no tempo",c=OCRE,size=6.8,ha="center")
txt(ax,73,34.6,"ciclo de trabalho × intensidade de pico → calor",c=CHALK_D,size=6.6,ha="center")
stroke(ax,[(60,10.5),(86,10.5)],c=VIOLET,lw=1.0,amp=.15,passes=1)
for k,xx in enumerate(np.linspace(61,85,7)):
    ax.add_patch(Rectangle((xx,10.5),1.8,2.4,fc=VIOLET,ec="none",alpha=.5,zorder=2))
txt(ax,73,7.6,"ΔT e dose térmica acumulada (CEM43)",c=VIOLET,size=6.8,ha="center")
txt(ax,3,39,"PRANCHA XII",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,35.3,"O transdutor focalizado e as três grandezas que a norma controla",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,2.0,"MI mede o risco mecânico instantâneo; I$_{SPTA}$, a carga térmica média; CEM43, o acúmulo ao longo da exposição. "
             "São contas distintas sobre o mesmo pulso.",c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p16_transdutor_dose")

# ================================================== P17 — janela terapeutica
f, ax = canvas(7.2, 3.0, dark=True); chalkdust(ax,500)
ax.set_xlim(0,100); ax.set_ylim(0,38)
X0,X1,Y0,H=14,78,8,19
stroke(ax,[(X0,Y0),(X1,Y0)],c=CHALK_D,lw=1.2,amp=.15)
stroke(ax,[(X0,Y0),(X0,Y0+H+3)],c=CHALK_D,lw=1.2,amp=.15)
d=np.linspace(0,1,250); xs=X0+d*(X1-X0)
def sig(x0,k): return 1/(1+np.exp(-(d-x0)*k))
ef=sig(.30,14); dano=sig(.62,16); alvo=sig(.78,16)
ax.plot(xs,Y0+ef*H,color=TEAL,lw=2.4,zorder=3); txt(ax,X0+0.30*(X1-X0)-1,Y0+H+1.4,"efeito em Aβ",c=TEAL,size=6.8,ha="center")
ax.plot(xs,Y0+alvo*H,color=OCRE,lw=2.4,ls="--",zorder=3); txt(ax,X0+0.80*(X1-X0),Y0+H+1.4,"efeito em Aδ",c=OCRE,size=6.8,ha="center")
ax.plot(xs,Y0+dano*H,color=TERRA,lw=2.4,zorder=3); txt(ax,X0+0.60*(X1-X0)-7,Y0+H+1.4,"dano tecidual",c=TERRA,size=6.8,ha="center")
m=(d>.30)&(d<.62); ax.fill_between(xs[m],Y0,Y0+H,color=TEAL,alpha=.10)
txt(ax,X0+0.46*(X1-X0),Y0+2.2,"janela terapêutica\natual (via Aβ)",c=TEAL,size=6.8,ha="center")
m2=(d>.62)&(d<.95); ax.fill_between(xs[m2],Y0,Y0+H,color=TERRA,alpha=.12)
txt(ax,X1+1.6,Y0+H*.55,"para alcançar Aδ a dose\nentra na região de dano:\na janela se fecha",c=TERRA,size=6.8)
txt(ax,(X0+X1)/2,Y0-3.4,"dose entregue  →",c=CHALK,size=7.4,ha="center")
txt(ax,X0-2.0,Y0+H/2,"probabilidade",c=CHALK,size=7.4,ha="right",rot=90)
txt(ax,3,34,"PRANCHA XIV",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,30.3,"Por que a janela terapêutica se fecha antes de alcançar a fibra fina",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,3,2.2,"Curvas ilustrativas, não ajustadas a dados. O argumento é de ordenação: o limiar de dano é atravessado antes do limiar\n"
             "de efeito nas fibras finas — consequência direta da razão de limiares medida no Capítulo 7.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"p17_janela_terapeutica")
print("P8b OK")
