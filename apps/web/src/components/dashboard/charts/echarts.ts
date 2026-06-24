"use client";

// Performant core build: only the chart types and components we use are
// registered. The world choropleth (MapChart + GeoComponent + VisualMap) and
// the device donut (PieChart) are registered here so call sites stay thin.
import { BarChart, LineChart, MapChart, PieChart } from "echarts/charts";
import {
  GeoComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";

echarts.use([
  LineChart,
  BarChart,
  MapChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LegendComponent,
  GeoComponent,
  CanvasRenderer,
]);

export type { EChartsCoreOption } from "echarts/core";
export { echarts, ReactEChartsCore };
