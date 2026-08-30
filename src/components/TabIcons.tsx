// src/components/TabIcons.tsx
//
// Tab bar icons drawn from plain Views.
//
// Without a `tabBarIcon` React Navigation falls back to its own MissingIcon,
// which renders the character "⏷" (U+23F7). iOS has a glyph for it, so it
// looked like an odd little triangle and passed review; most Android system
// fonts do not, so every tab drew a tofu box — a square with an X in it.
//
// Drawn rather than imported: @expo/vector-icons isn't installed, and a whole
// icon font is a lot of binary for five shapes. Same reasoning as the hand
// rolled PNG generator in scripts/generate-assets.js.
//
// Every icon fills a `size` x `size` box and takes its color from the tab bar,
// so the active/inactive tint keeps working.
import React from 'react';
import { View } from 'react-native';

export interface TabIconProps {
  color: string;
  size: number;
}

/** Descending bars — the same mark as the app icon. */
export function DashboardIcon({ color, size }: TabIconProps) {
  const barW = size * 0.2;
  return (
    <View
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}
    >
      {[0.9, 0.62, 0.34].map((h, i) => (
        <View
          key={i}
          style={{
            width: barW,
            height: size * h,
            backgroundColor: color,
            borderRadius: barW * 0.35,
          }}
        />
      ))}
    </View>
  );
}

/** A card with a stripe. */
export function DebtsIcon({ color, size }: TabIconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <View
        style={{
          width: size,
          height: size * 0.72,
          borderRadius: size * 0.14,
          borderWidth: size * 0.083,
          borderColor: color,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: size * 0.15,
            backgroundColor: color,
            marginTop: size * 0.1,
          }}
        />
      </View>
    </View>
  );
}

/** A target — the debt you're aiming everything at. */
export function StrategyIcon({ color, size }: TabIconProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: size * 0.083,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size * 0.17,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A checkmark, built from two borders on a rotated box. */
export function ProgressIcon({ color, size }: TabIconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.62,
          height: size * 0.34,
          borderLeftWidth: size * 0.104,
          borderBottomWidth: size * 0.104,
          borderColor: color,
          transform: [{ rotate: '-45deg' }],
          // The rotation leaves the tick sitting low in its box; nudge it back
          // onto the same optical centre line as the other four icons.
          marginTop: -size * 0.1,
        }}
      />
    </View>
  );
}

/** Three sliders. */
export function SettingsIcon({ color, size }: TabIconProps) {
  const knob = size * 0.26;
  const track = Math.max(size * 0.062, 1.5);
  return (
    <View style={{ width: size, height: size, justifyContent: 'space-between' }}>
      {[0.62, 0.3, 0.72].map((pos, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: pos, height: track, backgroundColor: color }} />
          <View
            style={{
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              borderWidth: track,
              borderColor: color,
            }}
          />
          <View style={{ flex: 1 - pos, height: track, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}
