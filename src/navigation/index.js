import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import Splash from '../screens/onboarding/Splash';
import Onboarding from '../screens/onboarding/Onboarding';
import Login from '../screens/auth/Login';
import Otp from '../screens/auth/Otp';
import Register from '../screens/auth/Register';
import Home from '../screens/home/Home';
import VenueDetail from '../screens/home/VenueDetail';
import ServiceDetail from '../screens/home/ServiceDetail';
import VendorsList from '../screens/home/VendorsList';
import VendorDetail from '../screens/home/VendorDetail';
import Menu from '../screens/menu/Menu';
import MyBookings from '../screens/bookings/MyBookings';
import MyProfile from '../screens/profile/MyProfile';
import MyEnquiries from '../screens/enquiries/MyEnquiries';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator 
                initialRouteName="Splash" 
                screenOptions={{ 
                    headerShown: false,
                    animation: 'fade',
                }}
            >
                {/* Onboarding Flow */}
                <Stack.Screen name="Splash" component={Splash} />
                <Stack.Screen 
                    name="Onboarding" 
                    component={Onboarding}
                    options={{ animation: 'slide_from_right' }}
                />
                
                {/* Main App - No login required to access */}
                <Stack.Screen 
                    name="Home" 
                    component={Home}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="VenueDetail" 
                    component={VenueDetail}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="ServiceDetail" 
                    component={ServiceDetail}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="VendorsList" 
                    component={VendorsList}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="VendorDetail" 
                    component={VendorDetail}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="MyBookings" 
                    component={MyBookings}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="MyProfile" 
                    component={MyProfile}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="MyEnquiries" 
                    component={MyEnquiries}
                    options={{ animation: 'slide_from_right' }}
                />
                
                {/* Auth Screens - Only shown when login is needed */}
                <Stack.Screen 
                    name="Login" 
                    component={Login}
                    options={{ 
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
                <Stack.Screen 
                    name="Otp" 
                    component={Otp}
                    options={{ animation: 'slide_from_right' }}
                />
                <Stack.Screen 
                    name="Register" 
                    component={Register}
                    options={{ animation: 'slide_from_right' }}
                />
                
                {/* Menu / Profile */}
                <Stack.Screen
                    name="Menu"
                    component={Menu}
                    options={{
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
