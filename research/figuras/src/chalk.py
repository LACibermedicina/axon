"""Estilo visual 'giz e carvao' para as pranchas e graficos do livro.
Paleta e primitivas de desenho com jitter (tracado a mao) e textura de giz."""
import numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch, FancyArrowPatch
import matplotlib.font_manager as fm

# ---------------------------------------------------------------- paleta
SLATE   = "#23282b"   # lousa (fundo escuro)
SLATE2  = "#2c3236"
CHALK   = "#f2efe6"   # giz branco
CHALK_D = "#cfcabb"   # giz apagado
OCRE    = "#e0a73c"   # giz ocre  (destaque 1)
TERRA   = "#d2694b"   # giz terracota (alerta)
TEAL    = "#6fb3ae"   # giz verde-agua (destaque 2)
VIOLET  = "#a98bc9"
PAPER   = "#faf7f0"   # papel
CARVAO  = "#2b2724"   # carvao (traco no papel)
CARV_L  = "#6f6760"
AZUL    = "#2f5d7c"
RNG = np.random.default_rng(7)

SERIF = "Cardo"; SANS = "Inter"; MONO = "Anonymous Pro"; SLAB = "Cardo"

def _rc(dark):
    plt.rcParams.update({
        "font.family": SANS, "font.size": 8.2,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.edgecolor": CHALK_D if dark else CARV_L,
        "axes.labelcolor": CHALK if dark else CARVAO,
        "text.color": CHALK if dark else CARVAO,
        "xtick.color": CHALK_D if dark else CARV_L,
        "ytick.color": CHALK_D if dark else CARV_L,
        "axes.facecolor": SLATE if dark else PAPER,
        "figure.facecolor": SLATE if dark else PAPER,
        "savefig.facecolor": SLATE if dark else PAPER,
        "legend.frameon": False, "axes.grid": False,
        "pdf.fonttype": 42, "svg.fonttype": "none",
    })

def fig(w, h, dark=False, dpi=300):
    _rc(dark)
    f = plt.figure(figsize=(w, h), dpi=dpi)
    return f

def canvas(w, h, dark=True, dpi=300, xlim=(0,100), ylim=(0,100)):
    """Figura-prancha sem eixos, coordenadas 0-100."""
    f = fig(w, h, dark, dpi)
    ax = f.add_axes([0,0,1,1]); ax.set_xlim(*xlim); ax.set_ylim(*ylim)
    ax.set_xticks([]); ax.set_yticks([]); ax.set_axis_off()
    return f, ax

