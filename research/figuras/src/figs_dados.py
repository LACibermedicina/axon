"""Figuras quantitativas do livro (carvao sobre papel)."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter
import chalk as K
import modelo_preditivo as mp

W, H = 5.6, 3.2
def ax1(w=W, h=H, dark=False):
    f = K.fig(w, h, dark); ax = f.add_subplot(111); return f, ax

def tune(ax, xl, yl, title=None):
    ax.set_xlabel(xl, fontsize=8.6); ax.set_ylabel(yl, fontsize=8.6)
    if title: ax.set_title(title, fontsize=9.4, family=K.SLAB, pad=8, loc="left")
    ax.tick_params(length=3, width=.7, labelsize=7.6)
    for s in ("left","bottom"): ax.spines[s].set_linewidth(.8)

# ---------------------------------------------------------------- F1 escalas
D = np.linspace(1, 16, 200)
f, ax = ax1()
ax.plot(D, 6*D, color=K.AZUL, lw=2.0, label="velocidade  $v \\approx 6\\,D$  (m/s)")
ax.plot(D, 100*D/10, color=K.TERRA, lw=2.0, ls="--", label="espaço internodal  $L \\approx 100\\,D$  (µm × 10$^{-1}$)")
ax.fill_between([1,5],0,110, color=K.TERRA, alpha=.08)
ax.fill_between([6,12],0,110, color=K.AZUL, alpha=.08)
ax.text(3, 103, "Aδ", ha="center", fontsize=9, color=K.TERRA, family=K.SLAB)
ax.text(9, 103, "Aβ", ha="center", fontsize=9, color=K.AZUL, family=K.SLAB)
ax.set_ylim(0, 112); ax.set_xlim(1, 16)
ax.legend(fontsize=7.4, loc="lower right")
tune(ax, "Diâmetro externo da fibra  D (µm)", "Grandeza derivada",
     "Leis de escala do calibre axonal")
K.save(f, "f01_escalas")

# ---------------------------------------------------------------- F2 limiar x D
Ds = np.arange(1, 16.1, 1.0); rs = np.array([.03,.05,.07,.10,.15])
T = np.array([[mp.Ith(d, r) for r in rs] for d in Ds])*1e3
np.save(os.path.join(os.environ.get("FIG_TMP", "."), "T.npy"), T)
f, ax = ax1()
cols = [K.AZUL, "#3d7fa6", K.TEAL, "#c08a2e", K.TERRA]
for j, rr in enumerate(rs):
    ax.loglog(Ds, T[:,j], lw=2.0, color=cols[j], label=f"r = {rr*10:.1f} mm")
al = -np.polyfit(np.log(Ds), np.log(T[:,3]), 1)[0]
ax.loglog(Ds, T[0,3]*Ds**(-al), ls=":", lw=1.2, color=K.CARV_L)
ax.text(5.2, 2.6, f"ajuste  $I_{{lim}} \\propto D^{{-{al:.2f}}}$", fontsize=8.2, color=K.CARVAO,
        family=K.MONO)
ax.legend(fontsize=7.2, loc="upper right", ncol=2)
for a in (ax.xaxis, ax.yaxis): a.set_major_formatter(ScalarFormatter())
ax.set_xticks([1,2,3,5,9,16]); ax.set_xticklabels(["1","2","3","5","9","16"])
tune(ax, "Diâmetro D (µm)", "Limiar previsto (mA)",
     "Limiar de ativação × calibre (modelo nodal passivo)")
K.save(f, "f02_limiar_diametro")

# ---------------------------------------------------------------- F3 recrutamento
rng = np.random.default_rng(42); n = 20000
ab = rng.random(n) < .4
Dm = np.where(ab, rng.normal(9,1.5,n), rng.normal(3,.8,n)).clip(1,16)
rr = rng.uniform(.03,.15,n)
from scipy.interpolate import RegularGridInterpolator as RGI
fint = RGI((np.log(Ds), np.log(rs)), np.log(T))
It = np.exp(fint(np.c_[np.log(Dm), np.log(rr)]))
I = np.logspace(-1.5, 1.5, 300)
fa = np.array([(It[ab] <= i).mean() for i in I]); fd = np.array([(It[~ab] <= i).mean() for i in I])
f, ax = ax1()
ax.semilogx(I, fa*100, color=K.AZUL, lw=2.2, label="Aβ (táteis, 6–12 µm)")
ax.semilogx(I, fd*100, color=K.TERRA, lw=2.2, label="Aδ (nociceptivas, 1–5 µm)")
i10 = I[np.where(fa <= .10)[0][-1]]
ax.axvline(i10, color=K.CARV_L, lw=.9, ls="--")
ax.annotate(f"10% das Aβ recrutadas\n→ {fd[np.where(fa<=.10)[0][-1]]*100:.1f}% das Aδ",
            xy=(i10, 10), xytext=(i10*1.5, 46), fontsize=7.6, color=K.CARVAO,
            arrowprops=dict(arrowstyle="->", color=K.CARV_L, lw=.8))
ax.fill_between(I, 0, 100, where=(I<=i10), color=K.AZUL, alpha=.05)
ax.set_ylim(0, 100); ax.legend(fontsize=7.6, loc="center right")
tune(ax, "Corrente catódica (mA)", "Fração recrutada (%)",
     "Janela de seletividade no fascículo hipotético")
K.save(f, "f03_recrutamento")

# ---------------------------------------------------------------- F4 ressonancia estocastica
def sr_curve(sig=0.5, thr=1.0, fhz=5., Ttot=40., dt=1e-3, seed=42, reps=5):
    rng = np.random.default_rng(seed); t = np.arange(0, Ttot, dt); s = sig*np.sin(2*np.pi*fhz*t)
    lv = np.linspace(.02, 2.0, 28); out = []
    for sd in lv:
        c = []
        for _ in range(reps):
            x = s + rng.normal(0, sd, t.size); y = (x > thr).astype(float)
            Y = np.fft.rfft(y - y.mean()); fr = np.fft.rfftfreq(t.size, dt)
            k = np.argmin(abs(fr - fhz)); P = abs(Y)**2
            band = np.r_[P[max(0,k-40):k-3], P[k+4:k+41]]
            c.append(P[k]/(band.mean()+1e-12))
        out.append(np.mean(c))
    return lv, np.array(out)
lv, snr = sr_curve()
f, ax = ax1()
ax.plot(lv, snr, color=K.CARVAO, lw=1.0, alpha=.35)
ax.scatter(lv, snr, s=16, color=K.OCRE, edgecolor=K.CARVAO, lw=.5, zorder=4)
k = int(np.argmax(snr))
ax.axvline(lv[k], color=K.TERRA, lw=1.0, ls="--")
ax.text(lv[k]+.05, snr.max()*.92, f"ruído ótimo  σ ≈ {lv[k]:.2f}", fontsize=8, color=K.TERRA)
tune(ax, "Intensidade do ruído  σ (u.a.)", "SNR na frequência do sinal (u.a.)",
     "Ressonância estocástica em detector de limiar")
K.save(f, "f04_ressonancia_estocastica")

# ---------------------------------------------------------------- F5 difracao e atenuacao
fr = np.logspace(np.log10(.2), np.log10(300), 300)   # MHz
lam = 1500/(fr*1e6)*1e6                              # µm
att = 0.5*fr*1.0                                     # dB em 1 cm
f, ax = ax1()
ax.loglog(fr, lam, color=K.AZUL, lw=2.2, label="comprimento de onda λ (µm)")
ax.loglog(fr, att, color=K.TERRA, lw=2.2, label="atenuação em 1 cm (dB)")
ax.axhline(10, color=K.CARV_L, lw=.9, ls=":")
ax.text(.25, 12, "escala do axônio ≈ 10 µm", fontsize=7.4, color=K.CARV_L)
ax.axvline(150, color=K.CARVAO, lw=.9, ls="--")
ax.text(160, 2.5e3, "λ = 10 µm\nexige ≈150 MHz\n→ ≈75 dB/cm", fontsize=7.4, color=K.CARVAO)
ax.fill_betweenx([1e-1, 1e4], 0.2, 3, color=K.TEAL, alpha=.10)
ax.text(.22, 2.6e3, "faixa terapêutica\nusual (0,2–3 MHz)", fontsize=7.2, color="#3d7a76")
ax.set_ylim(1e-1, 1e4); ax.legend(fontsize=7.4, loc="lower left", bbox_to_anchor=(.0,.02))
tune(ax, "Frequência (MHz)", "λ (µm)   |   atenuação (dB em 1 cm)",
     "O compromisso entre resolução e penetração")
K.save(f, "f05_difracao_atenuacao")

# ---------------------------------------------------------------- F6 Shannon
Q = np.logspace(-2, 1.6, 200)     # µC/fase
f, ax = ax1()
for k_, c, ls in ((1.5,K.TEAL,"-"), (1.75,K.OCRE,"--"), (2.0,K.TERRA,"-.")):
    ax.loglog(Q, 10**(k_ - np.log10(Q)), color=c, lw=2.0, ls=ls, label=f"k = {k_}")
ax.fill_between(Q, 10**(1.5-np.log10(Q)), 1e-2, color=K.TEAL, alpha=.07)
ax.text(.012, 2.2, "região convencionalmente\nconsiderada segura", fontsize=7.4, color="#3d7a76")
ax.text(1.6, 1.2, "lesão documentada\nem córtex (k ≥ 2)", fontsize=7.4, color=K.TERRA)
ax.set_ylim(1e-2, 1e3); ax.legend(fontsize=7.6, title="log$_{10}$D = k − log$_{10}$Q",
                                  title_fontsize=7.6, loc="lower left", bbox_to_anchor=(.0,.02))
tune(ax, "Carga por fase  Q (µC/fase)", "Densidade de carga  D (µC/cm²/fase)",
     "Fronteira de Shannon para estimulação elétrica")
K.save(f, "f06_shannon")

# ---------------------------------------------------------------- F7 razao x distancia
rr2 = np.linspace(.02, .20, 24)
rat = np.array([mp.Ith(3, r)/mp.Ith(9, r) for r in rr2])
f, ax = ax1(W, 2.9)
ax.plot(rr2*10, rat, color=K.CARVAO, lw=2.0)
ax.scatter(rr2*10, rat, s=14, color=K.OCRE, edgecolor=K.CARVAO, lw=.4, zorder=4)
ax.axhline(1, color=K.TERRA, lw=1.0, ls="--")
ax.text(.3, 1.08, "razão = 1 → nenhuma discriminação por calibre", fontsize=7.2, color=K.TERRA)
ax.annotate("mais longe do eletrodo,\nmaior a separação de limiares",
            xy=(1.7, rat[-4]), xytext=(.6, 3.9), fontsize=7.4, color=K.CARVAO,
            arrowprops=dict(arrowstyle="->", color=K.CARV_L, lw=.8))
tune(ax, "Distância eletrodo–fibra  r (mm)", "Razão de limiares  Aδ(3 µm)/Aβ(9 µm)",
     "Sensibilidade da seletividade à geometria")
K.save(f, "f07_razao_distancia")

# ---------------------------------------------------------------- F8 mapa de limiares
Dg = np.linspace(1, 16, 40); rg = np.linspace(.03, .18, 30)
Z = np.array([[mp.Ith(d, r)*1e3 for r in rg] for d in Dg])
f, ax = ax1(W, 3.4)
cf = ax.contourf(rg*10, Dg, np.log10(Z), levels=22, cmap="copper_r")
cs = ax.contour(rg*10, Dg, np.log10(Z), levels=[np.log10(.3), np.log10(1), np.log10(3)],
                colors=[K.PAPER], linewidths=1.1)
ax.clabel(cs, fmt={np.log10(.3):"0,3 mA", np.log10(1):"1 mA", np.log10(3):"3 mA"}, fontsize=6.8)
ax.axhspan(6, 12, color=K.PAPER, alpha=.0)
ax.plot([.3,1.8],[9,9], color=K.PAPER, lw=1.0, ls="--"); ax.text(1.82,9,"Aβ",color=K.CARVAO,fontsize=8,va="center")
ax.plot([.3,1.8],[3,3], color=K.PAPER, lw=1.0, ls=":");  ax.text(1.82,3,"Aδ",color=K.CARVAO,fontsize=8,va="center")
cb = f.colorbar(cf, ax=ax, pad=.09); cb.set_label("log$_{10}$ limiar (mA)", fontsize=7.6)
cb.ax.tick_params(labelsize=7)
tune(ax, "Distância r (mm)", "Diâmetro D (µm)", "Mapa de limiares: calibre × geometria")
K.save(f, "f08_mapa_limiares")

json.dump({"alpha": float(al), "i10_mA": float(i10),
           "Adelta_at_10pct": float(fd[np.where(fa<=.10)[0][-1]]),
           "sigma_opt": float(lv[k])}, open(os.path.join(os.environ.get("FIG_TMP", "."), "figdata.json"), "w"), indent=1)
print("FIGS DADOS OK")
