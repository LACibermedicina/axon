"""Preditor de limiar por calibre (cadeia nodal McNeal-like, membrana passiva, regime linear).
Autor: L. S. Teixeira. Unidades CGS: cm, ohm.cm, S, F. Semente fixa. Ver artigo, Seção 4."""
import numpy as np, json
RHO_I,RHO_E,CM,GL,LN,VTH=110.,300.,2e-6,30.3e-3,2.5e-4,0.020   # ohm.cm, ohm.cm, F/cm2, S/cm2, cm, V
def h(D,r,pw=100e-6,rho_i=RHO_I,N=41,dt=1e-6):
    """Despolarização nodal máxima (V) por A de corrente catódica; D em µm, r em cm."""
    Dc=D*1e-4;d=.7*Dc;L=100*Dc;Ga=np.pi*d**2/4/(rho_i*L);ar=np.pi*d*LN;C=CM*ar;g=GL*ar
    x=(np.arange(N)-N//2)*L;Ve=-RHO_E/(4*np.pi*np.sqrt(x**2+r**2))     # fonte pontual, meio homogêneo
    drv=np.zeros(N);drv[1:-1]=Ga*(Ve[:-2]-2*Ve[1:-1]+Ve[2:]);V=np.zeros(N);vm=0
    for k in range(int((pw+300e-6)/dt)):
        Vp=np.pad(V,1,mode="edge");lap=Vp[:-2]-2*V+Vp[2:]
        V=V+dt/C*(-g*V+Ga*lap+(drv if k*dt<pw else 0));vm=max(vm,V.max())
    return vm
def Ith(D,r,**k):return VTH/h(D,r,**k)      # A (linear => limiar = Vth/h)
if __name__=="__main__":
    Ds=np.arange(1,16.1,1.0);rs=np.array([.03,.05,.07,.10,.15])  # 0,3 a 1,5 mm
    T=np.array([[Ith(D,r) for r in rs] for D in Ds])*1e3          # mA
    al=-np.polyfit(np.log(Ds),np.log(T[:,3]),1)[0]
    R={"alpha_r1mm":al,"Ith_mA_r1mm":dict(zip(map(float,Ds),T[:,3].round(3).tolist()))}
    for lab,rho in(("rho_i70",70.),("rho_i150",150.)):
        R["ratio_3_9_"+lab]=Ith(3,.1,rho_i=rho)/Ith(9,.1,rho_i=rho)
    R["ratio_3_9_r1mm"]=Ith(3,.1)/Ith(9,.1);R["ratio_3_9_r05mm"]=Ith(3,.05)/Ith(9,.05);R["ratio_3_9_r15mm"]=Ith(3,.15)/Ith(9,.15)
    R["Ith_1um_r1mm"]=Ith(1,.1)*1e3
    # Monte Carlo: fascículo hipotético (40% Aβ ~N(9;1,5), 60% Aδ ~N(3;0,8), D>=1), r~U(0,03;0,15 cm)
    rng=np.random.default_rng(42);n=20000;ab=rng.random(n)<.4
    D=np.where(ab,rng.normal(9,1.5,n),rng.normal(3,.8,n)).clip(1,16);r=rng.uniform(.03,.15,n)
    from scipy.interpolate import RegularGridInterpolator as RGI
    f=RGI((np.log(Ds),np.log(rs)),np.log(T));It=np.exp(f(np.c_[np.log(D),np.log(r)]))
    def i50(m):return np.median(It[m])
    bs=[];
    for _ in range(2000):
        j=rng.integers(0,n,n);m=ab[j];bs.append(np.median(It[j][~m])/np.median(It[j][m]))
    R["I50_Abeta_mA"]=i50(ab);R["I50_Adelta_mA"]=i50(~ab);R["ratio_I50"]=i50(~ab)/i50(ab);R["ratio_CI95"]=np.percentile(bs,[2.5,97.5]).tolist()
    I=np.logspace(-1.5,1.5,200);fa=[(It[ab]<=i).mean() for i in I];fd=[(It[~ab]<=i).mean() for i in I]
    # janela: maior Δ = fração Aβ − fração Aδ... seletividade invertida: máx. fração Aδ recrutada com Aβ<=10%
    ok=[j for j,i in enumerate(I) if fa[j]<=.10];R["Adelta_frac_when_Abeta_le10pct"]=float(fd[ok[-1]]) if ok else 0.
    json.dump(R,open("res.json","w"),indent=1)
    import matplotlib;matplotlib.use("Agg");import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family":"DejaVu Sans","font.size":8,"axes.spines.top":False,"axes.spines.right":False})
    fig,ax=plt.subplots(figsize=(3.4,2.3),dpi=300)
    for j,rr in enumerate(rs):ax.loglog(Ds,T[:,j],lw=1.5,label=f"r = {rr*10:.1f} mm")
    ax.set_xlabel("Diâmetro D (µm)");ax.set_ylabel("Limiar previsto (mA)");ax.legend(frameon=False,fontsize=6.5);fig.tight_layout();fig.savefig("f4.png");plt.close()
    fig,ax=plt.subplots(figsize=(3.4,2.3),dpi=300);ax.semilogx(I,fa,color="#12355b",lw=1.8,label="Aβ");ax.semilogx(I,fd,color="#e08e0b",lw=1.8,label="Aδ")
    ax.set_xlabel("Corrente catódica (mA)");ax.set_ylabel("Fração recrutada");ax.legend(frameon=False);fig.tight_layout();fig.savefig("f5.png");plt.close()
    print(json.dumps(R,indent=1))
