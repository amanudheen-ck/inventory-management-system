import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import useLoad from "../useLoad";
import { C, inr } from "../theme";

const Kpi = ({ label, value, sub, color }) => (
  <View style={s.kpi}><Text style={s.mute}>{label}</Text><Text style={[s.big, color && { color }]}>{value}</Text><Text style={s.small}>{sub}</Text></View>
);

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { data: d, error, loading, reload } = useLoad(() => api.get("/dashboard").then((r) => r.data), []);
  const t = d?.totals;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 16, gap: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Text style={s.hello}>Hello, {user.name}</Text>
      {!!error && <Text style={s.err}>{error}</Text>}
      {d && (
        <>
          <View style={s.hero}><Text style={s.heroL}>Today's sales</Text><Text style={s.heroV}>{inr(d.sales.today.revenue)}</Text><Text style={s.heroL}>{d.sales.today.orders} orders</Text></View>
          <View style={s.row}>
            <Kpi label="Products" value={t.products} sub={`${t.units} units`} />
            <Kpi label="Low stock" value={t.lowStock + t.outOfStock} sub={`${t.outOfStock} out`} color={C.amber} />
          </View>
          <View style={s.card}>
            <Text style={s.h}>Needs attention</Text>
            {d.lowStockItems.length === 0 && <Text style={s.mute}>Nothing is running low.</Text>}
            {d.lowStockItems.map((p) => (
              <View key={p._id} style={s.line}><Text style={s.name}>{p.name}</Text>
                <Text style={[s.chip, p.quantity === 0 ? s.red : s.amber]}>{p.quantity === 0 ? "Out of stock" : `${p.quantity} left`}</Text></View>
            ))}
          </View>
          <View style={s.card}>
            <Text style={s.h}>Recent orders</Text>
            {d.recentOrders.length === 0 && <Text style={s.mute}>No orders yet.</Text>}
            {d.recentOrders.map((o) => (
              <View key={o._id} style={s.line}><View><Text style={s.name}>{o.orderNumber}</Text><Text style={s.small}>{o.customer?.name || "Walk-in customer"}</Text></View><Text style={s.name}>{inr(o.total)}</Text></View>
            ))}
          </View>
        </>
      )}
      <TouchableOpacity style={s.out} onPress={logout}><Text style={s.outT}>Log out</Text></TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, hello: { fontSize: 20, fontWeight: "700", color: C.ink }, err: { color: C.red },
  hero: { backgroundColor: C.blue, borderRadius: 18, padding: 20 }, heroL: { color: "#DBEAFE" }, heroV: { color: "#fff", fontSize: 34, fontWeight: "700", marginVertical: 4 },
  row: { flexDirection: "row", gap: 12 }, kpi: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14 },
  big: { fontSize: 26, fontWeight: "700", color: C.ink }, mute: { color: C.mute }, small: { color: C.mute, fontSize: 12 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16 }, h: { fontSize: 15, fontWeight: "700", color: C.ink, marginBottom: 6 },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" }, name: { fontWeight: "600", color: C.ink },
  chip: { fontSize: 12, fontWeight: "600", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden" },
  amber: { backgroundColor: C.amberBg, color: C.amber }, red: { backgroundColor: C.redBg, color: C.red },
  out: { alignSelf: "center", padding: 12 }, outT: { color: C.mute, fontWeight: "600" },
});
