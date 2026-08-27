import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, PressableProps } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: React.ReactNode;
  scaleTo?: number;
  style?: any;
};

/** Subtle tactile feedback that automatically disables motion when the OS asks for reduced motion. */
export default function PressableScale({ children, scaleTo = 0.96, style, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduceMotion) scale.value = withSpring(scaleTo, { damping: 14, stiffness: 260 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        else scale.value = 1;
        onPressOut?.(e);
      }}
      style={[style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
