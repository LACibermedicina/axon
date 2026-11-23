window.CK = (() => {
  const T = THREE, st = AxonStage, E = () => st.ext();
  const w = ms => new Promise(r => setTimeout(r, ms));
  function cam(t, d, phi, th) { const c = E().cam; c.target.set(...t); c.dist = d; c.phi = phi; c.theta = th; c.goal = null; }
  const V = (...a) => new T.Vector3(...a);
  function nerve(name, t = .5) { const n = E().S.anat.nerves.find(x => x.name === name); if (!n) return null; const i = Math.min(n.p.length - 1, Math.round(t * (n.p.length - 1))); return V(...n.p[i]); }
  function part(layer, re) { const m = E().S.meshByLayer[layer]; if (!m) return null; const p = m.userData.parts.find(p => re.test(p.name)); return p ? E().centroid(m, p) : null; }
  function partName(layer, re) { const m = E().S.meshByLayer[layer]; const p = m && m.userData.parts.find(p => re.test(p.name)); return p ? p.name : null; }
  function rx(id) { const r = st.reflexPoints().find(x => x.id === id); return r ? V(...r.p) : null; }
  function derm(code, filt) { const S = E().S, mesh = S.meshByLayer.skin || S.skinMesh; const k = E().DERM.indexOf(code); let src = null;
    src = S.meshByLayer && S.meshByLayer.skin; if (!src || !src.geometry.attributes.derm) E().scene.traverse(o => { if (!src && o.isMesh && o.geometry && o.geometry.attributes.derm && o.geometry.attributes.position.count > 5000) src = o; }); src.updateMatrixWorld(true);
    if (!src) return null; const pa = src.geometry.attributes.position, da = src.geometry.attributes.derm, c = V(0, 0, 0); let n = 0;
    for (let j = 0; j < pa.count; j += 3) { if (Math.round(da.getX(j)) !== k) continue; const x = pa.getX(j), y = pa.getY(j), z = pa.getZ(j); if (filt && !filt(x, y, z)) continue; c.x += x; c.y += y; c.z += z; n++; }
    return n ? src.localToWorld(c.multiplyScalar(1 / n)) : null; }
  function labelsOf(level) { const G = E().S.groups["L" + level]; return E().S.labels.filter(L => L.group === G).map(L => ({ text: L.el.textContent, p: L.pos.clone() })); }
  function capture(W, H, anns, cm) {
    const e = E(), r = e.renderer, c = e.camera, k = e.cam, pr = r.getPixelRatio();
    if (cm) { k.target.set(...cm[0]); k.dist = cm[1]; k.phi = cm[2]; k.theta = cm[3]; k.goal = null; }
    const hid = []; (e.S.hot || []).forEach(h => { h.visible = false; hid.push(h); h.parent && h.parent.children.forEach(o => { if (o.geometry && o.geometry.type === "RingGeometry" && o.position.distanceTo(h.position) < 1e-3) { o.visible = false; hid.push(o); } }); });
    c.position.set(k.target.x + k.dist * Math.sin(k.phi) * Math.sin(k.theta), k.target.y + k.dist * Math.cos(k.phi), k.target.z + k.dist * Math.sin(k.phi) * Math.cos(k.theta)); c.lookAt(k.target);
    r.setPixelRatio(1); r.setSize(W, H, false); c.aspect = W / H; c.updateProjectionMatrix(); c.updateMatrixWorld();
    r.render(e.scene, c); const url = r.domElement.toDataURL("image/png");
    const out = (anns || []).filter(a => a.p).map(a => { const v = a.p.clone().project(c); return Object.assign({}, a, { p: undefined, x: +((v.x + 1) / 2 * W).toFixed(1), y: +((1 - v.y) / 2 * H).toFixed(1), vis: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 }); });
    hid.forEach(o => o.visible = true); r.setPixelRatio(pr); dispatchEvent(new Event("resize"));
    return { url, anns: out, dbg: { pos: c.position.toArray(), tgt: k.target.toArray(), d: k.dist, th: k.theta, parent: c.parent && c.parent.type, vo: !!c.view && c.view.enabled } };
  }
  return { w, cam, nerve, part, partName, rx, derm, labelsOf, capture, V };
})(); 1
