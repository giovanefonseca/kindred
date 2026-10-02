import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import Login from "../pages/login";
import BottomRoutes from "./bottom.routes";
import Register from "../pages/register";

import { RemindersMenu } from "../pages/homepage/meuPainel/remindersMenu/remindersMenu";
import { ViewReminders } from "../pages/homepage/meuPainel/remindersMenu/viewReminders";
import { GenerateNotesReports } from "../pages/homepage/meuPainel/notesMenu/generateNotesReports";
import { DeleteReminders } from "../pages/homepage/meuPainel/remindersMenu/deleteReminders";
import { SetReminderView } from "../pages/homepage/meuPainel/remindersMenu/SetReminderView";

import NotesMenu from "../pages/homepage/meuPainel/notesMenu/notesMenu";
import { DeleteNotes } from "../pages/homepage/meuPainel/notesMenu/deleteNotes";
import { ViewNotes } from "../pages/homepage/meuPainel/notesMenu/viewNotes";
import { GenerateRemindersReports } from "../pages/homepage/meuPainel/remindersMenu/generateRemindersReports";
import { NewNoteView } from "../pages/homepage/meuPainel/notesMenu/NewNoteView";

import { EmergencyCallView } from "../pages/homepage/meuPainel/emergencyMenu/EmergencyCallView";
import { EmergencyFormView } from "../pages/homepage/meuPainel/emergencyMenu/EmergencyFormView";

import { WaterTrackingView } from "../pages/homepage/meuPainel/waterTrackingMenu/WaterTrackingView";

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
            

            <Stack.Screen name="EmergencyCallView" component={EmergencyCallView} />
            <Stack.Screen name="EmergencyFormView" component={EmergencyFormView} />
            
            <Stack.Screen name="NotesMenu" component={NotesMenu} />
            <Stack.Screen name="NewNoteView" component={NewNoteView} />
            <Stack.Screen name="ViewNotes" component={ViewNotes} />
            <Stack.Screen name="GenerateNotesReports" component={GenerateNotesReports} />
            <Stack.Screen name="DeleteNotes" component={DeleteNotes} />

            <Stack.Screen name="RemindersMenu" component={RemindersMenu} />
            <Stack.Screen name="SetReminderView" component={SetReminderView} />
            <Stack.Screen name="ViewReminders" component={ViewReminders} />
            <Stack.Screen name="GenerateRemindersReports" component={GenerateRemindersReports} />
            <Stack.Screen name="DeleteReminders" component={DeleteReminders} />

            <Stack.Screen name="WaterTrackingView" component={WaterTrackingView} />


        </Stack.Navigator>
    )
}