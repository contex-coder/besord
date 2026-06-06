import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, brutalShadow } from "@/src/theme";

const { width: SCREEN_W } = Dimensions.get("window");

type Props = {
  size?: number;
  interactive?: boolean;
  showSpeech?: boolean;
  speechText?: string;
  onPress?: () => void;
};

export default function BeetleMascot({
  size = 80,
  interactive = true,
  showSpeech = false,
  speechText = "BESORD",
  onPress,
}: Props) {
  // Wing flap animation
  const flapAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Continuous wing flap
    const flapSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(flapAnim, {
          toValue: 1,
          duration: 150,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flapAnim, {
          toValue: 0,
          duration: 150,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // Floating animation (up and down)
    const floatSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Pulse for interactive mode
    if (interactive) {
      const pulseSequence = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      pulseSequence.start();
    }

    flapSequence.start();
    floatSequence.start();

    return () => {
      flapSequence.stop();
      floatSequence.stop();
      if (interactive) pulseAnim.stopAnimation();
    };
  }, [interactive]);

  const wingAngle = flapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "40deg"],
  });

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const bodyScale = interactive ? pulseAnim : new Animated.Value(1);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!interactive || !onPress}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            transform: [{ translateY: floatY }, { scale: bodyScale }],
          },
        ]}
      >
        {/* Speech bubble */}
        {showSpeech && (
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>{speechText}</Text>
          </View>
        )}

        {/* Left wing */}
        <Animated.View
          style={[
            styles.wing,
            styles.wingLeft,
            {
              width: size * 0.6,
              height: size * 0.4,
              transform: [{ rotate: wingAngle }],
            },
          ]}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={size * 0.35}
            color={colors.aprovo}
          />
        </Animated.View>

        {/* Right wing */}
        <Animated.View
          style={[
            styles.wing,
            styles.wingRight,
            {
              width: size * 0.6,
              height: size * 0.4,
              transform: [{ rotate: wingAngle }],
            },
          ]}
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={size * 0.35}
            color={colors.aprovo}
          />
        </Animated.View>

        {/* Body (the beetle/icon) */}
        <View
          style={[
            styles.body,
            {
              width: size * 0.7,
              height: size * 0.7,
              borderRadius: size * 0.15,
            },
          ]}
        >
          <Ionicons
            name="bug"
            size={size * 0.45}
            color={colors.textInverse}
          />
        </View>

        {/* Eyes */}
        <View style={[styles.eye, styles.eyeLeft, { width: size * 0.15, height: size * 0.15 }]}>
          <View style={[styles.pupil, { width: size * 0.08, height: size * 0.08 }]} />
        </View>
        <View style={[styles.eye, styles.eyeRight, { width: size * 0.15, height: size * 0.15 }]}>
          <View style={[styles.pupil, { width: size * 0.08, height: size * 0.08 }]} />
        </View>

        {/* Antennae */}
        <View style={[styles.antenna, styles.antennaLeft, { width: size * 0.25, height: 2 }]} />
        <View style={[styles.antenna, styles.antennaRight, { width: size * 0.25, height: 2 }]} />
        <View style={[styles.antennaTip, styles.antennaTipLeft, { width: size * 0.08, height: size * 0.08 }]} />
        <View style={[styles.antennaTip, styles.antennaTipRight, { width: size * 0.08, height: size * 0.08 }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  body: {
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...brutalShadow,
  },
  wing: {
    position: "absolute",
    top: 2,
    backgroundColor: colors.bgSubtle,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  wingLeft: {
    left: -8,
    borderRightWidth: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  wingRight: {
    right: -8,
    borderLeftWidth: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  eye: {
    position: "absolute",
    top: "15%",
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  eyeLeft: { left: "15%" },
  eyeRight: { right: "15%" },
  pupil: {
    backgroundColor: colors.text,
    borderRadius: 50,
  },
  antenna: {
    position: "absolute",
    top: -12,
    backgroundColor: colors.text,
    zIndex: 1,
  },
  antennaLeft: {
    left: "20%",
    transform: [{ rotate: "-30deg" }],
  },
  antennaRight: {
    right: "20%",
    transform: [{ rotate: "30deg" }],
  },
  antennaTip: {
    position: "absolute",
    top: -18,
    backgroundColor: colors.neutral,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 50,
    zIndex: 2,
  },
  antennaTipLeft: { left: "14%" },
  antennaTipRight: { right: "14%" },
  speechBubble: {
    position: "absolute",
    top: -40,
    alignSelf: "center",
    backgroundColor: colors.neutral,
    borderWidth: 3,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 20,
    ...brutalShadow,
  },
  speechText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.text,
  },
});
