#!/usr/bin/env python3
"""axon · pipeline anatômico: BodyParts3D (STL) → pacotes leves para o palco 3D.

Fonte: BodyParts3D, © The Database Center for Life Science, licenciado sob
Creative Commons Attribution-Share Alike 2.1 Japan (CC BY-SA 2.1 JP).
Mitsuhashi N et al. Nucleic Acids Res. 2009;37:D782-5. doi:10.1093/nar/gkn613.
Os arquivos derivados (frontend/anatomy/*) herdam a mesma licença (CC BY-SA 2.1 JP).

Etapas: leitura STL → fusão de vértices → decimação por agrupamento em grade →
coordenadas do palco (y para cima, z anterior, x = esquerda do paciente, altura 3,69 u) →
quantização int16 → pacote por camada + manifesto JSON. Também calcula:
  • dermátomo por vértice da pele (classificação pelo osso mais próximo + níveis vertebrais);
  • marcos ósseos e trajetos dos nervos periféricos ancorados nos ossos reais
    (BodyParts3D não contém nervos periféricos: os trajetos são [PREMISSA didática]).

Uso: python3 scripts/build_anatomy.py /caminho/BodyParts3D_data  [--preview]
"""
from __future__ import annotations

import json
import math
import pathlib
import re
import sys

import numpy as np
from scipy.spatial import cKDTree

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "anatomy"
H_SCENE, FOOT_Y = 3.69, -1.95

STL_DT = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])


def read_stl(p: pathlib.Path) -> np.ndarray:
    b = p.read_bytes(); n = int.from_bytes(b[80:84], "little")
    return np.frombuffer(b, STL_DT, count=n, offset=84)["v"].reshape(-1, 3).astype(np.float64)


def cluster(P: np.ndarray, cell: float):
    """Decimação por agrupamento em grade: vértice = média da célula; remove degenerados/duplicados."""
    k = np.floor(P / cell).astype(np.int64)
    _, inv = np.unique(k, axis=0, return_inverse=True); inv = inv.reshape(-1)
    nv = inv.max() + 1
    V = np.zeros((nv, 3)); np.add.at(V, inv, P); V /= np.bincount(inv, minlength=nv)[:, None]
    F = inv.reshape(-1, 3)
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    s = np.sort(F, axis=1); _, u = np.unique(s, axis=0, return_index=True); F = F[np.sort(u)]
    used = np.unique(F); remap = -np.ones(nv, np.int64); remap[used] = np.arange(len(used))
    return V[used], remap[F]


def normals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V); [np.add.at(N, F[:, i], n) for i in range(3)]
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


# ------------------------------------------------------------------ classificação
VESSEL = re.compile(r"artery|aorta|vein|vena|cava|arterial|venous|sinus", re.I)
BRAIN = re.compile(r"gyrus|gyri|callosum|hippocamp|amygdala|insula|colliculus|fornix|ventricle|thalamus|cerebell|cerebral|medulla oblongata|pons|midbrain|nucleus|putamen|caudate|globus|pallid|chiasm|optic|habenula|mammillary|pineal|pituitar|cinereum|commissure|aqueduct|stria|choroid|septum pellucidum|forebrain|brain|internal capsule|external capsule|claustrum|lobule|precuneus|cuneus|lobe of cerebrum|uncus|optic tract|olfactory tract|mammillothalamic tract", re.I)
VISCERA = re.compile(r"heart|lung|liver|kidney|stomach|esophagus|trachea|bronch|spleen|pancreas|bladder|intestin|colon|duoden|jejun|ileum|cecum|appendix|rectum|gallbladder|gland|prostate|testis|epididym|ureter|urethra|larynx|pharynx|tongue|eyeball|diaphragm|ductus|duct|penis|scrotum", re.I)
BONE = re.compile(r"( bone$|vertebra$|\brib$|sacrum|coccyx|sternum|manubrium|xiphoid|clavicle|scapula$|humerus|radius$|ulna$|femur|patella$|tibia$|fibula$|mandible|maxilla$|phalanx|metacarpal|metatarsal|talus|calcaneus|cuboid|cuneiform|navicular|scaphoid|lunate|triquetr|pisiform|trapezi|capitate|hamate|hyoid|vomer|atlas|axis|ethmoid|sphenoid|cartilage|concha)", re.I)
SKIP = re.compile(r"hairs|eyebrows|central canal", re.I)


def layer_of(fid: str, name: str) -> str | None:
    if SKIP.search(name): return None
    if fid == "FMA7163": return "skin"
    if name == "ear": return "skin"
    if "intervertebral disk" in name: return "bone"
    if VESSEL.search(name): return "vessels"
    if BRAIN.search(name) and "muscle" not in name: return "organs"
    if VISCERA.search(name): return "organs"
    if BONE.search(name) and not re.search(r"tibialis|fibularis|radialis|ulnaris|muscle|ligament|tendon|membrane", name, re.I): return "bone"
    return "muscles"


CELL = {"skin": 7.0, "bone": 3.0, "organs": 3.6, "vessels": 3.2, "muscles": 6.5}
CMIN = {"skin": 7.0, "bone": 1.4, "organs": 1.8, "vessels": 1.6, "muscles": 2.5}

