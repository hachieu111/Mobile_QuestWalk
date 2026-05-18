import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import MainTabNavigator from './MainTabNavigator';
import MyVouchersScreen from '../screens/MyVouchersScreen';
import ARCheckInScreen from '../screens/ARCheckInScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ChatScreen from '../screens/ChatScreen';
import useQuestStore from '../store/useQuestStore';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const user = useQuestStore((state) => state.user);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="MyVouchers" component={MyVouchersScreen} />
            <Stack.Screen name="ARCheckIn" component={ARCheckInScreen} options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
          </>
        ) : (
          <Stack.Screen name="LoginScreen" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
