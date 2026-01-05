import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/config/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Message() {
    const { colorScheme } = useTheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View 
                style={[
                    styles.header,
                    {
                        backgroundColor: colors.background,
                        paddingTop: insets.top + 12,
                    }
                ]}
            >
                <Text style={[styles.headerTitle, { color: colors.text }]}>消息</Text>
            </View>
            <ScrollView 
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 92 }]}
                showsVerticalScrollIndicator={false}
            >
                <Text style={{ color: colors.text }}>Message</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
    },
});