PT = {"femur": "fêmur", "humerus": "úmero", "tibia": "tíbia", "fibula": "fíbula", "radius": "rádio", "ulna": "ulna", "clavicle": "clavícula", "scapula": "escápula",
      "sternum": "esterno", "sacrum": "sacro", "hip bone": "osso do quadril", "patella": "patela", "skin": "pele", "liver": "fígado", "stomach": "estômago", "kidney": "rim",
      "wall of heart": "parede do coração", "lung": "pulmão", "cerebellum": "cerebelo", "mandible": "mandíbula", "gallbladder": "vesícula biliar", "appendix": "apêndice",
      "urinary bladder": "bexiga urinária", "spleen": "baço", "pancreas": "pâncreas", "tibialis anterior": "tibial anterior", "gluteus medius": "glúteo médio",
      "gluteus maximus": "glúteo máximo", "quadratus lumborum": "quadrado lombar", "soleus": "sóleo", "fibularis longus": "fibular longo", "palmaris longus": "palmar longo",
      "flexor carpi radialis": "flexor radial do carpo", "flexor carpi ulnaris": "flexor ulnar do carpo", "rectus abdominis": "reto do abdome", "biceps femoris": "bíceps femoral",
      "sartorius": "sartório", "iliotibial tract": "trato iliotibial", "descending part of trapezius": "trapézio (parte descendente)", "deltoid": "deltoide", "talus": "tálus", "calcaneus": "calcâneo"}
FEM = {"tíbia", "fíbula", "ulna", "clavícula", "escápula", "patela", "pele", "mandíbula", "vesícula biliar", "bexiga urinária", "parede do coração"}


def pt_name(n: str) -> str:
    """'right tibialis anterior' → 'tibial anterior direito'. Nomes sem tradução ficam no original (FMA, inglês)."""
    m = re.match(r"^(.*?)\b(right|left)\b\s*(.*)$", n)
    core, side = (n, None) if not m else ((m.group(1) + m.group(3)).strip(), m.group(2))
    tc = PT.get(core)
    if tc is None: return n
    if not side: return tc
    adj = ("direita" if side == "right" else "esquerda") if tc in FEM else ("direito" if side == "right" else "esquerdo")
    return f"{tc} {adj}"


