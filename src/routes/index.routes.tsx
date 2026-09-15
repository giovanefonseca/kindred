import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import Login from "../pages/login";
import BottomRoutes from "./bottom.routes";
import DynamicAction from "../pages/dynamicAction";

export default function Routes() {
    const Stack = createStackNavigator()

    return (
        <Stack.Navigator
            id="rootStack"
            initialRouteName="Login"
            screenOptions={{
                headerShown:false,
                cardStyle:{
                    backgroundColor: "#FFF"
                }
            }}
        >

            <Stack.Screen
                name="Login"
                component={Login}
            />

            <Stack.Screen
                name="BottomRoutes"
                component={BottomRoutes}
            />

            <Stack.Screen
                name="DynamicAction"
                component={DynamicAction}
            />
            {/* <Stack.Screen
                name="Login"
                component={Login}
            /> */}

        </Stack.Navigator>
    )
}