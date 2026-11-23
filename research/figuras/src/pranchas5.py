# -*- coding: utf-8 -*-
"""Prancha IX: linha do tempo do campo."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, chalk as K
from chalk import canvas, stroke, circle, txt, chalkdust, save, CHALK, CHALK_D, OCRE, TERRA, TEAL, VIOLET
f, ax = canvas(7.2, 4.6, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,70)
X0,X1,Y=8,94,36
stroke(ax,[(X0,Y),(X1,Y)],c=CHALK,lw=1.6,amp=.25)
W=X1-X0
def px(a):
    return X0+(a-1930)/70*0.40*W if a<=2000 else X0+0.40*W+(a-2000)/26*0.60*W
for a in (1940,1960,1980,2000,2010,2020,2026):
    stroke(ax,[(px(a),Y-1.2),(px(a),Y+1.2)],c=CHALK_D,lw=1.0,amp=.1,passes=1)
    txt(ax,px(a),Y-3.4,str(a),c=CHALK_D,size=6.6,ha="center")
stroke(ax,[(px(2000)-.6,Y-2.4),(px(2000)+.6,Y+2.4)],c=OCRE,lw=1.0,amp=.1,passes=1,alpha=.7)
EV=[(1933,"Blair & Erlanger\nclasses de axônio",CHALK_D,1,9,0,"center"),
    (1951,"Rushton\nteoria do calibre",OCRE,1,17,0,"center"),
    (1965,"Melzack & Wall\nteoria do portão",TERRA,-1,9,0,"center"),
    (1976,"McNeal\nmodelo nodal",OCRE,1,9,0,"center"),
    (1986,"Rattay\nfunção de ativação",OCRE,-1,17,0,"center"),
    (1992,"Shannon\nlimites de carga",TERRA,1,17,0,"center"),
    (2002,"MRG\nmodelo completo",OCRE,-1,9,0,"center"),
    (2005,"Wells\nestim. infravermelha",VIOLET,1,24,0,"center"),
    (2014,"Iyer\noptogenética",VIOLET,-1,9,0,"center"),
    (2015,"SENZA-RCT\n10 kHz",TERRA,1,9,-2,"center"),
    (2015,"Ibsen\nsonogenética",TEAL,-1,24,0,"center"),
    (2021,"Shi\nemissor optoacústico\n(neurônio único)",TEAL,1,24,0,"center"),
    (2022,"Duque\nhsTRPA1",TEAL,-1,9,0,"center"),
    (2023,"Violante\ninterferência temporal",VIOLET,1,16,0,"center"),
    (2025,"ITRUSST\nconsenso de segurança",TERRA,-1,17,2,"right"),
    (2026,"Sangwan\nbloqueio reversível\npor US focalizado",TEAL,1,9,2,"right")]
for ano,lab,c,s,dy,dx,ha in EV:
    x=px(ano)
    circle(ax,x,Y,1.0,c=c,lw=1.0,fill=c,falpha=.85)
    stroke(ax,[(x,Y+s*1.6),(x,Y+s*dy)],c=c,lw=.7,amp=.2,passes=1,alpha=.65)
    txt(ax,x+dx,Y+s*(dy+1.2),lab,c=c,size=6.0,ha=ha,va="bottom" if s>0 else "top")
txt(ax,3,67,"PRANCHA IX",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,63.4,"Noventa anos de um mesmo obstáculo",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,8,3.0,"Âmbar: fundamentos de excitabilidade e calibre · vermelho: clínica e segurança · verde: acústica e transdução · violeta: vias alternativas.\n"
             "A hierarquia de acesso por calibre atravessa a linha inteira sem ser removida. A escala temporal é expandida após 2000 (marca âmbar).",
    c=CHALK_D,size=6.8,style="italic",font=K.SERIF)
save(f,"p09_timeline_campo")
print("P5 OK")
