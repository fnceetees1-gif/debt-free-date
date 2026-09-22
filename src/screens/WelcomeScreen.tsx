// src/screens/WelcomeScreen.tsx
//
// First-launch onboarding. Three panels, skippable, shown once — gated on
// AppSettings.hasSeenWelcome.
//
// It exists to answer the two questions the app never answered on its own:
// what the extra monthly payment actually does, and whether these projections
// are advice. The third panel doubles as the disclosure App Review looks for in
// a finance app, stated up front rather than buried at the bottom of Settings.
//
// Deliberately NOT a paywall. Guideline 3.1.1 — a reviewer, and a new user,
// must be able to reach the working app without being asked for money first.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardIcon, StrategyIcon, ProgressIcon } from '../components/TabIcons';

const ACCENT = '#7CE0A0';

interface Panel {
  key: string;
  art: (size: number, color: string) => React.ReactNode;
  title: string;
  body: string;
}

const PANELS: Panel[] = [
  {
    key: 'date',
    art: (size, color) => <DashboardIcon size={size} color={color} />,
    title: 'Find your debt-free date',
    body: "Add what you owe — balance, rate and minimum payment. The app works out the month you're free and shows you the balance falling to nothing.",
  },
  {
    key: 'extra',
    art: (size, color) => <StrategyIcon size={size} color={color} />,
    title: 'One debt at a time',
    body: "Any extra you can pay goes against a single target debt, not spread thin. Clear it and its minimum payment rolls into the next one, so every month you're paying more than the last.",
  },
  {
    key: 'honest',
    art: (size, color) => <ProgressIcon size={size} color={color} />,
    title: 'Log what you actually pay',
    body: 'Your projection is only as good as the payments behind it. Log each one and Progress shows you the real story. Everything stays on this device — nothing is uploaded.',
  },
];

export default function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLast = page === PANELS.length - 1;

  // Safe areas are asymmetric — a vertical toolbar or camera insets one side
  // and not the other — so the two sides are padded independently rather than
  // with a single paddingHorizontal. The insets are added inside the panel's
  // fixed `width`, which the paging maths depends on staying the full display.
  const sides = (base: number) => ({
    paddingLeft: base + insets.left,
    paddingRight: base + insets.right,
  });

  const goTo = (i: number) => {
    const clamped = Math.min(Math.max(i, 0), PANELS.length - 1);
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
    setPage(clamped);
  };

  // Keep the dots honest when the user swipes rather than taps.
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.skipRow, sides(styles.skipRow.paddingHorizontal)]}>
        <TouchableOpacity
          onPress={onDone}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {PANELS.map((p) => (
          <View key={p.key} style={[styles.panel, { width }, sides(styles.panel.paddingHorizontal)]}>
            <View style={styles.art}>{p.art(72, ACCENT)}</View>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.body}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {PANELS.map((p, i) => (
          <View key={p.key} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={[styles.footer, sides(styles.footer.paddingHorizontal)]}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => (isLast ? onDone() : goTo(page + 1))}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{isLast ? 'Add my first debt' : 'Next'}</Text>
        </TouchableOpacity>

        {/* The disclaimer belongs here, on the way in, not only in Settings. */}
        <Text style={styles.disclaimer}>
          Debt Free Date is a calculator. Projections assume the payments you enter and do not
          account for fees, rate changes or promotional periods. It is not financial advice.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1B1F3B' },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8, height: 40 },
  skip: { color: '#8B90C4', fontSize: 15, fontWeight: '600' },
  pager: { flexGrow: 0 },
  panel: { paddingHorizontal: 32, paddingTop: 24, alignItems: 'center' },
  art: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#252A4D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  body: { color: '#C7CAEA', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 28 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3C4270' },
  dotActive: { backgroundColor: ACCENT, width: 20 },
  footer: { marginTop: 'auto', paddingHorizontal: 28, paddingBottom: 20 },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: { color: '#0B2A1A', fontSize: 16, fontWeight: '700' },
  disclaimer: {
    color: '#6F75A6',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 16,
  },
});
