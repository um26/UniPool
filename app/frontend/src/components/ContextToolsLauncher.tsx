import React, { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useTheme } from "@/src/theme_context/ThemeContext";

export default function ContextToolsLauncher(){
 const pathname=usePathname(),router=useRouter(),{colors}=useTheme(),{width}=useWindowDimensions();const styles=useMemo(()=>makeStyles(colors),[colors]);
 const pool=pathname.match(/^\/pool\/([^/]+)$/),circle=pathname.match(/^\/circles\/([^/]+)$/);if(!pool&&!circle)return null;
 const desktop=Platform.OS==="web"&&width>=900;const open=()=>pool?router.push(`/trip-tools/${pool[1]}` as any):router.push(`/circles/${circle![1]}/tools` as any);
 return <Pressable onPress={open} style={[styles.fab,desktop&&styles.desktop]} accessibilityLabel={pool?"Open trip coordination tools":"Open Circle coordination tools"}><Ionicons name={pool?"navigate-circle-outline":"apps-outline"} size={19} color="#fff"/>{desktop?<Text style={styles.text}>{pool?"Trip tools":"Circle tools"}</Text>:null}</Pressable>
}
const makeStyles=(colors:any)=>StyleSheet.create({fab:{position:"absolute",right:20,bottom:126,minWidth:48,height:48,borderRadius:24,backgroundColor:colors.saffron,paddingHorizontal:14,flexDirection:"row",gap:6,alignItems:"center",justifyContent:"center",zIndex:900,shadowColor:"#000",shadowOpacity:.16,shadowRadius:10,shadowOffset:{width:0,height:5},elevation:7},desktop:{minWidth:116},text:{color:"#fff",fontSize:10,fontWeight:"900"}});
