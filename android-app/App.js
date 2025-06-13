import { StatusBar } from 'expo-status-bar';
import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';

const WEB_APP_URL = 'https://todo-events.com';

export default function App() {
  const webviewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleNavigation = (event) => {
    if (event.url.includes('/subscribe')) {
      Linking.openURL(event.url);
      return false;
    }
    return true;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webviewRef.current?.reload();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {loading && (
        <View style={[styles.loading, { backgroundColor: isDark ? '#000' : '#fff' }] }>
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
        </View>
      )}
      <WebView
        ref={webviewRef}
        source={{ uri: WEB_APP_URL }}
        onShouldStartLoadWithRequest={handleNavigation}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          setRefreshing(false);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? '#fff' : '#000']}
            tintColor={isDark ? '#fff' : '#000'}
          />
        }
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
