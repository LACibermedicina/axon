# -*- coding: utf-8 -*-
"""Fluxogramas: separacao metodologica, selecao da literatura, procedimento numerico."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, chalk as K
from matplotlib.patches import Rectangle, Polygon
from chalk import (canvas, stroke, circle, box, arrow, txt, chalkdust, save,
                   CHALK, CHALK_D, OCRE, TERRA, TEAL, VIOLET)

# ===================================================== D07 — tres metodologias
f, ax = canvas(7.2, 5.6, dark=True); chalkdust(ax,700)
ax.set_xlim(0,100); ax.set_ylim(0,80)
LANES=[("A","MÉTODO DA FUNDAMENTAÇÃO","bibliográfico · executado",TEAL,17.5,
        ["Pergunta de pesquisa\ne escopo do problema",
         "Critérios de inclusão\ne de exclusão declarados",
         "Leitura e conferência\nde cada valor na fonte",
         "Corpus de 82 referências\nclassificado por tipo",
         "Parâmetros do modelo\ne premissas identificadas"]),
       ("B","MÉTODO DO ESTUDO","modelagem in silico · executado",OCRE,50,
        ["Formulação: cadeia nodal\n+ função de ativação",
         "Implementação com\nsemente fixa",
         "Verificação: Δt, nº de nós,\ninvariância a ρₑ",
         "Monte Carlo (N = 20 000)\n+ bootstrap (2 000)",
         "Resultados: razões\ne tendências"]),
       ("C","MÉTODO PROPOSTO","trabalho futuro · NÃO executado",TERRA,82.5,
        ["Protocolo PRISMA\nregistrado no OSF",
         "Busca em cinco bases\n+ literatura cinzenta",
         "Triagem por dois revisores\n(κ ≥ 0,6)",
         "Risco de viés: SYRCLE\ne ASME V&V 40",
         "Fases 0–3: validação,\nbancada, ex vivo, in vivo"])]
W=30.0
for letra,tit,sub,c,x,itens in LANES:
    box(ax,x-W/2,6,W,62,c=c,lw=1.3,amp=.35,fill=c,falpha=.05)
    txt(ax,x,65.0,letra,c=c,size=13,ha="center",w="bold")
    txt(ax,x,61.6,tit,c=c,size=7.6,ha="center",w="bold")
    txt(ax,x,58.9,sub,c=CHALK_D,size=6.6,ha="center")
    y=54
    for k,it in enumerate(itens):
        box(ax,x-W/2+2.2,y-6.6,W-4.4,6.6,c=c,lw=1.0,amp=.25,fill=c,falpha=.10)
        txt(ax,x,y-3.3,it,c=CHALK,size=6.6,ha="center")
        if k<len(itens)-1: arrow(ax,(x,y-7.0),(y and x,y-8.6),c=c,lw=1.0,amp=.1,head=.9)
        y-=9.2
arrow(ax,(32.9,36),(35.1,36),c=CHALK_D,lw=1.4,amp=.08,head=1.4)
stroke(ax,[(63.6,33.6),(68.4,38.4)],c=TERRA,lw=2.6,amp=.12,passes=1)
stroke(ax,[(68.4,33.6),(63.6,38.4)],c=TERRA,lw=2.6,amp=.12,passes=1)
txt(ax,3,76,"DIAGRAMA 7",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,72.4,"Três métodos distintos, declarados separadamente",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,4,3.4,"A alimenta B (seta).  C não alimenta nenhuma das duas (X): nenhum resultado deste trabalho depende dela.",
    c=CHALK,size=7.4,font=K.SANS)
txt(ax,4,0.6,"Confundir A com C é o erro metodológico mais comum neste tipo de trabalho: parametrizar um modelo a partir da literatura "
             "não é fazer revisão sistemática.",c=CHALK_D,size=6.8,style="italic",font=K.SERIF)
save(f,"d07_tres_metodos")

# ===================================================== D08 — selecao da literatura
f, ax = canvas(6.6, 6.0, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,94)
def bloco(y,h,t,s,c,w=56,x=12):
    box(ax,x,y,w,h,c=c,lw=1.2,amp=.3,fill=c,falpha=.08)
    txt(ax,x+2.6,y+h-2.4,t,c=c,size=7.6,w="bold",va="top")
    txt(ax,x+2.6,y+h-6.4,s,c=CHALK_D,size=6.4,va="top")
bloco(68,13,"IDENTIFICAÇÃO DAS FONTES",
      "Bases indexadas (PubMed, IEEE Xplore, Scopus) por termos livres;\n"
      "referências cruzadas das revisões-chave; documentos normativos\n"
      "das agências e sociedades citadas em cada fronteira de segurança.",OCRE)
bloco(49,15,"CRITÉRIOS DE INCLUSÃO",
      "1 · fonte primária sempre que a medida original existia\n"
      "2 · parâmetros físicos explícitos no texto\n"
      "3 · modelo com equações e constantes declaradas\n"
      "4 · documento normativo vigente para cada fronteira",TEAL)
bloco(28,17,"CRITÉRIOS DE EXCLUSÃO",
      "1 · ablação térmica por HIFU (objeto distinto)\n"
      "2 · desfecho clínico sem descrição de dose\n"
      "3 · revisão quando a fonte primária estava disponível\n"
      "4 · modelo sem parâmetros ou sem verificação relatada\n"
      "5 · referência cuja informação bibliográfica não se confirmou",TERRA)
bloco(14,11,"CORPUS FINAL — 82 REFERÊNCIAS",
      "Cada valor numérico conferido contra a fonte citada;\n"
      "classe e nível de confiança registrados por referência.",CHALK)
for y in (68,49,28):
    arrow(ax,(40,y-0.4),(40,y-2.2),c=CHALK_D,lw=1.1,amp=.1,head=1.0)
CLS=[("EXP",22,TEAL),("MOD",15,OCRE),("REV",18,CHALK_D),("DIR",10,VIOLET),
     ("NOR",4,TERRA),("CLA",6,CHALK_D),("FER",4,TEAL),("LIV",3,OCRE)]
x=12; tot=sum(c[1] for c in CLS); Wb=56
for nome,n,c in CLS:
    w=Wb*n/tot
    ax.add_patch(Rectangle((x,6.0),w,4.2,fc=c,ec="none",alpha=.55,zorder=2))
    stroke(ax,[(x,6.0),(x+w,6.0),(x+w,10.2),(x,10.2),(x,6.0)],c=c,lw=.8,amp=.12,passes=1)
    txt(ax,x+w/2,11.6,nome,c=c,size=5.8,ha="center",w="bold")
    txt(ax,x+w/2,7.4,str(n),c=CHALK,size=6.4,ha="center",w="bold")
    x+=w
txt(ax,12,3.2,"EXP experimental · MOD modelagem · REV revisão · DIR diretriz · NOR norma · CLA clássico · FER ferramenta · LIV livro",
    c=CHALK_D,size=5.8)
txt(ax,72,62,"Não se relatam\ncontagens de registros\ntriados: a busca\nnão foi protocolada,\ne números de triagem\nsó têm sentido em\nrevisão sistemática.",c=TERRA,size=6.6)
txt(ax,3,90,"DIAGRAMA 8",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,86.4,"Como a literatura deste trabalho foi selecionada",c=CHALK,size=9.2,font=K.SERIF)
save(f,"d08_selecao_literatura")

# ===================================================== D09 — procedimento numerico
f, ax = canvas(7.2, 4.6, dark=True); chalkdust(ax,600)
ax.set_xlim(0,100); ax.set_ylim(0,60)
def cx_box(x,y,w,h,t,c,fs=6.8):
    box(ax,x,y,w,h,c=c,lw=1.1,amp=.28,fill=c,falpha=.09)
    txt(ax,x+w/2,y+h/2,t,c=CHALK,size=fs,ha="center")
def gate(x,y,t,c):
    ax.add_patch(Polygon([[x,y+4.0],[x+6.5,y],[x,y-4.0],[x-6.5,y]],fc=c,ec="none",alpha=.16,zorder=1))
    stroke(ax,[(x,y+4.0),(x+6.5,y),(x,y-4.0),(x-6.5,y),(x,y+4.0)],c=c,lw=1.1,amp=.22)
    txt(ax,x,y,t,c=c,size=6.2,ha="center")
cx_box(4,40,20,9,"Entrada\np(D), r, t_p",OCRE)
cx_box(28,40,20,9,"Grade h(D, r)\n41 nós, Δt = 1 µs",OCRE)
gate(62,44.5,"Δt e nº de nós\nconvergem?",TEAL)
cx_box(78,40,18,9,"I_lim = V_lim / h\npor divisão",TEAL)
cx_box(78,22,18,9,"Monte Carlo\nN = 20 000",VIOLET)
gate(62,26.5,"razões invariantes\na ρₑ?",VIOLET)
cx_box(28,22,20,9,"Curvas de\nrecrutamento F_c(I)",VIOLET)
cx_box(4,22,20,9,"Bootstrap\n2 000 reamostras",TERRA)
cx_box(28,6,44,9,"Saída: razão de limiares com IC 95 %, janela de seletividade\ne lei de escala — exportadas com semente e versão do código",TERRA,6.6)
arrow(ax,(24.4,44.5),(27.6,44.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(48.4,44.5),(55.2,44.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(68.8,44.5),(77.6,44.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(87,39.6),(87,31.4),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(77.6,26.5),(68.8,26.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(55.2,26.5),(48.4,26.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(27.6,26.5),(24.4,26.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
arrow(ax,(14,21.6),(14,17.5),c=CHALK_D,lw=1.0,amp=.1,head=.9)
stroke(ax,[(14,17.5),(14,10.5),(27.6,10.5)],c=CHALK_D,lw=1.0,amp=.15,passes=1)
stroke(ax,[(62,48.8),(62,50.2),(38,50.2),(38,49.4)],c=TERRA,lw=.9,amp=.2,passes=1,alpha=.7)
txt(ax,50,51.0,"não → refinar a grade",c=TERRA,size=6.2,ha="center")
stroke(ax,[(62,22.2),(62,18.5),(38,18.5),(38,21.6)],c=TERRA,lw=.9,amp=.2,passes=1,alpha=.7)
txt(ax,50,17.2,"não → revisar a implementação",c=TERRA,size=6.2,ha="center")
txt(ax,3,57.6,"DIAGRAMA 9",c=OCRE,size=10,w="bold",font=K.SANS)
txt(ax,3,54.0,"O procedimento numérico, com os dois portões de verificação",c=CHALK,size=9.2,font=K.SERIF)
txt(ax,4,2.0,"Os portões em losango são testes que o código precisa passar antes de a saída ser considerada válida; "
             "ambos foram executados e aprovados nesta edição.",c=CHALK_D,size=6.8,style="italic",font=K.SERIF)
save(f,"d09_procedimento_numerico")
print("P7 OK")
