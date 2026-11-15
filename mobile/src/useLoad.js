import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

// Loads data every time the screen comes into focus, so tabs always show fresh stock.
export default function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(""); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, error, loading, reload };
}
