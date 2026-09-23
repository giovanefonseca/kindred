import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import Login from "../pages/login";
import BottomRoutes from "./bottom.routes";
import DynamicAction from "../pages/dynamicAction";
import NotesMenu from "../pages/homepage/meuPainel/notesMenu/notesMenu";
import { RemindersMenu } from "../pages/homepage/meuPainel/remindersMenu/remindersMenu";
import { ViewReminders } from "../pages/homepage/meuPainel/remindersMenu/viewReminders";
import { DeleteReminders } from "../pages/homepage/meuPainel/remindersMenu/deleteReminders";
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

            <Stack.Screen name="RemindersMenu" component={RemindersMenu} />
            <Stack.Screen name="ViewReminders" component={ViewReminders} />
            <Stack.Screen name="DeleteReminders" component={DeleteReminders} />

        </Stack.Navigator>
    )
}