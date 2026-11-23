# -*- coding: utf-8 -*-
"""Pranchas 3: portao, algoritmo, fases experimentais, cronograma, arquitetura, PRISMA, disciplinas."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, chalk as K
from matplotlib.patches import Rectangle, Polygon, FancyBboxPatch
from chalk import (canvas, stroke, circle, ellipse, box, arrow, txt, hatch,
                   chalkdust, save, CHALK, CHALK_D, OCRE, TERRA, TEAL, VIOLET)

# ================================================= P08 teoria do portao
f, ax = canvas(7.2, 4.3, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,58)
# medula (corte)
ellipse(ax,70,28,17,13,c=CHALK,lw=1.6,amp=.45)
butt=[(62,38),(66,33),(62,28),(66,21),(62,17),(74,17),(78,21),(74,28),(78,33),(74,38),(62,38)]
stroke(ax,butt,c=CHALK_D,lw=1.2,amp=.4)
hatch(ax,butt,c=CHALK_D,n=14,ang=40,alpha=.18)
txt(ax,70,44.5,"medula espinhal (corno dorsal)",c=CHALK,size=7.4,ha="center")
# fibras chegando
stroke(ax,[(8,36),(34,36),(52,33),(62,31)],c=TEAL,lw=2.6,amp=.3)
txt(ax,8,39,"Aβ  grossa, mielinizada — tato",c=TEAL,size=7.4)
stroke(ax,[(8,20),(34,20),(52,23),(62,25)],c=TERRA,lw=1.3,amp=.3)
txt(ax,8,16.6,"Aδ / C  finas — nocicepção",c=TERRA,size=7.4)
# interneuronio inibitorio
circle(ax,57,29,2.4,c=VIOLET,lw=1.4,fill=VIOLET,falpha=.3)
txt(ax,57,33.6,"interneurônio\ninibitório",c=VIOLET,size=6.8,ha="center")
arrow(ax,(48,34.4),(55.4,30.4),c=TEAL,lw=1.0,amp=.15,head=1.1)
stroke(ax,[(57,26.6),(57,24.2)],c=VIOLET,lw=1.4,amp=.1,passes=1)
stroke(ax,[(55.4,24.0),(58.6,24.0)],c=VIOLET,lw=2.0,amp=.1,passes=1)
txt(ax,59.4,23.2,"bloqueia a\ntransmissão",c=VIOLET,size=6.6)
# projecao ascendente
arrow(ax,(78,30),(92,36),c=CHALK,lw=1.4,amp=.25,head=1.5)
txt(ax,92,38.6,"trato espinotalâmico →\npercepção da dor",c=CHALK,size=7.0,ha="right")
# estimulador
box(ax,8,42,26,6.4,c=OCRE,lw=1.3,amp=.35,fill=OCRE,falpha=.12)
txt(ax,21,45.2,"TENS / SCS: ativa Aβ",c=OCRE,size=7.6,ha="center")
arrow(ax,(21,41.6),(21,37.4),c=OCRE,lw=1.2,amp=.2,head=1.2)
txt(ax,3,55,"PRANCHA VIII",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,51.3,"A teoria do portão — e o paradoxo que ela cria",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,6,6.5,"A analgesia elétrica funciona por um desvio: como as fibras finas da dor são as mais difíceis de recrutar,\n"
             "ativam-se as grossas do tato para que elas fechem o portão medular. É eficaz — e é o sintoma de um limite físico.",
    c=CHALK_D,size=7.2,style="italic",font=K.SERIF)
save(f,"p08_portao")

# ================================================= D01 algoritmo ilustrado
f, ax = canvas(7.2, 5.6, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,78)
PASSOS=[("1","Entrada","p(D) — distribuição de calibres;  r — distância;  t$_p$ — largura do pulso",OCRE),
        ("2","Grade de resposta","integrar a cadeia de 41 nós (Euler, Δt = 1 µs) para cada (D, r)",TEAL),
        ("3","Limiar","regime passivo é linear ⇒  I$_{lim}$ = V$_{lim}$ / h(D, r)",TEAL),
        ("4","Amostragem Monte Carlo","N = 20 000 fibras: classe ~ Bernoulli, D ~ Normal, r ~ Uniforme",VIOLET),
        ("5","Curvas de recrutamento","F$_c$(I) = fração da classe c com I$_{lim}$ ≤ I",VIOLET),
        ("6","Janela de seletividade","maior F$_{Aδ}$ sujeita a F$_{Aβ}$ ≤ 10 %",TERRA),
        ("7","Incerteza","bootstrap de 2 000 reamostragens → IC 95 % da razão de limiares",TERRA)]
y=66; h=6.8
for i,(n,t,s,c) in enumerate(PASSOS):
    box(ax,16,y-h,74,h,c=c,lw=1.2,amp=.35,fill=c,falpha=.08)
    circle(ax,11,y-h/2,3.1,c=c,lw=1.3,fill=c,falpha=.25)
    txt(ax,11,y-h/2,n,c=c,size=9,ha="center",w="bold")
    txt(ax,19,y-h/2+1.7,t,c=c,size=8.0,w="bold")
    txt(ax,19,y-h/2-1.8,s,c=CHALK,size=6.9)
    if i<len(PASSOS)-1: arrow(ax,(11,y-h-.3),(11,y-h-1.7),c=CHALK_D,lw=1.1,amp=.1,head=1.0)
    y-=h+2.1
txt(ax,3,74,"DIAGRAMA 1",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,70.2,"O preditor de limiar por calibre, passo a passo",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,11,2.4,"Saída: F$_c$(I), razão de limiares com IC 95 % e dose mínima eficaz.  Semente fixa (42) → execução reprodutível.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"d01_algoritmo")

# ================================================= D02 fases experimentais
f, ax = canvas(7.2, 5.2, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,74)
FASES=[("FASE 0","In silico","MRG completo em NEURON;\nelementos finitos do meio;\nverificação ASME V&V 40",OCRE,
        "Critério de passagem: convergência numérica e\nreprodução de dados publicados de limiar."),
       ("FASE 1","Bancada / phantom","hidrofone em gel;\nmapa de pressão e de ΔT;\ncalibração do emissor",TEAL,
        "Critério: erro de posicionamento < 0,2 mm e\nΔT medido < 1 °C na janela de trabalho."),
       ("FASE 2","Ex vivo","nervo ciático isolado;\nregistro de potencial de ação composto;\ndissociação por velocidade",VIOLET,
        "Critério: separação das componentes Aβ e Aδ\ne razão de limiares medida vs. prevista."),
       ("FASE 3","In vivo (animal)","modelo de dor em roedor;\ndesfechos comportamentais;\nhistologia de segurança",TERRA,
        "Critério: analgesia reversível sem lesão\nhistológica; aprovação CEUA prévia.")]
y=64; h=11.2
for i,(f0,tit,txts,c,crit) in enumerate(FASES):
    box(ax,6,y-h,44,h,c=c,lw=1.3,amp=.35,fill=c,falpha=.08)
    txt(ax,9,y-3.0,f0,c=c,size=7.4,w="bold")
    txt(ax,9,y-6.0,tit,c=CHALK,size=9.0,font=K.SERIF)
    txt(ax,9,y-9.0,txts,c=CHALK_D,size=6.6)
    # portao de decisao
    cx=58
    ax.add_patch(Polygon([[cx,y-h/2+3.4],[cx+4.4,y-h/2],[cx,y-h/2-3.4],[cx-4.4,y-h/2]],
                 fc=c,ec="none",alpha=.16,zorder=1))
    stroke(ax,[(cx,y-h/2+3.4),(cx+4.4,y-h/2),(cx,y-h/2-3.4),(cx-4.4,y-h/2),(cx,y-h/2+3.4)],
           c=c,lw=1.1,amp=.25)
    txt(ax,cx,y-h/2,"passa?",c=c,size=6.6,ha="center")
    arrow(ax,(50.5,y-h/2),(53.2,y-h/2),c=CHALK_D,lw=1.0,amp=.1,head=.9)
    txt(ax,64,y-h/2,crit,c=CHALK_D,size=6.6)
    if i<3:
        arrow(ax,(28,y-h-.5),(28,y-h-3.8),c=CHALK_D,lw=1.2,amp=.1,head=1.1)
        stroke(ax,[(cx,y-h/2-3.8),(cx,y-h-2.4),(30,y-h-2.4)],c=TERRA,lw=.8,amp=.2,passes=1,alpha=.55)
    y-=h+4.6
txt(ax,3,71,"DIAGRAMA 2",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,67.6,"Escada de evidência: nenhuma fase começa sem o critério da anterior",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,6,1.6,"Linha tracejada em vermelho: retorno ao modelo quando o critério não é atendido. "
             "A fase 3 exige protocolo CEUA aprovado; não há etapa em humanos neste programa.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"d02_fases")

# ================================================= D03 cronograma
f, ax = canvas(7.2, 4.4, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,60)
X0,X1=26,94; Y0,Y1=12,44
for m in range(0,49,6):
    x=X0+(X1-X0)*m/48
    stroke(ax,[(x,Y0),(x,Y1)],c=CHALK_D,lw=.5,amp=.1,passes=1,alpha=.25)
    txt(ax,x,Y0-2.8,f"{m}",c=CHALK_D,size=6.6,ha="center")
txt(ax,(X0+X1)/2,Y0-6.0,"meses a partir do ingresso",c=CHALK,size=7.6,ha="center")
TAR=[("Disciplinas e qualificação",0,18,CHALK_D),
     ("Modelo MRG + FEM (Fase 0)",0,12,OCRE),
     ("Protocolo e registro OSF",2,8,TEAL),
     ("Revisão sistemática (execução)",6,20,TEAL),
     ("Bancada / phantom (Fase 1)",12,24,VIOLET),
     ("Ex vivo (Fase 2)",22,36,VIOLET),
     ("In vivo piloto (Fase 3)",34,44,TERRA),
     ("Redação e defesa",40,48,CHALK)]
yy=Y1-3.0
for nome,a,b,c in TAR:
    x0=X0+(X1-X0)*a/48; x1=X0+(X1-X0)*b/48
    ax.add_patch(Rectangle((x0,yy-1.5),x1-x0,3.0,fc=c,ec="none",alpha=.30,zorder=2))
    stroke(ax,[(x0,yy-1.5),(x1,yy-1.5),(x1,yy+1.5),(x0,yy+1.5),(x0,yy-1.5)],c=c,lw=1.0,amp=.18,passes=1)
    txt(ax,X0-1.6,yy,nome,c=c,size=6.8,ha="right")
    yy-=4.0
for m,lab in ((12,"qualificação"),(24,"1º artigo"),(36,"2º artigo"),(48,"defesa")):
    x=X0+(X1-X0)*m/48
    ax.scatter([x],[Y1+1.6],marker="D",s=22,color=OCRE,zorder=5)
    txt(ax,x,Y1+3.4,lab,c=OCRE,size=6.4,ha="center")
txt(ax,3,56,"DIAGRAMA 3",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,52.4,"Cronograma de 48 meses (doutorado direto) — compacta para 24 no mestrado",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,6,4.0,"As fases 1–3 dependem de supervisão de laboratório credenciado e de aprovação ética prévia; "
             "o cronograma assume início do protocolo animal apenas após a Fase 1 concluída.",
    c=CHALK_D,size=7.0,style="italic",font=K.SERIF)
save(f,"d03_cronograma")
print("P3 OK")
