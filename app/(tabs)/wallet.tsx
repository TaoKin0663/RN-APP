import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { Colors } from "@/config/theme";

export default function Wallet() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = Colors[colorScheme ?? 'dark'];

  const handleNavigateToNewSafe = () => {
    router.push('/new-safe');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: colors.text, fontSize: 24, marginBottom: 30 }}>Wallet</Text>
        <TouchableOpacity
          onPress={handleNavigateToNewSafe}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: '600' }}>
            创建新 Safe
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}