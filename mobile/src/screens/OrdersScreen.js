import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import useLoad from "../useLoad";
import { C, inr } from "../theme";

const tone = { completed: [C.green, C.greenBg], cancelled: [C.red, C.redBg], paid: [C.green, C.greenBg], unpaid: [C.amber, C.amberBg], partial: ["#1D4ED8", C.tint] };
const Chip = ({ v }) => <Text style={[s.chip, { color: tone[v][0], backgroundColor: tone[v][1] }]}>{v}</Text>;

export default function OrdersScreen() {
  const { data, error, loading, reload } = useLoad(() => api.get("/orders?limit=30").then((r) => r.data), []);

  return (
    <View style={s.page}>
      {!!error && <Text style={s.err}>{error}</Text>}
      <FlatList
        data={data || []}
        keyExtractor={(o) => o._id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={!loading && <Text style={{ color: C.mute }}>No orders yet. Make a sale from the Scan tab.</Text>}
        renderItem={({ item: o }) => (
          <View style={s.card}>
            <View style={s.top}><Text style={s.no}>{o.orderNumber}</Text><Text style={s.total}>{inr(o.total)}</Text></View>
            <Text style={s.mute}>{o.customer?.name || "Walk-in customer"} · {new Date(o.createdAt).toLocaleDateString()}</Text>
            <View style={s.chips}><Chip v={o.status} /><Chip v={o.paymentStatus} /></View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, err: { color: C.red, padding: 16 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 14, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between" }, no: { fontWeight: "700", color: C.ink }, total: { fontWeight: "700", color: C.ink }, mute: { color: C.mute, fontSize: 12 },
  chips: { flexDirection: "row", gap: 8, marginTop: 4 }, chip: { fontSize: 11, fontWeight: "700", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden", textTransform: "capitalize" },
});
