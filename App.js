import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AppDataProvider } from './src/context/AppDataContext';
import { EventFormProvider } from './src/context/EventFormContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <AppDataProvider>
            <EventFormProvider>
            <ThemeProvider>
              <AppNavigator />
              <StatusBar style="auto" />
            </ThemeProvider>
            </EventFormProvider>
          </AppDataProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
