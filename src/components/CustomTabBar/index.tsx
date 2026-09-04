import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native'
import { styles } from './styles'
import { AntDesign, FontAwesome, Entypo } from '@expo/vector-icons';
import { themes } from "../../global/themes";

export default ({ state, navigation }: { state: any, navigation: any })=>{
    
    const go = (screenName:string)=>{
        navigation.navigate(screenName)
    }

    return (
        <View style={styles.tabArea}>
            <TouchableOpacity style={styles.tabItem} onPress={()=>go('List')}>
                <AntDesign
                    name="bars"
                    style={{opacity:state.index === 0 ? 1 : 0.3, fontSize: 32, color: themes.colors.primary}}
                />
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItemButton}>
                <View>
                    <FontAwesome 
                        name="microphone"
                        style={{fontSize: 40, color: '#fff'}}
                    />
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={()=>go('User')}>
                <FontAwesome
                    name="user"
                    style={{opacity:state.index === 1 ? 1 : 0.3, fontSize: 32, color: themes.colors.primary}} 
                />
            </TouchableOpacity>
        </View>
    )
}