# ------------------------------------------------------------------ principal
def main(src: pathlib.Path, preview: bool = False):
    names = {}
    for line in (src / "parts_list_e.txt").read_text(encoding="utf-8", errors="ignore").splitlines()[1:]:
        f = line.split("\t")
        if len(f) >= 2: names[f[0].strip()] = f[1].strip()
    files = sorted((src / "stl").glob("*.stl"))
    raw = {}
    for p in files:
        fid = p.stem; nm = names.get(fid, fid); L = layer_of(fid, nm)
        if L: raw[fid] = (nm, L, p)
    # transformação BP3D (mm; z sup; y post; x esq) → palco
    skin = read_stl(raw["FMA7163"][2])
    zmin, zmax = skin[:, 2].min(), skin[:, 2].max()
    s = H_SCENE / (zmax - zmin); cx = (skin[:, 0].min() + skin[:, 0].max()) / 2; cy = (skin[:, 1].min() + skin[:, 1].max()) / 2
    to_scene = lambda P: np.c_[(P[:, 0] - cx) * s, (P[:, 2] - zmin) * s + FOOT_Y, -(P[:, 1] - cy) * s]
    del skin
    parts, mesh = [], {}
    for fid, (nm, L, p) in raw.items():
        P = read_stl(p)
        diag = np.linalg.norm(P.max(0) - P.min(0))
        cell = max(CMIN[L], min(CELL[L], diag / 18))
        V, F = cluster(P, cell)
        if len(F) < 4: continue
        V = to_scene(V); mesh[fid] = (V, F)
        parts.append({"fma": fid, "name": nm, "pt": pt_name(nm), "layer": L, "c": V.mean(0).round(4).tolist(), "nv": len(V), "nf": len(F)})
    print("partes:", len(parts), "triângulos:", sum(p["nf"] for p in parts))
    byname = {p["name"]: p["fma"] for p in parts}
    get = lambda n: mesh[byname[n]][0] if n in byname else None

    # ---------- marcos ósseos
    def axis(V):
        c = V.mean(0); u = np.linalg.svd(V - c, full_matrices=False)[2][0]; t = (V - c) @ u
        a, b = c + u * t.min(), c + u * t.max(); return (a, b) if a[1] > b[1] else (b, a)   # (proximal/superior, distal)
    LM = {}
    for side, sg in (("right", -1), ("left", 1)):
        for b in ("humerus", "radius", "ulna", "femur", "tibia", "fibula"):
            V = get(f"{side} {b}")
            if V is not None: LM[f"{b}_{side}"] = axis(V)
    vert = {}
    order = ["atlas", "axis"] + [f"{o} cervical vertebra" for o in ("third", "fourth", "fifth", "sixth", "seventh")] + \
            [f"{o} thoracic vertebra" for o in ("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth")] + \
            [f"{o} lumbar vertebra" for o in ("first", "second", "third", "fourth", "fifth")]
    labels = [f"C{i}" for i in range(1, 8)] + [f"T{i}" for i in range(1, 13)] + [f"L{i}" for i in range(1, 6)]
    for nm, lb in zip(order, labels):
        V = get(nm)
        if V is not None: vert[lb] = V
    print("vértebras encontradas:", len(vert))
    canal = {lb: np.array([V[:, 0].mean(), np.median(V[:, 1]), np.percentile(V[:, 2], 40)]) for lb, V in vert.items()}
    body_c = {lb: np.array([V[:, 0].mean(), np.median(V[:, 1]), np.percentile(V[:, 2], 85)]) for lb, V in vert.items()}   # corpo vertebral (anterior)
    hw = {lb: (V[:, 0].max() - V[:, 0].min()) / 2 for lb, V in vert.items()}
    sac = get("sacrum")
    def foramen(lb, sg):
        c = canal[lb]; V = vert[lb]; h = V[:, 1].max() - V[:, 1].min()
        return np.array([c[0] + sg * hw[lb] * .45, c[1] - h * .25, (c[2] + body_c[lb][2]) / 2])
    # costelas: linha central por binagem angular
    ribs = {}
    for side, sg in (("right", -1), ("left", 1)):
        for i, o in enumerate(("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth")):
            V = get(f"{side} {o} rib")
            if V is None: continue
            cen = np.array([0, V[:, 1].mean(), V[:, 2].mean() - .02]); ang = np.arctan2(V[:, 2] - cen[2], np.abs(V[:, 0]))
            bins = np.linspace(ang.min(), ang.max(), 16); pts = []
            for a0, a1 in zip(bins[:-1], bins[1:]):
                m = (ang >= a0) & (ang <= a1)
                if m.sum() > 3: pts.append(V[m].mean(0))
            ribs[f"{side}_{i + 1}"] = np.array(pts)
    hand = {sd: get(f"{sd} third metacarpal") for sd in ("right", "left")}

    # ---------- nervos (polilinhas no palco) — [PREMISSA didática] ancorados em marcos ósseos reais
    N = []
    def add(name, pts, r, kind="nerve"):
        pts = [np.asarray(p, float) for p in pts if p is not None]
        if len(pts) >= 2: N.append({"name": name, "kind": kind, "r": r, "p": np.round(np.array(pts), 4).tolist()})
    lerp = lambda a, b, t: a + (b - a) * t
    med = get("medulla oblongata")
    medc = med.mean(0) if med is not None else canal["C1"] + [0, .08, 0]
    cord = [medc] + [canal[l] for l in labels if l in canal][:20] + [lerp(canal["L1"], canal["L2"], .5)]
    add("Medula espinal", cord, .012, "cord")
    roots = {}
    for lb in labels:
        if lb not in canal: continue
        for sd, sg in (("right", -1), ("left", 1)):
            f = foramen(lb, sg); roots[(lb, sd)] = f
            add(f"Raiz {lb} {'D' if sg < 0 else 'E'}", [canal[lb], lerp(canal[lb], f, .6), f], .004, "root")
    # raízes sacrais
    if sac is not None:
        top = sac[:, 1].max(); bot = sac[:, 1].min()
        for k in range(1, 5):
            y = top - (top - bot) * (k * .18); band = sac[np.abs(sac[:, 1] - y) < .02]
            for sd, sg in (("right", -1), ("left", 1)):
                side_pts = band[band[:, 0] * sg > 0] if len(band) else band
                if len(side_pts):
                    f = np.array([np.percentile(side_pts[:, 0], 50) * .7, y, np.percentile(side_pts[:, 2], 70)]); roots[(f"S{k}", sd)] = f
    for sd, sg in (("right", -1), ("left", 1)):
        H = LM.get(f"humerus_{sd}"); R = LM.get(f"radius_{sd}"); U = LM.get(f"ulna_{sd}"); F = LM.get(f"femur_{sd}"); Tb = LM.get(f"tibia_{sd}"); Fb = LM.get(f"fibula_{sd}")
        if H is not None and R is not None and U is not None:
            hp, hd = H; med_off = np.array([-sg * .035, 0, 0]); ant = np.array([0, 0, .03]); post = np.array([0, 0, -.03])
            ax = lerp(hp, hd, .12) + med_off * 1.3 + np.array([0, -.03, 0])
            plex = [roots.get((l, sd)) for l in ("C5", "C6", "C7", "C8", "T1")]
            plexc = np.mean([p for p in plex if p is not None], axis=0)
            mid = lerp(plexc, ax, .5) + np.array([0, .02, .03])
            for p in [p for p in plex if p is not None]: add(f"Plexo braquial {sd}", [p, lerp(p, mid, .6), mid, ax], .005)
            wrist = lerp(R[1], U[1], .5); palm = hand[sd].mean(0) if hand[sd] is not None else wrist + [0, -.12, 0]
            add(f"Nervo mediano {sd}", [ax, lerp(hp, hd, .4) + med_off + ant, lerp(hp, hd, .8) + med_off * .5 + ant, hd + ant * 1.3, lerp(lerp(R[0], U[0], .5), wrist, .4) + ant, wrist + ant * .8, palm + ant * .7], .006)
            mep = hd + med_off * 1.4 + post * 1.2
            add(f"Nervo ulnar {sd}", [ax, lerp(hp, hd, .5) + med_off * 1.2 + post * .3, mep, lerp(U[0], U[1], .4) + ant * .6, U[1] + ant * .6 + med_off * .3, palm + med_off * .8 + ant * .3], .005)
            lat = np.array([sg * .03, 0, 0])
            add(f"Nervo radial {sd}", [ax, lerp(hp, hd, .35) + post * 1.4, lerp(hp, hd, .6) + post + lat, hd + lat * 1.3 + ant * .6, lerp(R[0], R[1], .5) + lat * .8, R[1] + lat + post * .3, palm + lat * 1.2 - ant * .4], .005)
            add(f"Nervo musculocutâneo {sd}", [ax, lerp(hp, hd, .45) + ant * 1.2, hd + ant + lat, lerp(R[0], R[1], .5) + lat + ant * .5], .0035)
        if F is not None and Tb is not None and Fb is not None:
            fp, fd = F; post = np.array([0, 0, -.045]); ant = np.array([0, 0, .045])
            s1 = [roots.get((l, sd)) for l in ("L4", "L5", "S1", "S2", "S3")]
            s1 = [p for p in s1 if p is not None]
            hipj = fp + post * 1.2 + np.array([-sg * .01, -.03, 0])
            conv = np.mean(s1, axis=0) + np.array([sg * .03, -.05, -.03])
            for p in s1: add(f"Plexo sacral {sd}", [p, lerp(p, conv, .7), conv], .006)
            pop = fd + post * 1.1
            add(f"Nervo ciático {sd}", [conv, hipj, lerp(fp, fd, .35) + post, lerp(fp, fd, .7) + post, pop], .011)
            tp, td = Tb; fbp, fbd = Fb
            add(f"Nervo tibial {sd}", [pop, lerp(tp, td, .2) + post, lerp(tp, td, .6) + post * .9, td + post * .6 + np.array([-sg * .02, 0, 0]), td + np.array([0, -.08, .03])], .007)
            add(f"Nervo fibular comum {sd}", [pop, fbp + np.array([sg * .02, 0, -.01]), lerp(fbp, fbd, .25) + ant * .5, lerp(tp, td, .7) + ant * .7 + np.array([sg * .02, 0, 0]), td + ant + np.array([0, -.06, .06])], .005)
            l24 = [roots.get((l, sd)) for l in ("L2", "L3", "L4")]; l24 = [p for p in l24 if p is not None]
            ing = fp + ant * 1.6 + np.array([-sg * .02, .05, 0])
            for p in l24: add(f"Plexo lombar {sd}", [p, lerp(p, ing, .5) + np.array([0, 0, .03]), ing], .005)
            add(f"Nervo femoral {sd}", [ing, lerp(fp, fd, .2) + ant + np.array([-sg * .02, 0, 0]), lerp(fp, fd, .45) + ant * .8 + np.array([-sg * .03, 0, 0])], .006)
        for i in range(1, 12):
            rb = ribs.get(f"{sd}_{i}")
            if rb is not None and len(rb) > 3:
                add(f"Nervo intercostal T{i} {sd}", [roots.get((f"T{i}", sd))] + list(rb[::-1] + np.array([0, -.012, -.004]) if rb[0][2] > rb[-1][2] else rb + np.array([0, -.012, -.004])), .0025)
    # tronco simpático (paravertebral, anterolateral)
    for sd, sg in (("right", -1), ("left", 1)):
        ch = [body_c[l] + np.array([sg * hw[l] * .55, 0, -.01]) for l in labels if l in body_c]
        add(f"Tronco simpático {sd}", ch, .0028, "symp")
    # vago e ramo auricular
    ear = get("ear"); tra = get("trachea"); eso = get("esophagus"); hrt = get("wall of heart"); stom = get("stomach")
    for sd, sg in (("right", -1), ("left", 1)):
        jug = medc + np.array([sg * .05, -.02, .0])
        path = [medc, jug]
        if tra is not None:
            tt = tra[tra[:, 1] > np.percentile(tra[:, 1], 30)]; path += [np.array([tt[:, 0].mean() + sg * .035, np.percentile(tt[:, 1], 80), tt[:, 2].mean() - .01]), np.array([tt[:, 0].mean() + sg * .03, np.percentile(tt[:, 1], 20), tt[:, 2].mean() - .015])]
        if hrt is not None: path.append(hrt.mean(0) + np.array([sg * .05, .05, -.04]))
        if eso is not None: path.append(np.array([eso[:, 0].mean() + sg * .015, np.percentile(eso[:, 1], 10), eso[:, 2].mean()]))
        if stom is not None: path.append(stom.mean(0) + np.array([0, .02, .01]))
        add(f"Nervo vago {sd}", path, .0055, "vagus")
        if ear is not None:
            e = ear[ear[:, 0] * sg > 0]
            if len(e): add(f"Ramo auricular do vago {sd}", [jug, lerp(jug, e.mean(0), .5) + np.array([0, .01, 0]), e.mean(0) + np.array([-sg * .005, 0, .01])], .0035, "vagus")
    # trigêmeo (V1/V2/V3) — gânglio entre orelha e olho
    eye = get("eyeball")
    if ear is not None and eye is not None:
        for sd, sg in (("right", -1), ("left", 1)):
            e = ear[ear[:, 0] * sg > 0].mean(0); ey = eye[eye[:, 0] * sg > 0].mean(0) if (eye[:, 0] * sg > 0).any() else eye.mean(0)
            g = lerp(e, ey, .45) + np.array([-sg * .03, -.02, 0])
            add(f"Trigêmeo V1 {sd}", [g, ey + np.array([0, .03, .0]), ey + np.array([-sg * .01, .09, .02])], .003)
            add(f"Trigêmeo V2 {sd}", [g, ey + np.array([0, -.04, .02]), ey + np.array([-sg * .01, -.06, .05])], .003)
            add(f"Trigêmeo V3 {sd}", [g, lerp(g, ey, .3) + np.array([0, -.12, 0]), ey + np.array([-sg * .02, -.2, .05])], .003)
            add(f"Nervo facial {sd}", [e + np.array([0, -.01, -.01]), e + np.array([-sg * .0, -.04, .05]), ey + np.array([sg * .03, -.12, .02])], .0025)

    # ---------- dermátomos da pele (por osso mais próximo + níveis vertebrais)
    DERM = ["V1", "V2", "V3", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5", "S1", "S2", "S3–S5"]
    D = DERM.index
    groups = {"arm": re.compile(r"humerus|radius|ulna|carp|metacarp|phalanx of .*(finger|thumb)|scaphoid|lunate|triquetr|pisiform|trapezi|capitate|hamate|hand", re.I),
              "leg": re.compile(r"femur|patella|tibia$|fibula$|talus|calcaneus|cuboid|cuneiform|navicular|metatars|phalanx of .*(toe)|foot", re.I)}
    bp, bl = [], []
    for p in parts:
        if p["layer"] != "bone": continue
        g = "arm" if groups["arm"].search(p["name"]) else "leg" if groups["leg"].search(p["name"]) else "trunk"
        V = mesh[p["fma"]][0]; bp.append(V[::3]); bl += [g] * len(V[::3])
    bp = np.vstack(bp); bl = np.array(bl); tree = cKDTree(bp)
    SV, SF = mesh["FMA7163"]; SN = normals(SV, SF)
    _, idx = tree.query(SV); grp = bl[idx]
    vy = {l: canal[l][1] for l in canal}
    eyey = eye[:, 1].mean() if eye is not None else 1.5; mouthy = eyey - .12
    neck_y = vy.get("C3", 1.3); c7y = vy.get("C7", 1.15)
    derm = np.zeros(len(SV), np.uint8)
    def seg_closest(p, a, b):
        ab = b - a; t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1); return a + np.outer(t, ab) if p.ndim > 1 else a + t * ab, t
    hip_y = np.mean([LM[k][0][1] for k in ("femur_left", "femur_right") if k in LM])
    t1y = vy.get("T1", 1.1)
    for side, sg in (("left", 1), ("right", -1)):
        sel = (grp == "arm") & (np.sign(SV[:, 0]) == sg)
        H, R, U = LM.get(f"humerus_{side}"), LM.get(f"radius_{side}"), LM.get(f"ulna_{side}")
        if sel.any() and H is not None and R is not None:
            P = SV[sel]; top = H[0]; bottom = P[:, 1].min(); t = (top[1] - P[:, 1]) / (top[1] - bottom)
            fa, fb = (R[0] + U[0]) / 2, (R[1] + U[1]) / 2
            ca, _ = seg_closest(P, H[0], H[1]); cf, _ = seg_closest(P, fa, fb)
            c = np.where((t < .45)[:, None], ca, cf); d = P - c; d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
            lat, ant = d[:, 0] * sg, d[:, 2]
            out = np.where(t < .45, np.where(lat > -.3, D("C5"), np.where(t < .1, D("T2"), D("T1"))),
                  np.where(t < .8, np.where(lat > .35, D("C6"), np.where(lat < -.35, D("C8"), np.where(ant >= 0, np.where(lat > 0, D("C6"), D("C8")), D("C7")))),
                           np.where(lat > .4, D("C6"), np.where(lat < -.4, D("C8"), D("C7")))))
            derm[sel] = out
        sel = (grp == "leg") & (np.sign(SV[:, 0]) == sg)
        F, Tb = LM.get(f"femur_{side}"), LM.get(f"tibia_{side}")
        if sel.any() and F is not None and Tb is not None:
            P = SV[sel]; t = (F[0][1] - P[:, 1]) / (F[0][1] - FOOT_Y)
            cfm, _ = seg_closest(P, F[0], F[1]); ctb, _ = seg_closest(P, Tb[0], Tb[1])
            c = np.where((t < .5)[:, None], cfm, ctb); d = P - c; d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
            lat, ant = d[:, 0] * sg, d[:, 2]; foot = P[:, 1] < FOOT_Y + .09
            out = np.where(t < .48, np.where(ant < -.2, np.where((t < .1) & (lat < -.2), D("S3–S5"), D("S2")), np.where(t < .12, D("L1"), np.where(t < .3, D("L2"), D("L3")))),
                  np.where(t < .55, np.where(ant > 0, np.where(lat < 0, D("L4"), D("L3")), D("S2")),
                           np.where(ant < -.35, D("S1"), np.where(lat < -.1, D("L4"), D("L5")))))
            out = np.where(foot, np.where((lat > .45) | (P[:, 1] < FOOT_Y + .015), D("S1"), np.where(lat < -.45, D("L4"), D("L5"))), out)
            derm[sel] = out
    # cabeça e pescoço
    mand = get("mandible"); chin_y = mand[:, 1].min() if mand is not None else mouthy - .06
    mouthy = (eyey + chin_y) / 2 - .01
    head = (grp == "trunk") & ((SV[:, 1] > neck_y + .05) | ((SV[:, 1] > chin_y) & (SN[:, 2] > .15) & (np.abs(SV[:, 0]) < .12)))
    P, Nn = SV[head], SN[head]
    derm[head] = np.where(Nn[:, 2] < -.25, D("C2"), np.where(P[:, 1] > eyey + .01, D("V1"), np.where(P[:, 1] > mouthy, D("V2"), D("V3"))))
    neck = (grp == "trunk") & ~head & (SV[:, 1] <= neck_y + .05) & (SV[:, 1] > c7y + .02)
    derm[neck] = np.where(SV[neck, 1] > (neck_y + c7y) / 2, D("C3"), D("C4"))
    # tronco: frente por fração clavícula→púbis (T4 mamilo, T10 umbigo); costas por nível vertebral
    tr = (grp == "trunk") & (SV[:, 1] <= c7y + .02)
    P, Nn = SV[tr], SN[tr]
    u = (t1y - P[:, 1]) / (t1y - hip_y)
    front = np.interp(u, [0, .08, .3, .55, .75, .9, 1.0, 1.2], [2, 2.5, 4, 7, 10, 12, 13, 14])     # 13 ≈ L1, 14 ≈ L2
    lv_y = np.array([vy[f"T{i}"] for i in range(1, 13)] + [vy[f"L{i}"] for i in range(1, 6)])
    lv_n = np.arange(1, 18)
    back = np.interp(-P[:, 1], -lv_y, lv_n)                                                          # 13..17 = L1..L5
    w = np.clip((Nn[:, 2] + .3) / .6, 0, 1); lvl = back * (1 - w) + front * w
    out = []
    for L_, yy, an in zip(lvl, P[:, 1], Nn[:, 2]):
        L_ = int(round(L_))
        if L_ <= 12: out.append(D("T" + str(max(2, L_))))
        elif yy < hip_y - .02 and an < 0: out.append(D("S3–S5") if yy < hip_y - .12 else D("S2") if False else D("S3–S5"))
        elif L_ == 13: out.append(D("L1"))
        else: out.append(D("L1") if an > 0 else D("L" + str(min(5, L_ - 12))) if L_ - 12 <= 3 else D("S2"))
    derm[tr] = out

    # ---------- exportação: pacote binário por camada (int16 quantizado + índices uint32)
    OUT.mkdir(parents=True, exist_ok=True)
    allV = np.vstack([mesh[p["fma"]][0] for p in parts]); lo = allV.min(0); hi = allV.max(0); span = hi - lo
    q = lambda V: np.round((V - lo) / span * 65534 - 32767).astype(np.int16)
    man = {"source": "BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP — Mitsuhashi N et al. Nucleic Acids Res. 2009;37:D782-5",
           "license": "CC BY-SA 2.1 JP (dados derivados)", "mm_per_unit": round(1 / s, 3), "lo": lo.round(5).tolist(), "span": span.round(5).tolist(), "layers": {}, "derm": DERM}
    for L in ("skin", "bone", "organs", "vessels", "muscles"):
        lp = [p for p in parts if p["layer"] == L]
        buf = bytearray(); meta = []
        for p in lp:
            V, F = mesh[p["fma"]]
            vo = len(buf); buf += q(V).tobytes(); pad = (-len(buf)) % 4; buf += b"\0" * pad
            io = len(buf); buf += F.astype(np.uint32).tobytes()
            m = {"fma": p["fma"], "name": p["name"], "pt": p["pt"], "c": p["c"], "vo": vo, "nv": len(V), "io": io, "ni": int(F.size)}
            if p["fma"] == "FMA7163":
                do = len(buf); buf += derm.tobytes(); buf += b"\0" * ((-len(buf)) % 4); m["do"] = do
            meta.append(m)
        (OUT / f"{L}.bin").write_bytes(bytes(buf))
        man["layers"][L] = {"file": f"anatomy/{L}.bin", "bytes": len(buf), "parts": meta}
        print(f"{L:8s} {len(lp):4d} partes · {len(buf) / 1e6:6.2f} MB")
    # hotspots a partir de marcos
    def skin_near(pt):
        d, k = cKDTree(SV).query(pt); return SV[k] + SN[k] * .01
    hs = {}
    if "L5" in canal: hs["L5S1"] = skin_near(canal["L5"] + np.array([-.08, -.06, -.3])).tolist()
    if ear is not None: hs["ear"] = (ear[ear[:, 0] < 0].mean(0) + np.array([-.01, 0, .01])).tolist()
    if eye is not None: hs["trigeminal"] = skin_near(eye[eye[:, 0] < 0].mean(0) + np.array([0, -.06, .06])).tolist()
    if "radius_right" in LM: hs["median"] = skin_near(lerp(*LM["radius_right"], .55) + np.array([.02, 0, .06])).tolist()
    if "T5" in canal: hs["visceral"] = skin_near(canal["T5"] + np.array([.1, -.05, .4])).tolist()
    if "tibia_right" in LM: hs["acupoint"] = skin_near(lerp(*LM["tibia_right"], .12) + np.array([-.04, 0, .06])).tolist()
    man["hotspots"] = {k: np.round(v, 4).tolist() for k, v in hs.items()}
    man["reflex"] = reflex_points(get, LM, SV, SN, derm, DERM, N, lerp)
    man["nerves"] = N
    man["landmarks"] = {"vertebrae": {k: np.round(v, 4).tolist() for k, v in canal.items()}}
    (OUT / "anatomy.json").write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (OUT / "LICENSE.txt").write_text("Arquivos derivados de BodyParts3D, © The Database Center for Life Science,\nlicenciados sob Creative Commons Attribution-Share Alike 2.1 Japan\n(https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).\nCite: Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure\ndatabase for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5. doi:10.1093/nar/gkn613\nTrajetos dos nervos periféricos: construídos pelo axon a partir de marcos ósseos (premissa didática).\n", encoding="utf-8")
    print("nervos:", len(N), "· hotspots:", list(hs))
    if preview:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        fig, ax = plt.subplots(1, 2, figsize=(12, 12), facecolor="#0b1a20")
        for a, (i, j) in zip(ax, ((0, 1), (2, 1))):
            a.set_facecolor("#0b1a20"); a.set_aspect("equal"); a.axis("off")
            a.scatter(SV[::4, i], SV[::4, j], s=.2, c="#7fd6e0", alpha=.15)
            for p in parts:
                if p["layer"] == "bone": V = mesh[p["fma"]][0]; a.scatter(V[::2, i], V[::2, j], s=.15, c="#e9e0c8", alpha=.5)
            for n in N:
                P = np.array(n["p"]); a.plot(P[:, i], P[:, j], lw=1.2 if n["r"] > .005 else .6, c={"nerve": "#ffc65c", "root": "#ffe08a", "cord": "#fff", "vagus": "#5ab8ff", "symp": "#6ee7a8"}[n["kind"]])
            for k, v in hs.items(): a.plot(v[i], v[j], "o", c="#ff5fa2", ms=6)
        fig.savefig("/tmp/anatomy_preview.png", dpi=110, bbox_inches="tight")
        # pele colorida por dermátomo (frente)
        fig, ax = plt.subplots(1, 2, figsize=(12, 12), facecolor="white")
        m = SN[:, 2] > 0
        ax[0].scatter(SV[m, 0], SV[m, 1], s=.6, c=derm[m], cmap="tab20"); ax[0].set_aspect("equal"); ax[0].axis("off"); ax[0].set_title("frente")
        m = SN[:, 2] < 0
        ax[1].scatter(SV[m, 0], SV[m, 1], s=.6, c=derm[m], cmap="tab20"); ax[1].set_aspect("equal"); ax[1].axis("off"); ax[1].set_title("costas")
        fig.savefig("/tmp/derm_preview.png", dpi=90, bbox_inches="tight")


