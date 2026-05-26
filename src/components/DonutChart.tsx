import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colorAt, colors } from '@/theme';

interface Slice {
  value: number;
  color?: string;
}

interface Props {
  data: Slice[];
  size?: number;
  thickness?: number;
}

export const DonutChart: React.FC<Props> = ({ data, size = 180, thickness = 22 }) => {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);

  if (total <= 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="none"
          />
        </Svg>
      </View>
    );
  }

  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="none"
          />
          {data.map((d, i) => {
            const value = Math.max(0, d.value);
            const length = (value / total) * circumference;
            const circle = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={d.color ?? colorAt(i)}
                strokeWidth={thickness}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                fill="none"
                strokeLinecap="butt"
              />
            );
            offset += length;
            return circle;
          })}
        </G>
      </Svg>
    </View>
  );
};
