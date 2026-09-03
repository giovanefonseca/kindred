import React, { useRef, Fragment, LegacyRef } from 'react';

import { View, Text, TextInput, TextInputProps, TouchableOpacity} from 'react-native';

import { styles } from './styles'
import { FontAwesome, Ionicons, MaterialIcons, Octicons } from '@expo/vector-icons';
import { themes } from '../../global/themes';

type IconComponent = React.ComponentType<React.ComponentProps<typeof MaterialIcons>> |
                     React.ComponentType<React.ComponentProps<typeof FontAwesome>> |
                     React.ComponentType<React.ComponentProps<typeof Octicons>> 

type Props = TextInputProps & {
    IconLeft?: IconComponent,
    IconRight?: IconComponent,
    IconLeftName?: string,
    IconRightName?: string,
    title?: string,
    onIconLeftPress?:() => void,
    onIconRightPress?:() => void
}

export const Input = React.forwardRef<TextInput, Props>((Props, ref) => {

    const {IconLeft, IconRight, IconLeftName, IconRightName, title, onIconLeftPress, onIconRightPress, ...rest} = Props

    const calculateSizeWidth = () =>{
        if (IconLeft && IconRight) {
            return '80%'
        } else if (IconLeft || IconRight) {
            return '90%'
        } else {
            return '100%'
        }
    }

    const calculateSizePaddingLeft = () =>{
        if (IconLeft && IconRight) {
            return 10;
        } else if (IconLeft || IconRight) {
            return 10;
        } else {
            return 0;
        }
    }

    return (
        <Fragment>
            {title&&<Text style={styles.titleInput}>{title}</Text>}
            <View>
                <View style={[styles.boxInput, {paddingLeft: calculateSizePaddingLeft()}]}>
                    {IconLeft && IconLeftName && (
                        <TouchableOpacity onPress={onIconLeftPress}>
                            <IconLeft name={IconLeftName as any} size = {20} color = {themes.colors.primary} style={styles.icon}/>
                        </TouchableOpacity>    
                    )}
                    
                    <TextInput 
                        style={[
                            styles.input, {width:calculateSizeWidth()}
                        ]}
                        {...rest}
                    />
                    
                    {IconRight && IconRightName && (
                        <TouchableOpacity onPress={onIconRightPress}>
                            <IconRight name={IconRightName as any} size = {20} color = {themes.colors.primary} style={styles.icon}/>
                        </TouchableOpacity>    
                    )}
                </View>
            </View>
        </Fragment>
    )
})