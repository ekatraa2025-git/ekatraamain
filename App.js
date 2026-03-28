import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { AppDataProvider } from './src/context/AppDataContext';
import { EventFormProvider } from './src/context/EventFormContext';
import { LocaleProvider } from './src/context/LocaleContext';
import TermsAcceptanceGate from './src/components/TermsAcceptanceGate';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocaleProvider>
        <CartProvider>
          <AppDataProvider>
            <EventFormProvider>
            <ThemeProvider>
              <TermsAcceptanceGate>
                <AppNavigator />
              </TermsAcceptanceGate>
              <StatusBar style="auto" />
            </ThemeProvider>
            </EventFormProvider>
          </AppDataProvider>
        </CartProvider>
        </LocaleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
