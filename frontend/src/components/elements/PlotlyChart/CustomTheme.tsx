/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { merge, mergeWith, isArray, assign } from "lodash"
import { darken, transparentize, readableColor } from "color2k"
import { hasLightBackgroundColor, Theme } from "src/theme"

export function applyStreamlitThemeData(data: any, theme: Theme): any {
  // This theming config contains multiple hard coded spacing values.
  // The reason is that we currently only have rem values in our spacing
  // definitions and vega lite requires numerical (pixel) values.
  const { genericFonts, colors, fontSizes, fontWeights } = theme
  const streamlitTheme = {
    autocolorscale: true,
  }

  if (!data) {
    return streamlitTheme
  }

  return assign(data, streamlitTheme)
}

function getGreyText(theme: Theme) {
  return theme.colors.fadedText60
}

export function applyStreamlitThemeLayout(layout: any, theme: Theme): any {
  // This theming config contains multiple hard coded spacing values.
  // The reason is that we currently only have rem values in our spacing
  // definitions and vega lite requires numerical (pixel) values.
  // console.log(layout)
  const { genericFonts, colors, fontSizes, fontWeights } = theme

  const themeFonts = {
    labelFont: genericFonts.bodyFont,
    titleFont: genericFonts.bodyFont,
    labelFontSize: fontSizes.twoSmPx,
    titleFontSize: fontSizes.twoSmPx,
  }

  const streamlitTheme = {
    background: colors.bgColor,
    axis: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      gridColor: colors.fadedText10,
      ...themeFonts,
    },
    header: {
      labelColor: colors.bodyText,
    },
    view: {
      continuousHeight: 350,
      continuousWidth: 400,
    },
    font: {
      family: genericFonts.bodyFont,
    },
    title: {
      color: theme.colors.headingColor,
      subtitleColor: colors.bodyText,
      ...themeFonts,
      font: {
        family: genericFonts.bodyFont,
        size: fontSizes.smPx + 2,
        color: colors.headingColor,
      },
      // text: (layout.title.text) ? `<b>${layout.title.text}</b>` : undefined,
      x: 0,
    },
    colorway: hasLightBackgroundColor(theme)
      ? [
          "#0068C9",
          "#83C9FF",
          "#FF2B2B",
          "#FFABAB",
          "#29B09D",
          "#7DEFA1",
          "#FF8700",
          "#FFD16A",
          "#6D3FC0",
          "#D5DAE5",
        ]
      : [
          "#83C9FF",
          "#0068C9",
          "#FFABAB",
          "#FF2B2B",
          "#7DEFA1",
          "#29B09D",
          "#FFD16A",
          "#FF8700",
          "#6D3FC0",
          "#D5DAE5",
        ],
    legend: {
      side: "left",
      orientation: "h",
      yanchor: "bottom",
      xanchor: "left",
      y: -0.5,
      x: -0.05,
      title: {
        font: {
          size: fontSizes.smPx,
          color: getGreyText(theme),
        },
        side: "top",
      },
      valign: "middle",

      bordercolor: colors.transparent,
      itemwidth: 5,
      itemsizing: "constant",
      // xanchor: "left",
      tracegroupgap: 100,
      font: {
        color: getGreyText(theme),
      },
      labelColor: getGreyText(theme),
      titleColor: getGreyText(theme),
      ...themeFonts,
    },
    paper_bgcolor: colors.bgColor,
    plot_bgcolor: colors.bgColor,
    // yaxis: {
    //   minor: {
    //     showgrid: false,
    //   }
    // },
    colorDiscreteSequence: hasLightBackgroundColor(theme)
      ? [
          "#0068C9",
          "#83C9FF",
          "#FF2B2B",
          "#FFABAB",
          "#29B09D",
          "#7DEFA1",
          "#FF8700",
          "#FFD16A",
          "#6D3FC0",
          "#D5DAE5",
        ]
      : [
          "#83C9FF",
          "#0068C9",
          "#FFABAB",
          "#FF2B2B",
          "#7DEFA1",
          "#29B09D",
          "#FFD16A",
          "#FF8700",
          "#6D3FC0",
          "#D5DAE5",
        ],
    yaxis: {
      hoverformat: ".2f",
      // nticks: 10,
      ticklabelposition: "outside",
      tickmode: "auto",
      // automargin: "left",
      zeroline: false,
      title: {
        font: {
          color: colors.fadedText60,
          size: fontSizes.smPx,
        },
        standoff: 25,
      },
      tickfont: {
        color: getGreyText(theme),
      },
      automargin: true,
    },
    xaxis: {
      standoff: 100,
      // nticks: 8,
      showgrid: false,
      rangeselector: {
        bordercolor: colors.transparent,
        borderwidth: 0,
      },
      tickfont: {
        color: getGreyText(theme),
        size: fontSizes.smPx,
      },
      title: {
        font: {
          color: getGreyText(theme),
          size: fontSizes.smPx,
        },
        standoff: 20,
      },
      zeroline: false,
      automargin: true,
    },
    autosize: true,
    margin: {
      pad: 16,
      r: 0,
      autoexpand: true,
      l: 0,
      // b: -50,
      // t: 0,
    },
    modebar: {
      activecolor: colors.primary,
      //remove: ["senddatatocloud", "editinchartstudio", "editInChartStudio"],
    },

    // align: "auto",
    hoverlabel: {
      bgcolor: colors.bgColor,
      bordercolor: colors.fadedText10,
      font: {
        color: getGreyText(theme),
        family: genericFonts.bodyFont,
        size: fontSizes.sm,
      },
    },
    coloraxis: {
      colorbar: {
        thickness: 16,
        xpad: 32,
        ticklabelposition: "outside",
        outlinecolor: colors.transparent,
        outlinewidth: 8,
        nticks: 10,
        y: 0.5745,
        title: {
          font: {
            color: getGreyText(theme),
          },
        },
        tickfont: {
          color: getGreyText(theme),
        },
      },
      colorscale: {
        ...(hasLightBackgroundColor(theme)
          ? {
              diverging: [
                [0.1, "#004280"],
                [0.2, "#0054A3"],
                [0.3, "#1C83E1"],
                [0.4, "#60B4FF"],
                [0.5, "#A6DCFF"],
                [0.6, "#FFC7C7"],
                [0.7, "#FF8C8C"],
                [0.8, "#FF4B4B"],
                [0.9, "#BD4043"],
                [1.0, "#7D353B"],
              ],
              sequential: [
                [0, "#E4F5FF"],
                [0.1111111111111111, "#C7EBFF"],
                [0.2222222222222222, "#A6DCFF"],
                [0.3333333333333333, "#83C9FF"],
                [0.4444444444444444, "#60B4FF"],
                [0.5555555555555556, "#3D9DF3"],
                [0.6666666666666666, "#1C83E1"],
                [0.7777777777777778, "#0068C9"],
                [0.8888888888888888, "#0054A3"],
                [1, "#004280"],
              ],
              sequentialminus: [
                [0, "#004280"],
                [0.1111111111111111, "#0054A3"],
                [0.2222222222222222, "#0068C9"],
                [0.3333333333333333, "#1C83E1"],
                [0.4444444444444444, "#3D9DF3"],
                [0.5555555555555556, "#60B4FF"],
                [0.6666666666666666, "#83C9FF"],
                [0.7777777777777778, "#A6DCFF"],
                [0.8888888888888888, "#C7EBFF"],
                [1, "#E4F5FF"],
              ],
            }
          : {
              diverging: [
                [0, "#A6DCFF"],
                [0.1, "#A6DCFF"],
                [0.2, "#60B4FF"],
                [0.3, "#1C83E1"],
                [0.4, "#0054A3"],
                [0.5, "#004280"],
                [0.6, "#7D353B"],
                [0.7, "#BD4043"],
                [0.8, "#FF4B4B"],
                [0.9, "#FF8C8C"],
                [1.0, "#FFC7C7"],
              ],
              sequential: [
                [0, "#004280"],
                [0.1111111111111111, "#0054A3"],
                [0.2222222222222222, "#0068C9"],
                [0.3333333333333333, "#1C83E1"],
                [0.4444444444444444, "#3D9DF3"],
                [0.5555555555555556, "#60B4FF"],
                [0.6666666666666666, "#83C9FF"],
                [0.7777777777777778, "#A6DCFF"],
                [0.8888888888888888, "#C7EBFF"],
                [1, "#E4F5FF"],
              ],
              sequentialminus: [
                [0, "#E4F5FF"],
                [0.1111111111111111, "#C7EBFF"],
                [0.2222222222222222, "#A6DCFF"],
                [0.3333333333333333, "#83C9FF"],
                [0.4444444444444444, "#60B4FF"],
                [0.5555555555555556, "#3D9DF3"],
                [0.6666666666666666, "#1C83E1"],
                [0.7777777777777778, "#0068C9"],
                [0.8888888888888888, "#0054A3"],
                [1, "#004280"],
              ],
            }),
      },
    },
    colorscale: {
      // TODO: Eventually, we might want to move those color schemes to our theme.
      // But For now, this is specifically defined for vega lite based charts.
      // Ramp & heatmap are both using the sequential color scheme.
      ...(hasLightBackgroundColor(theme)
        ? {
            diverging: [
              [0.1, "#004280"],
              [0.2, "#0054A3"],
              [0.3, "#1C83E1"],
              [0.4, "#60B4FF"],
              [0.5, "#A6DCFF"],
              [0.6, "#FFC7C7"],
              [0.7, "#FF8C8C"],
              [0.8, "#FF4B4B"],
              [0.9, "#BD4043"],
              [1.0, "#7D353B"],
            ],
            sequential: [
              [0, "#E4F5FF"],
              [0.1111111111111111, "#C7EBFF"],
              [0.2222222222222222, "#A6DCFF"],
              [0.3333333333333333, "#83C9FF"],
              [0.4444444444444444, "#60B4FF"],
              [0.5555555555555556, "#3D9DF3"],
              [0.6666666666666666, "#1C83E1"],
              [0.7777777777777778, "#0068C9"],
              [0.8888888888888888, "#0054A3"],
              [1, "#004280"],
            ],
            // heatmap: [
            //     [0.1, "#E4F5FF"],
            //     [0.2, "#C7EBFF"],
            //     [0.3, "#A6DCFF"],
            //     [0.4, "#83C9FF"],
            //     [0.5, "#60B4FF"],
            //     [0.6, "#3D9DF3"],
            //     [0.7, "#1C83E1"],
            //     [0.8, "#0068C9"],
            //     [0.9, "#0054A3"],
            //     [1.0, "#004280"],
            // ],
            sequentialminus: [
              [0, "#004280"],
              [0.1111111111111111, "#0054A3"],
              [0.2222222222222222, "#0068C9"],
              [0.3333333333333333, "#1C83E1"],
              [0.4444444444444444, "#3D9DF3"],
              [0.5555555555555556, "#60B4FF"],
              [0.6666666666666666, "#83C9FF"],
              [0.7777777777777778, "#A6DCFF"],
              [0.8888888888888888, "#C7EBFF"],
              [1, "#E4F5FF"],
            ],
          }
        : {
            diverging: [
              [0, "#A6DCFF"],
              [0.1, "#A6DCFF"],
              [0.2, "#60B4FF"],
              [0.3, "#1C83E1"],
              [0.4, "#0054A3"],
              [0.5, "#004280"],
              [0.6, "#7D353B"],
              [0.7, "#BD4043"],
              [0.8, "#FF4B4B"],
              [0.9, "#FF8C8C"],
              [1.0, "#FFC7C7"],
            ],
            sequential: [
              [0, "#004280"],
              [0.1111111111111111, "#0054A3"],
              [0.2222222222222222, "#0068C9"],
              [0.3333333333333333, "#1C83E1"],
              [0.4444444444444444, "#3D9DF3"],
              [0.5555555555555556, "#60B4FF"],
              [0.6666666666666666, "#83C9FF"],
              [0.7777777777777778, "#A6DCFF"],
              [0.8888888888888888, "#C7EBFF"],
              [1, "#E4F5FF"],
            ],
            sequentialminus: [
              [0, "#E4F5FF"],
              [0.1111111111111111, "#C7EBFF"],
              [0.2222222222222222, "#A6DCFF"],
              [0.3333333333333333, "#83C9FF"],
              [0.4444444444444444, "#60B4FF"],
              [0.5555555555555556, "#3D9DF3"],
              [0.6666666666666666, "#1C83E1"],
              [0.7777777777777778, "#0068C9"],
              [0.8888888888888888, "#0054A3"],
              [1, "#004280"],
            ],
            // heatmap: [
            //     [0.1, "#004280"],
            //     [0.2, "#0054A3"],
            //     [0.3, "#0068C9"],
            //     [0.4, "#1C83E1"],
            //     [0.5, "#3D9DF3"],
            //     [0.6, "#60B4FF"],
            //     [0.7, "#83C9FF"],
            //     [0.8, "#A6DCFF"],
            //     [0.9, "#C7EBFF"],
            //     [1.0, "#E4F5FF"],
            // ],
          }),
    },
  }

  if (!layout) {
    return streamlitTheme
  }

  return assign(layout, streamlitTheme)
}

export function applyThemeDefaults(config: any, theme: Theme): any {
  const { colors, fontSizes, genericFonts } = theme
  const themeFonts = {
    labelFont: genericFonts.bodyFont,
    titleFont: genericFonts.bodyFont,
    labelFontSize: fontSizes.twoSmPx,
    titleFontSize: fontSizes.twoSmPx,
  }
  const themeDefaults = {
    background: colors.bgColor,
    axis: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      gridColor: colors.fadedText10,
      ...themeFonts,
    },
    legend: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      ...themeFonts,
    },
    title: {
      color: colors.bodyText,
      subtitleColor: colors.bodyText,
      ...themeFonts,
    },
    header: {
      labelColor: colors.bodyText,
    },
    view: {
      continuousHeight: 350,
      continuousWidth: 400,
    },
  }

  if (!config) {
    return themeDefaults
  }

  // Fill in theme defaults where the user didn't specify config options.
  return merge({}, themeDefaults, config || {})
}
