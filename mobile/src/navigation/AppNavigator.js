import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../AuthContext";
import { C } from "../theme";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import ProductsScreen from "../screens/ProductsScreen";
import ScanScreen from "../screens/ScanScreen";
import OrdersScreen from "../screens/OrdersScreen";

const Tab = createBottomTabNavigator();
// Plain text glyphs: no extra icon package needed.
const icons = { Dashboard: "▦", Products: "▣", Scan: "◉", Orders: "☰" };

export default function AppNavigator() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View>;

  return (
    <NavigationContainer>
      {user ? (
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarActiveTintColor: C.blue,
            tabBarInactiveTintColor: C.mute,
            tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
            headerTitleStyle: { fontWeight: "700" },
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{icons[route.name]}</Text>,
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Products" component={ProductsScreen} />
          <Tab.Screen name="Scan" component={ScanScreen} />
          <Tab.Screen name="Orders" component={OrdersScreen} />
        </Tab.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}
