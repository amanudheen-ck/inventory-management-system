import { useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api } from "../api";
import useLoad from "../useLoad";
import { C, inr, stockTone } from "../theme";

export default function ProductsScreen() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [low, setLow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDq(q), 300); return () => clearTimeout(t); }, [q]);

  const { data, error, loading, reload } = useLoad(
    () => api.get(`/products?limit=50&search=${encodeURIComponent(dq)}${low ? "&lowStock=true" : ""}`).then((r) => r.data),
    [dq, low]
  );

  return (
    <View style={s.page}>
      <TextInput style={s.search} placeholder="Search name, SKU, barcode or location" accessibilityLabel="Search products" value={q} onChangeText={setQ} />
      <View style={s.chips}>
        {[[false, "All"], [true, "Low / out of stock"]].map(([v, l]) => (
          <TouchableOpacity key={l} style={[s.chipBtn, low === v && s.chipOn]} onPress={() => setLow(v)}><Text style={[s.chipT, low === v && { color: "#1D4ED8" }]}>{l}</Text></TouchableOpacity>
        ))}
      </View>
      {!!error && <Text style={s.err}>{error}</Text>}
      <FlatList
        data={data || []}
        keyExtractor={(p) => p._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={!loading && <Text style={s.mute}>No products found.</Text>}
        renderItem={({ item: p }) => {
          const [label, fg, bg] = stockTone(p);
          return (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.mute}>{p.sku}{p.warehouse ? ` · ${p.warehouse.code}` : ""}{p.location ? ` · ${p.location}` : ""}</Text>
                <Text style={s.price}>{inr(p.price)}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={[s.qty, { color: fg }]}>{p.quantity}</Text>
                <Text style={[s.badge, { color: fg, backgroundColor: bg }]}>{label}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, err: { color: C.red, paddingHorizontal: 16 }, mute: { color: C.mute, fontSize: 12 },
  search: { margin: 16, marginBottom: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 13, fontSize: 15 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  chipBtn: { borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8 }, chipOn: { backgroundColor: C.tint, borderColor: "#BFDBFE" }, chipT: { fontWeight: "600", color: C.mute },
  card: { flexDirection: "row", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, gap: 10 },
  name: { fontSize: 15, fontWeight: "700", color: C.ink }, price: { fontWeight: "600", color: C.ink, marginTop: 4 },
  qty: { fontSize: 22, fontWeight: "700" }, badge: { fontSize: 11, fontWeight: "700", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
});