# ------------------------------------------------------- tracado a mao
def rough(pts, amp=0.5, n=220, seed=None):
    """Interpola e perturba uma polilinha -> tracado irregular de giz."""
    rng = np.random.default_rng(seed) if seed is not None else RNG
    p = np.asarray(pts, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))]
    if d[-1] == 0: return p
    t = np.linspace(0, d[-1], n)
    x = np.interp(t, d, p[:,0]); y = np.interp(t, d, p[:,1])
    k = max(3, n//18)
    nx = np.convolve(rng.normal(0,1,n), np.ones(k)/k, "same")
    ny = np.convolve(rng.normal(0,1,n), np.ones(k)/k, "same")
    w = np.sin(np.linspace(0, np.pi, n))**0.45      # extremidades firmes
    return np.c_[x + amp*nx*w*3, y + amp*ny*w*3]

def stroke(ax, pts, c=CHALK, lw=1.4, amp=0.45, passes=2, alpha=.92, seed=None, **kw):
    """Traco de giz: varias passagens levemente deslocadas."""
    for i in range(passes):
        q = rough(pts, amp, seed=None if seed is None else seed+i)
        ax.plot(q[:,0], q[:,1], color=c, lw=lw*(1-0.18*i), alpha=alpha*(1-0.25*i),
                solid_capstyle="round", zorder=kw.pop("zorder", 3) if i==0 else 2, **kw)

def ellipse_pts(cx, cy, rx, ry, n=160, a0=0, a1=2*np.pi):
    t = np.linspace(a0, a1, n)
    return np.c_[cx + rx*np.cos(t), cy + ry*np.sin(t)]

def circle(ax, cx, cy, r, c=CHALK, lw=1.3, amp=.35, fill=None, falpha=.18, **kw):
    if fill: ax.add_patch(plt.Circle((cx,cy), r, color=fill, alpha=falpha, lw=0, zorder=1))
    stroke(ax, ellipse_pts(cx,cy,r,r), c=c, lw=lw, amp=amp, **kw)

def ellipse(ax, cx, cy, rx, ry, c=CHALK, lw=1.3, amp=.35, fill=None, falpha=.16, ang=0, **kw):
    p = ellipse_pts(cx,cy,rx,ry)
    if ang:
        th=np.radians(ang); R=np.array([[np.cos(th),-np.sin(th)],[np.sin(th),np.cos(th)]])
        p = (p-[cx,cy])@R.T + [cx,cy]
    if fill: ax.add_patch(PathPatch(Path(p), fc=fill, ec="none", alpha=falpha, zorder=1))
    stroke(ax, p, c=c, lw=lw, amp=amp, **kw)

def box(ax, x, y, w, h, c=CHALK, lw=1.2, amp=.4, fill=None, falpha=.12, r=0, **kw):
    pts=[(x,y),(x+w,y),(x+w,y+h),(x,y+h),(x,y)]
    if fill: ax.add_patch(plt.Rectangle((x,y),w,h,fc=fill,ec="none",alpha=falpha,zorder=1))
    stroke(ax, pts, c=c, lw=lw, amp=amp, **kw)

def arrow(ax, p0, p1, c=CHALK, lw=1.3, amp=.35, head=1.6, rad=0.0, **kw):
    p0=np.array(p0,float); p1=np.array(p1,float)
    if rad:
        m=(p0+p1)/2; d=p1-p0; nrm=np.array([-d[1],d[0]]); m=m+rad*nrm
        pts=[p0, m, p1]
    else: pts=[p0,p1]
    q = rough(pts, amp)
    ax.plot(q[:-6,0], q[:-6,1], color=c, lw=lw, alpha=.92, solid_capstyle="round", zorder=3)
    d = q[-1]-q[-8]; d = d/np.linalg.norm(d)
    n = np.array([-d[1], d[0]])
    tip = q[-1]
    for s in (1,-1):
        b = tip - head*d + s*head*0.45*n
        ax.plot([tip[0],b[0]],[tip[1],b[1]], color=c, lw=lw, alpha=.92,
                solid_capstyle="round", zorder=3)

def txt(ax, x, y, s, c=CHALK, size=8.2, ha="left", va="center", font=None, w="normal",
        style="normal", alpha=1.0, rot=0, **kw):
    return ax.text(x, y, s, color=c, fontsize=size, ha=ha, va=va, rotation=rot,
                   family=font or SANS, fontweight=w, fontstyle=style, alpha=alpha, zorder=5, **kw)

def hatch(ax, pts, c=CHALK_D, n=16, ang=35, lw=.55, alpha=.35, seed=3):
    """Hachura de carvao dentro de um poligono."""
    p=np.asarray(pts,float); path=Path(p)
    x0,y0=p.min(0); x1,y1=p.max(0); rng=np.random.default_rng(seed)
    L=np.hypot(x1-x0,y1-y0); th=np.radians(ang); d=np.array([np.cos(th),np.sin(th)])
    nvec=np.array([-d[1],d[0]])
    for k in np.linspace(-L,L,n*2):
        a=np.array([(x0+x1)/2,(y0+y1)/2])+k*nvec
        seg=np.c_[np.linspace(-L,L,160)]*d + a
        inside=path.contains_points(seg)
        if inside.sum()<2: continue
        idx=np.where(inside)[0]
        s=seg[idx[0]:idx[-1]+1]
        s=s+rng.normal(0,.12,s.shape)
        ax.plot(s[:,0],s[:,1],color=c,lw=lw,alpha=alpha,zorder=1)

def chalkdust(ax, n=900, dark=True, seed=11, alpha=.07):
    rng=np.random.default_rng(seed)
    x0,x1=ax.get_xlim(); y0,y1=ax.get_ylim()
    ax.scatter(rng.uniform(x0,x1,n), rng.uniform(y0,y1,n), s=rng.uniform(.2,2.2,n),
               c=CHALK if dark else CARVAO, alpha=alpha, lw=0, zorder=0)

def save(f, name, pad=0.02):
    import os
    dest = os.environ.get("FIG_OUT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bruto"))
    dest = os.path.abspath(dest)
    os.makedirs(dest, exist_ok=True)
    f.savefig(os.path.join(dest, name + ".png"), bbox_inches="tight", pad_inches=pad)
    plt.close(f)
    print("ok", name)
