// src/components/common/BatteryIndicator.tsx
// Indicateur de batterie visuel compact

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../constants/config';

interface BatteryIndicatorProps {
  percent: number;
  isCharging: boolean;
  size?: 'small' | 'medium';
}

export function BatteryIndicator({ percent, isCharging, size = 'small' }: BatteryIndicatorProps) {
  const getColor = () => {
    if (isCharging) return '#10B981';
    if (percent <= 10) return '#EF4444';
    if (percent <= 25) return '#F59E0B';
    return '#10B981';
  };

  const w = size === 'small' ? 22 : 30;
  const h = size === 'small' ? 10 : 14;

  return (
    <View style={[styles.container, { width: w, height: h }]}>
      <View style={[styles.body, { width: w - 3, height: h }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, Math.max(5, percent))}%`,
              backgroundColor: getColor(),
            },
          ]}
        />
      </View>
      <View style={[styles.tip, { height: h * 0.4 }]} />
      {isCharging && <Text style={styles.bolt}>⚡</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    borderWidth: 1,
    borderColor: THEME.colors.textSecondary,
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
    borderRadius: 1,
  },
  tip: {
    width: 2,
    backgroundColor: THEME.colors.textSecondary,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
  },
  bolt: {
    position: 'absolute',
    fontSize: 8,
    left: 6,
  },
});
