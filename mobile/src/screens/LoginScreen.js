import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../AuthContext";
import { C } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try { await login(email, password); } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
      <View style={s.card}>
        <View style={s.logo}><Text style={s.logoT}>S</Text></View>
        <Text style={s.h}>Smart Inventory</Text>
        <Text style={s.sub}>Sign in to continue</Text>
        <TextInput style={s.input} placeholder="Email" accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={s.input} placeholder="Password" accessibilityLabel="Password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        {!!err && <Text style={s.err} accessibilityRole="alert">{err}</Text>}
        <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Sign in</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 20 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 22, gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  logoT: { color: "#fff", fontSize: 22, fontWeight: "700" },
  h: { fontSize: 22, fontWeight: "700", color: C.ink }, sub: { color: C.mute, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 16, color: C.ink },
  err: { color: C.red, fontWeight: "500" },
  btn: { backgroundColor: C.blue, borderRadius: 12, padding: 15, alignItems: "center", minHeight: 50, justifyContent: "center" },
  btnT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