# ------------------------------------------------------------------ pontos reflexos (acupontos, auriculares, pontos-gatilho, zonas de Head)
REFX = {
    "acu": ("Acuponto", "LITERATURA", "WHO Standard Acupuncture Point Locations in the Western Pacific Region. Manila: WHO WPRO; 2008."),
    "aur": ("Ponto auricular", "LITERATURA", "Peuker ET, Filler TJ. The nerve supply of the human auricle. Clin Anat. 2002;15(1):35-7."),
    "tp": ("Ponto-gatilho miofascial", "LITERATURA", "Simons DG, Travell JG, Simons LS. Myofascial Pain and Dysfunction: The Trigger Point Manual. 2nd ed. Baltimore: Williams & Wilkins; 1999."),
    "head": ("Zona de Head (dor visceral referida)", "LITERATURA", "Head H. On disturbances of sensation with especial reference to the pain of visceral disease. Brain. 1893;16:1-133."),
}


def reflex_points(get, LM, SV, SN, derm, DERM, N, lerp):
    tree = cKDTree(SV)
    nerve_names = {n["name"] for n in N}
    def snap(anchor, direction):
        d = np.asarray(direction, float); d /= np.linalg.norm(d)
        idx = tree.query_ball_point(anchor, .18)
        if not idx: _, k = tree.query(anchor); idx = [k]
        idx = np.array(idx); v = SV[idx] - anchor; dist = np.linalg.norm(v, axis=1) + 1e-9
        score = (v @ d) / dist - dist * 2 + (SN[idx] @ d) * .5
        k = idx[np.argmax(score)]; return SV[k], SN[k], DERM[derm[k]]
    def c(name):
        V = get(name); return None if V is None else V.mean(0)
    out = []
    def add(pid, name, cat, anchor, direction, nerve=None, muscles=(), organs=(), refers="", note="", tcm=None):
        if anchor is None: return
        p, n, dcode = snap(np.asarray(anchor, float), direction)
        out.append({"id": pid, "name": name, "cat": cat, "p": np.round(p + n * .004, 4).tolist(), "n": np.round(n, 3).tolist(), "derm": dcode,
                    "nerve": nerve if nerve in nerve_names else None, "nerveLabel": nerve or "—", "muscles": list(muscles), "organs": list(organs),
                    "refers": refers, "note": note, "tcm": tcm, "tag": REFX[cat][1], "ref": REFX[cat][2]})
    R = {k: LM.get(f"{k}_right") for k in ("humerus", "radius", "ulna", "femur", "tibia", "fibula")}
    # acupontos (lado direito do paciente; x < 0)
    m2 = get("right second metacarpal bone")
    if m2 is not None: add("LI4", "LI4 · Hegu", "acu", m2.mean(0) + [-.012, 0, -.01], [-.3, 0, -1], "Nervo radial right", ["right first metacarpal bone"], [], "", "Ramo superficial do nervo radial; 1º interósseo dorsal.", "Intestino grosso")
    if R["radius"] is not None and R["ulna"] is not None:
        w = lerp(R["radius"][1], R["ulna"][1], .5); e = lerp(R["radius"][0], R["ulna"][0], .5)
        add("PC6", "PC6 · Neiguan", "acu", lerp(w, e, .17), [0, 0, 1], "Nervo mediano right", ["right palmaris longus", "right flexor carpi radialis"], [], "", "Entre os tendões do palmar longo e do flexor radial do carpo, sobre o nervo mediano.", "Pericárdio")
        add("HT7", "HT7 · Shenmen", "acu", R["ulna"][1] + [.005, .01, .02], [.2, 0, 1], "Nervo ulnar right", ["right flexor carpi ulnaris"], [], "", "Prega do punho, lado ulnar, radial ao flexor ulnar do carpo.", "Coração")
    if R["tibia"] is not None:
        tp, td = R["tibia"]
        add("ST36", "ST36 · Zusanli", "acu", lerp(tp, td, .18) + [-.03, 0, .01], [-.5, 0, 1], "Nervo fibular comum right", ["right tibialis anterior"], [], "", "3 cun abaixo da patela, um dedo lateral à crista tibial; ramo profundo do fibular.", "Estômago")
        add("SP6", "SP6 · Sanyinjiao", "acu", lerp(tp, td, .8) + [.02, 0, -.005], [1, 0, -.2], "Nervo tibial right", ["right soleus", "right flexor digitorum longus"], [], "", "3 cun acima do maléolo medial, atrás da borda medial da tíbia.", "Baço-pâncreas")
    if R["fibula"] is not None:
        add("GB34", "GB34 · Yanglingquan", "acu", lerp(*R["fibula"], .08) + [-.01, 0, .02], [-.6, 0, .8], "Nervo fibular comum right", ["right fibularis longus"], [], "", "Anterior e inferior à cabeça da fíbula, sobre o nervo fibular comum.", "Vesícula biliar")
    m1, m2f = get("right first metatarsal bone"), get("right second metatarsal bone")
    if m1 is not None and m2f is not None:
        a = (m1[m1[:, 2].argmin()] + m2f[m2f[:, 2].argmin()]) / 2
        add("LR3", "LR3 · Taichong", "acu", a + [0, .01, .02], [0, 1, .4], "Nervo fibular comum right", ["right extensor digitorum longus"], [], "", "Dorso do pé, entre o 1º e o 2º metatarsos (ramo profundo do fibular).", "Fígado")
    if R["femur"] is not None:
        add("BL40", "BL40 · Weizhong", "acu", R["femur"][1] + [0, -.02, -.04], [0, 0, -1], "Nervo tibial right", ["medial head of right gastrocnemius", "lateral head of right gastrocnemius"], [], "", "Centro da fossa poplítea, sobre o nervo tibial.", "Bexiga")
    sk = get("frontal bone")
    if sk is not None:
        top = SV[SV[:, 1].argmax()]
        add("GV20", "GV20 · Baihui", "acu", top - [0, .03, 0], [0, 1, 0], "Trigêmeo V1 right", [], [], "", "Vértice do crânio, na linha média.", "Vaso Governador")
    st = c("stomach")
    if st is not None: add("CV12", "CV12 · Zhongwan", "acu", [0, st[1] + .01, st[2]], [0, 0, 1], None, ["right rectus abdominis"], ["stomach"], "", "Linha média, entre o processo xifoide e o umbigo.", "Estômago")
    # auriculares
    ear = get("ear")
    if ear is not None:
        e = ear[ear[:, 0] < 0]
        if len(e):
            ec = e.mean(0)
            add("CYMBA", "Cymba conchae (ABVN)", "aur", ec + [.004, .006, .004], [-1, 0, .3], "Ramo auricular do vago right", [], ["wall of heart"], "", "Inervação 100 % pelo ramo auricular do vago: alvo da taVNS.", None)
            add("LOBULO", "Lóbulo (controle sham)", "aur", e[e[:, 1].argmin()], [-1, -.3, .2], None, [], [], "", "Sem ABVN (nervo auricular magno, C2–C3): local de estimulação simulada.", None)
    # pontos-gatilho miofasciais
    tz = c("descending part of right trapezius")
    if tz is not None: add("TRAP", "Trapézio superior (TrP1)", "tp", tz + [0, .02, -.02], [0, .4, -1], None, ["descending part of right trapezius"], [], "Têmpora, ângulo da mandíbula e região posterolateral do pescoço", "Inervação motora pelo nervo acessório (XI), não modelado.")
    gm = c("right gluteus medius")
    if gm is not None: add("GLUTMED", "Glúteo médio (TrP1)", "tp", gm, [-.5, 0, -1], "Plexo sacral right", ["right gluteus medius"], [], "Sacro, crista ilíaca e nádega", "Nervo glúteo superior (L4–S1).")
    ql = c("right quadratus lumborum")
    if ql is not None: add("QL", "Quadrado lombar (TrP)", "tp", ql, [-.4, 0, -1], "Plexo lombar right", ["right quadratus lumborum"], [], "Crista ilíaca, quadril e nádega", "Ramos de T12–L3.")
    # zonas de Head (dor visceral referida)
    ht = c("wall of heart")
    if ht is not None: add("HEAD_HEART", "Coração → T1–T4 (tórax e face medial do braço esquerdo)", "head", ht + [.1, .05, .08], [.4, 0, 1], "Tronco simpático left", [], ["wall of heart"], "Precórdio, ombro e face medial do braço esquerdo", "Convergência viscerossomática nos segmentos T1–T4.")
    if st is not None: add("HEAD_STOM", "Estômago → T6–T9 (epigástrio)", "head", st + [.03, 0, .05], [0, 0, 1], "Tronco simpático left", [], ["stomach"], "Epigástrio", "Aferências viscerais pelos nervos esplâncnicos maiores.")
    gb = c("gallbladder")
    if gb is not None: add("HEAD_GB", "Vesícula biliar → T7–T9 (hipocôndrio direito)", "head", gb + [0, 0, .05], [-.3, 0, 1], "Tronco simpático right", [], ["gallbladder", "liver"], "Hipocôndrio direito e ponta da escápula direita", "")
    kd = c("right kidney")
    if kd is not None: add("HEAD_KID", "Rim → T10–L1 (flanco)", "head", kd + [-.04, 0, -.04], [-.7, 0, -.7], "Tronco simpático right", [], ["right kidney"], "Flanco e região lombar, irradiando para a virilha", "")
    ap = c("appendix")
    if ap is not None: add("HEAD_APP", "Apêndice → T10 (periumbilical, fase inicial)", "head", [0, ap[1] + .06, ap[2]], [0, 0, 1], "Tronco simpático right", [], ["appendix"], "Região periumbilical; depois fossa ilíaca direita (peritônio parietal)", "")
    SEG = {"LI4": ("C6", "C6"), "PC6": ("C6–C8", "C7"), "HT7": ("C8", "C8"), "ST36": ("L4–L5", "L5"), "SP6": ("L4", "L4"), "GB34": ("L5", "L5"), "LR3": ("L5", "L5"),
           "BL40": ("S1–S2", "S1"), "GV20": ("V1 / C2", "V1"), "CV12": ("T8", "T8"), "CYMBA": ("ABVN (vago)", None), "LOBULO": ("C2–C3", "C2"),
           "TRAP": ("pele C4 · miótomo C3–C4 + XI", "C4"), "GLUTMED": ("miótomo L4–S1", None), "QL": ("miótomo T12–L3", None),
           "HEAD_HEART": ("T1–T4", "T2"), "HEAD_STOM": ("T6–T9", "T7"), "HEAD_GB": ("T7–T9", "T8"), "HEAD_KID": ("T10–L1", "T11"), "HEAD_APP": ("T10", "T10")}
    for r in out:
        seg, d = SEG.get(r["id"], (r["derm"], r["derm"]))
        r["seg"] = seg; r["mapDerm"] = r["derm"]; r["derm"] = d or r["derm"]
    return out


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]), "--preview" in sys.argv)
