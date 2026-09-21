import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import Login from "../pages/login";
import BottomRoutes from "./bottom.routes";
import DynamicAction from "../pages/dynamicAction";
import NotesMenu from "../pages/homepage/meuPainel/notesMenu";
import Register from "../pages/register";

import { DeleteNotes } from "../pages/homepage/meuPainel/notesMenu/deleteNotes";
import { ViewNotes } from "../pages/homepage/meuPainel/notesMenu/viewNotes"; 

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

            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="BottomRoutes" component={BottomRoutes} />
            <Stack.Screen name="DynamicAction" component={DynamicAction} />
            
            <Stack.Screen name="NotesMenu" component={NotesMenu} />
            <Stack.Screen name="ViewNotes" component={ViewNotes} />
            <Stack.Screen name="DeleteNotes" component={DeleteNotes} />

        </Stack.Navigator>
    )
}