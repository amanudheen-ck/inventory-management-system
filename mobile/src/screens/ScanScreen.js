import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useIsFocused } from "@react-navigation/native";
import { api } from "../api";
import { C, inr, stockTone } from "../theme";

const TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"];

export default function ScanScreen() {
  const focused = useIsFocused();
  const [perm, askPerm] = useCameraPermissions();
  const [mode, setMode] = useState("stock"); // stock = adjust stock, sale = build an order
  const [locked, setLocked] = useState(false);
  const [product, setProduct] = useState(null);
  const [delta, setDelta] = useState(1);
  const [cart, setCart] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");

  useEffect(() => { api.get("/customers?limit=50").then((r) => setCustomers(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!q.trim()) { setHits([]); return; }
    const t = setTimeout(() => api.get("/products?limit=5&search=" + encodeURIComponent(q)).then((r) => setHits(r.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);

  const flash = (text, ok) => setMsg({ text, ok });
  const unlockSoon = () => setTimeout(() => setLocked(false), 1200);

  const addToCart = (p) => {
    if (p.quantity <= 0) return flash(`${p.name} is out of stock`, false);
    setCart((c) => c.some((i) => i.id === p._id)
      ? c.map((i) => (i.id === p._id ? { ...i, qty: Math.min(i.qty + 1, p.quantity) } : i))
      : [...c, { id: p._id, name: p.name, price: p.price, stock: p.quantity, qty: 1 }]);
    flash(`Added ${p.name}`, true);
  };

  const onScan = async ({ data }) => {
    if (locked) return;
    setLocked(true);
    setMsg(null);
    try {
      const p = (await api.get("/products/barcode/" + encodeURIComponent(data))).data;
      if (mode === "stock") { setProduct(p); setDelta(1); return; } // stays locked until confirmed or cancelled
      addToCart(p);
    } catch (e) { flash(e.message, false); }
    unlockSoon();
  };

  const confirmStock = async () => {
    setBusy(true);
    try {
      await api.post(delta > 0 ? "/inventory/in" : "/inventory/out", { productId: product._id, quantity: Math.abs(delta), reason: "Mobile scan" });
      flash(`${product.name}: stock ${delta > 0 ? "+" : ""}${delta}`, true);
      setProduct(null);
      unlockSoon();
    } catch (e) { flash(e.message, false); } finally { setBusy(false); }
  };

  const completeSale = async () => {
    setBusy(true);
    try {
      await api.post("/orders", { customer: customer || undefined, items: cart.map((i) => ({ productId: i.id, quantity: i.qty })) });
      flash("Sale completed", true);
      setCart([]);
      setCustomer("");
    } catch (e) { flash(e.message, false); } finally { setBusy(false); }
  };

  if (!perm) return <View style={s.center}><ActivityIndicator color={C.blue} /></View>;
  if (!perm.granted) {
    return (
      <View style={s.center}>
        <Text style={s.h}>Camera access needed</Text>
        <Text style={s.mute}>Allow the camera to scan product barcodes.</Text>
        <TouchableOpacity style={s.btn} onPress={askPerm}><Text style={s.btnT}>Allow camera</Text></TouchableOpacity>
      </View>
    );
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.seg}>
        {[["stock", "Adjust stock"], ["sale", "New sale"]].map(([v, l]) => (
          <TouchableOpacity key={v} style={[s.segBtn, mode === v && s.segOn]} onPress={() => { setMode(v); setProduct(null); setLocked(false); setMsg(null); }}>
            <Text style={[s.segT, mode === v && { color: "#1D4ED8" }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.cam}>
        {focused && <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: TYPES }} onBarcodeScanned={onScan} />}
        <View style={s.frame} pointerEvents="none" />
      </View>

      {msg && <Text style={[s.msg, { color: msg.ok ? C.green : C.red, backgroundColor: msg.ok ? C.greenBg : C.redBg }]} accessibilityRole="alert">{msg.text}</Text>}

      {mode === "stock" && !product && <Text style={s.mute}>Point the camera at a barcode to adjust that product's stock.</Text>}
      {mode === "stock" && product && (() => {
        const [label, fg, bg] = stockTone(product);
        return (
          <View style={s.card}>
            <Text style={s.h}>{product.name}</Text>
            <Text style={s.mute}>{product.sku}{product.location ? ` · ${product.location}` : ""}</Text>
            <View style={s.between}><Text style={s.mute}>Current stock: <Text style={{ fontWeight: "700", color: C.ink }}>{product.quantity}</Text></Text><Text style={[s.badge, { color: fg, backgroundColor: bg }]}>{label}</Text></View>
            <View style={s.stepper}>
              <TouchableOpacity style={s.step} accessibilityLabel="Decrease" onPress={() => setDelta(delta - 1)}><Text style={s.stepT}>−</Text></TouchableOpacity>
              <Text style={s.delta}>{delta > 0 ? `+${delta}` : delta}</Text>
              <TouchableOpacity style={s.step} accessibilityLabel="Increase" onPress={() => setDelta(delta + 1)}><Text style={s.stepT}>+</Text></TouchableOpacity>
            </View>
            <View style={s.between}>
              <TouchableOpacity style={s.ghost} onPress={() => { setProduct(null); setLocked(false); }}><Text style={s.ghostT}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, (delta === 0 || busy) && { opacity: 0.5 }]} disabled={delta === 0 || busy} onPress={confirmStock}><Text style={s.btnT}>Confirm</Text></TouchableOpacity>
            </View>
          </View>
        );
      })()}

      {mode === "sale" && (
        <View style={s.card}>
          <Text style={s.h}>Add by search</Text>
          <TextInput style={s.input} placeholder="Search product name or SKU" accessibilityLabel="Search products to add" value={q} onChangeText={setQ} />
          {hits.map((p) => (
            <TouchableOpacity key={p._id} style={s.hit} onPress={() => { addToCart(p); setQ(""); setHits([]); }}>
              <Text style={s.name}>{p.name}</Text><Text style={s.mute}>{inr(p.price)} · {p.quantity} in stock</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.h}>Customer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[{ _id: "", name: "Walk-in" }, ...customers].map((c) => (
              <TouchableOpacity key={c._id || "walkin"} style={[s.pill, customer === c._id && s.pillOn]} onPress={() => setCustomer(c._id)}>
                <Text style={[s.pillT, customer === c._id && { color: "#1D4ED8" }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={s.h}>Cart</Text>
          {cart.length === 0 && <Text style={s.mute}>Scan a barcode or search above to add products.</Text>}
          {cart.map((i) => (
            <View key={i.id} style={s.line}>
              <View style={{ flex: 1 }}><Text style={s.name}>{i.name}</Text><Text style={s.mute}>{inr(i.price)} · {i.stock} in stock</Text></View>
              <TouchableOpacity style={s.mini} accessibilityLabel={`Remove one ${i.name}`} onPress={() => setCart(cart.flatMap((c) => (c.id !== i.id ? [c] : c.qty > 1 ? [{ ...c, qty: c.qty - 1 }] : [])))}><Text style={s.stepT}>−</Text></TouchableOpacity>
              <Text style={s.qtyT}>{i.qty}</Text>
              <TouchableOpacity style={s.mini} accessibilityLabel={`Add one ${i.name}`} onPress={() => setCart(cart.map((c) => (c.id === i.id ? { ...c, qty: Math.min(c.qty + 1, c.stock) } : c)))}><Text style={s.stepT}>+</Text></TouchableOpacity>
            </View>
          ))}
          {cart.length > 0 && (
            <>
              <View style={s.between}><Text style={s.h}>Total</Text><Text style={s.h}>{inr(total)}</Text></View>
              <TouchableOpacity style={[s.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={completeSale}><Text style={s.btnT}>Complete sale</Text></TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  h: { fontSize: 16, fontWeight: "700", color: C.ink }, mute: { color: C.mute, fontSize: 13 }, name: { fontWeight: "600", color: C.ink },
  seg: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: 12, padding: 3 }, segBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center" }, segOn: { backgroundColor: "#fff" }, segT: { fontWeight: "700", color: C.mute },
  cam: { height: 260, borderRadius: 16, overflow: "hidden", backgroundColor: "#0F172A", alignItems: "center", justifyContent: "center" },
  frame: { width: "70%", height: 120, borderWidth: 3, borderColor: "#60A5FA", borderRadius: 14 },
  msg: { fontWeight: "600", padding: 12, borderRadius: 12, overflow: "hidden" },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, gap: 10 }, between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  badge: { fontSize: 11, fontWeight: "700", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 }, step: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  stepT: { fontSize: 24, fontWeight: "700", color: "#1D4ED8" }, delta: { fontSize: 34, fontWeight: "700", color: C.ink, minWidth: 80, textAlign: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  mini: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" }, qtyT: { fontWeight: "700", minWidth: 24, textAlign: "center", color: C.ink },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 15, color: C.ink },
  hit: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pill: { borderRadius: 99, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" }, pillOn: { backgroundColor: C.tint, borderColor: "#BFDBFE" }, pillT: { fontWeight: "600", color: C.mute },
  btn: { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center", minHeight: 48, justifyContent: "center" }, btnT: { color: "#fff", fontWeight: "700", fontSize: 15 },
  ghost: { borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 22, minHeight: 48, justifyContent: "center" }, ghostT: { fontWeight: "700", color: C.mute },
});
