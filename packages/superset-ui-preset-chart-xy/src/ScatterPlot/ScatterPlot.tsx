/* eslint-disable sort-keys, no-magic-numbers, complexity */
import React, { PureComponent } from 'react';
import { XYChart, PointSeries } from '@data-ui/xy-chart';
import { chartTheme, ChartTheme } from '@data-ui/theme';
import { Margin, Dimension } from '@superset-ui/dimension';
import { WithLegend } from '@superset-ui/chart-composition';
import { extent as d3Extent } from 'd3-array';
import { createSelector } from 'reselect';
import Encoder, { ChannelTypes, Encoding, Outputs } from './Encoder';
import { Dataset, PlainObject } from '../encodeable/types/Data';
import ChartLegend from '../components/legend/ChartLegend';
import { PartialSpec } from '../encodeable/types/Specification';
import createMarginSelector, { DEFAULT_MARGIN } from '../utils/selectors/createMarginSelector';
import createXYChartLayoutSelector from '../utils/selectors/createXYChartLayoutSelector';
import DefaultTooltipRenderer from './DefaultTooltipRenderer';

export interface TooltipProps {
  datum: EncodedPoint;
  encoder: Encoder;
}

const defaultProps = {
  className: '',
  margin: DEFAULT_MARGIN,
  theme: chartTheme,
  TooltipRenderer: DefaultTooltipRenderer,
} as const;

export type HookProps = {
  TooltipRenderer?: React.ComponentType<TooltipProps>;
};

type Props = {
  className?: string;
  width: string | number;
  height: string | number;
  margin?: Margin;
  data: Dataset;
  theme?: ChartTheme;
} & PartialSpec<Encoding> &
  HookProps &
  Readonly<typeof defaultProps>;

export interface EncodedPoint {
  x: Outputs['x'];
  y: Outputs['y'];
  size: Outputs['size'];
  fill: Outputs['fill'];
  stroke: Outputs['stroke'];
  data: PlainObject;
}

export default class ScatterPlot extends PureComponent<Props> {
  static defaultProps = defaultProps;

  encoder: Encoder;
  private createEncoder: () => void;

  private createMargin = createMarginSelector();

  private createXYChartLayout = createXYChartLayoutSelector();

  constructor(props: Props) {
    super(props);

    const createEncoder = createSelector(
      (p: PartialSpec<Encoding>) => p.encoding,
      p => p.commonEncoding,
      p => p.options,
      (encoding, commonEncoding, options) => new Encoder({ encoding, commonEncoding, options }),
    );

    this.createEncoder = () => {
      this.encoder = createEncoder(this.props);
    };

    this.encoder = createEncoder(this.props);
    this.renderChart = this.renderChart.bind(this);
  }

  renderChart(dim: Dimension) {
    const { width, height } = dim;
    const { data, margin, theme, TooltipRenderer } = this.props;
    const { channels } = this.encoder;

    if (typeof channels.size.scale !== 'undefined') {
      const domain = d3Extent(data, d => channels.size.get<number>(d));
      const [min, max] = domain;
      const adjustedDomain = [Math.min(min || 0, 0), Math.max(max || 1, 1)];
      channels.size.scale.setDomain(adjustedDomain);
    }

    const encodedData = data.map(d => ({
      x: channels.x.get(d),
      y: channels.y.get(d),
      size: channels.size.encode(d),
      fill: channels.fill.encode(d),
      stroke: channels.stroke.encode(d),
      data: d,
    }));

    const children = [
      <PointSeries
        key={channels.x.definition.field}
        data={encodedData}
        fill={(d: EncodedPoint) => d.fill}
        fillOpacity={0.5}
        stroke={(d: EncodedPoint) => d.stroke}
        size={(d: EncodedPoint) => d.size}
      />,
    ];

    const layout = this.createXYChartLayout({
      width,
      height,
      margin: this.createMargin(margin),
      theme,
      xEncoder: channels.x,
      yEncoder: channels.y,
      children,
    });

    return layout.renderChartWithFrame((chartDim: Dimension) => (
      <XYChart
        width={chartDim.width}
        height={chartDim.height}
        ariaLabel="BoxPlot"
        margin={layout.margin}
        renderTooltip={({ datum }: { datum: EncodedPoint }) => (
          <TooltipRenderer datum={datum} encoder={this.encoder} />
        )}
        showYGrid
        theme={theme}
        xScale={channels.x.definition.scale}
        yScale={channels.y.definition.scale}
      >
        {children}
        {layout.renderXAxis()}
        {layout.renderYAxis()}
      </XYChart>
    ));
  }

  render() {
    const { className, data, width, height } = this.props;

    this.createEncoder();
    const renderLegend = this.encoder.hasLegend()
      ? // eslint-disable-next-line react/jsx-props-no-multi-spaces
        () => <ChartLegend<ChannelTypes, Outputs, Encoding> data={data} encoder={this.encoder} />
      : undefined;

    return (
      <WithLegend
        className={`superset-chart-scatter-plot ${className}`}
        width={width}
        height={height}
        position="top"
        renderLegend={renderLegend}
        renderChart={this.renderChart}
      />
    );
  }
}
