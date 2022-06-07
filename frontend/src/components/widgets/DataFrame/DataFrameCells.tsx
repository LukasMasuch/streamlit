/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  GridCell,
  GridCellKind,
  TextCell,
  Theme as GlideTheme,
  BooleanCell,
  NumberCell,
  BubbleCell,
  UriCell,
  ImageCell,
  LoadingCell,
  CustomCell,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver, Type as QuiverType } from "src/lib/Quiver"
import { notNullOrUndefined } from "src/lib/utils"
import { Vector } from "apache-arrow"

export enum ColumnType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  List = "list",
  Url = "url",
  Image = "image",
  BarChart = "bar-chart",
  LineChart = "line-chart",
  ProgressChart = "progress-chart",
}

/**
 * Maps the data type from column config to a valid column type.
 */
export function getColumnTypeFromConfig(typeName?: string): ColumnType {
  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Text
  }

  typeName = typeName.toLowerCase().trim()

  // Match with types from enum
  if (Object.values(ColumnType).some((type: string) => type === typeName)) {
    return typeName as ColumnType
  }

  return ColumnType.Text
}

/**
 * Maps the data type from Quiver to a valid column type.
 */
export function getColumnTypeFromQuiver(quiverType: QuiverType): ColumnType {
  let typeName = Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Text

  if (!typeName) {
    // Use text column as fallback
    return ColumnType.Text
  }

  typeName = typeName.toLowerCase().trim()

  // Match based on quiver types
  if (["unicode"].includes(typeName)) {
    columnType = ColumnType.Text
  } else if (["date", "datetime", "datetimetz"].includes(typeName)) {
    // TODO(lukasmasuch): Support column types
    columnType = ColumnType.Text
  } else if (typeName === "bool") {
    columnType = ColumnType.Boolean
  } else if (["int64", "float64", "range"].includes(typeName)) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Number
  } else if (typeName.startsWith("list")) {
    columnType = ColumnType.List
  }

  return columnType
}

/**
 * Returns either the formatted content or display value for a Quiver cell.
 */
export function getDisplayContent(quiverCell: DataFrameCell): string {
  const displayContent =
    quiverCell.displayContent ||
    Quiver.format(quiverCell.content, quiverCell.contentType)

  // Remove all line breaks
  return displayContent.replace(/(\r\n|\n|\r)/gm, " ")
}

/**
 * Extracts a CSS property value from a given CSS style string by using a regex.
 *
 * @param htmlElementId: The ID of the HTML element to extract the property for.
 * @param property: The css property to extract the value for.
 * @param cssStyle: The css style string.
 *
 * @return the CSS property value or undefined if the property is not found.
 */
export function extractCssProperty(
  htmlElementId: string,
  property: string,
  cssStyle: string
): string | undefined {
  // This regex is supposed to extract the value of a CSS property
  // for a specified HTML element ID from a CSS style string:
  const regex = new RegExp(
    `${htmlElementId}[^{]*{(?:[^}]*[\\s;]{1})?${property}:\\s*([^;\\s]+)[;]?.*}`,
    "gm"
  )

  const match = regex.exec(cssStyle)
  if (match) {
    return match[1]
  }

  return undefined
}
/**
 * Returns a template object representing an empty cell for a given data type.
 *
 * @param type: The type of the column.
 * @param readonly: If true, returns a read-only version of the cell template.
 * @param isIndex: Indicates if this is an index column.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellTemplate(
  type: ColumnType,
  readonly: boolean,
  isIndex: boolean
): GridCell {
  const style = isIndex ? "faded" : "normal"

  switch (type) {
    case ColumnType.Text:
      return {
        kind: GridCellKind.Text,
        data: "",
        displayData: "",
        allowOverlay: true,
        readonly,
        style,
      } as TextCell
    case ColumnType.Boolean:
      return {
        kind: GridCellKind.Boolean,
        data: false,
        readonly,
        allowOverlay: false, // no overlay possible
        style,
      } as BooleanCell
    case ColumnType.Number:
      return {
        kind: GridCellKind.Number,
        data: undefined,
        displayData: "",
        readonly,
        allowOverlay: true,
        contentAlign: "right",
        style,
      } as NumberCell
    case ColumnType.List:
      return {
        kind: GridCellKind.Bubble,
        data: [],
        allowOverlay: true,
        style,
      } as BubbleCell
    case ColumnType.Url:
      return {
        kind: GridCellKind.Uri,
        data: "",
        readonly,
        allowOverlay: true,
        style,
      } as UriCell
    case ColumnType.Image:
      return {
        kind: GridCellKind.Image,
        data: [],
        displayData: [],
        allowAdd: !readonly,
        allowOverlay: true,
        style,
      } as ImageCell
    case ColumnType.LineChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "[]",
        data: {
          kind: "sparkline-cell",
          values: [],
          displayValues: [],
          graphKind: "line",
          yAxis: [0, 1],
        },
      } as CustomCell
    case ColumnType.BarChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "[]",
        data: {
          kind: "sparkline-cell",
          values: [],
          graphKind: "bar",
          yAxis: [0, 1],
        },
      } as CustomCell
    case ColumnType.ProgressChart:
      return {
        kind: GridCellKind.Custom,
        allowOverlay: false,
        copyData: "",
        data: {
          kind: "range-cell",
          min: 0,
          max: 1,
          value: 0,
          step: 0.1,
          label: `0%`,
          measureLabel: "100%",
        },
      } as CustomCell
    default:
      throw new Error(`Unsupported cell type: ${type}`)
  }
}

/**
 * Returns the sort mode based on the given column type.
 */
export function getColumnSortMode(columnType: ColumnType): string {
  if (
    columnType === ColumnType.Number ||
    columnType === ColumnType.ProgressChart
  ) {
    // Smart mode also works correctly for numbers
    return "smart"
  }

  return "default"
}

function getEmptyCell(): LoadingCell {
  return {
    kind: GridCellKind.Loading,
    allowOverlay: false,
  } as LoadingCell
}

function getErrorCell(errorMsg: string, errorDetails = ""): TextCell {
  return {
    ...getCellTemplate(ColumnType.Text, true, false),
    data: errorMsg + (errorDetails ? `\n${errorDetails}` : ""),
    displayData: errorMsg,
    themeOverride: {
      textDark: "#ff4b4b", // TOOD(lukasmasuch): use color from theme
    },
  } as TextCell
}

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param cellTemplate: the empty cell template from the column.
 * @param quiverCell: a dataframe cell object from Quiver.
 * @param cssStyles: optional css styles to apply on the cell.
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function fillCellTemplate(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell,
  cssStyles: string | undefined = undefined
): GridCell {
  let cellKind: GridCellKind | string = cellTemplate.kind
  if (cellTemplate.kind === GridCellKind.Custom) {
    cellKind = (cellTemplate.data as any)?.kind

    if (!cellKind) {
      throw new Error(`Unable to determine cell type for custom cell.`)
    }
  }

  if (cssStyles && quiverCell.cssId) {
    cellTemplate = applyPandasStylerCss(
      cellTemplate,
      quiverCell.cssId,
      cssStyles
    )
  }

  switch (cellKind) {
    case GridCellKind.Text:
      return fillTextCell(cellTemplate, quiverCell)
    case GridCellKind.Number:
      return fillNumberCell(cellTemplate, quiverCell)
    case GridCellKind.Boolean:
      return fillBooleanCell(cellTemplate, quiverCell)
    case GridCellKind.Bubble:
      return fillListCell(cellTemplate, quiverCell)
    case GridCellKind.Uri:
      return fillUriCell(cellTemplate, quiverCell)
    case GridCellKind.Image:
      return fillImageCell(cellTemplate, quiverCell)
    case "sparkline-cell":
      return fillChartCell(cellTemplate, quiverCell)
    case "range-cell":
      return fillProgressCell(cellTemplate, quiverCell)
    default:
      return getErrorCell(`Unsupported cell kind: ${cellKind}`)
  }
}

export function applyPandasStylerCss(
  cell: GridCell,
  cssId: string,
  cssStyles: string
): GridCell {
  const themeOverride = {} as Partial<GlideTheme>

  // Extract and apply the font color
  const fontColor = extractCssProperty(cssId, "color", cssStyles)
  if (fontColor) {
    themeOverride.textDark = fontColor
  }

  // Extract and apply the background color
  const backgroundColor = extractCssProperty(
    cssId,
    "background-color",
    cssStyles
  )
  if (backgroundColor) {
    themeOverride.bgCell = backgroundColor
  }

  if (themeOverride) {
    // Apply the background and font color in the theme override
    return {
      ...cell,
      themeOverride,
    }
  }
  return cell
}

export function fillListCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  let cellData = []

  if (notNullOrUndefined(quiverCell.content)) {
    cellData = JSON.parse(
      JSON.stringify(quiverCell.content, (_key, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    )
    if (!Array.isArray(cellData)) {
      // Transform into list
      cellData = [String(cellData)]
      // TODO: Or return error?
      // return getErrorCell(
      //   `Incompatible list value: ${quiverCell.content}`,
      //   "The provided value is not an array."
      // )
    }
  }

  return {
    ...cellTemplate,
    data: cellData,
  } as BubbleCell
}

export function fillUriCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  return {
    ...cellTemplate,
    data: notNullOrUndefined(quiverCell.content)
      ? String(quiverCell.content)
      : "",
  } as UriCell
}

export function fillTextCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  const formattedContents = getDisplayContent(quiverCell)
  return {
    ...cellTemplate,
    data:
      typeof quiverCell.content === "string" ||
      !notNullOrUndefined(quiverCell.content) // don't use formattedContents for null/undefined
        ? quiverCell.content
        : formattedContents,
    displayData: formattedContents,
  } as TextCell
}

export function fillBooleanCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  if (
    notNullOrUndefined(quiverCell.content) &&
    typeof quiverCell.content !== "boolean"
  ) {
    return getErrorCell(`Incompatible boolean value: ${quiverCell.content}`)
  }

  return {
    ...cellTemplate,
    data: quiverCell.content as boolean,
  } as BooleanCell
}

export function fillNumberCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  let cellData

  if (notNullOrUndefined(quiverCell.content)) {
    if (quiverCell.content instanceof Int32Array) {
      // int values need to be extracted this way:
      // eslint-disable-next-line prefer-destructuring
      cellData = Number(quiverCell.content[0])
    } else {
      cellData = Number(quiverCell.content)
    }

    if (Number.isNaN(cellData)) {
      return getErrorCell(`Incompatible number value: ${quiverCell.content}`)
    }
  }

  const formattedContents = getDisplayContent(quiverCell)

  return {
    ...cellTemplate,
    data: cellData,
    displayData: formattedContents,
  } as NumberCell
}

export function fillImageCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  const imageUrls = notNullOrUndefined(quiverCell.content)
    ? [String(quiverCell.content)]
    : []

  return {
    ...cellTemplate,
    data: imageUrls,
    displayData: imageUrls,
  } as ImageCell
}

export function fillChartCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  if (!notNullOrUndefined(quiverCell.content)) {
    return getEmptyCell()
  }

  let chartData
  if (Array.isArray(quiverCell.content)) {
    chartData = quiverCell.content
  } else if (quiverCell.content instanceof Vector) {
    chartData = quiverCell.content.toArray()
  } else {
    return getErrorCell(
      `Incompatible chart value: ${quiverCell.content}`,
      "The provided value is not an array."
    )
  }

  const convertedChartData: number[] = []
  let normalizedChartData: number[] = []

  if (chartData.length >= 1) {
    let maxValue = Number(chartData[0])
    let minValue = Number(chartData[0])
    chartData.forEach((value: any) => {
      const convertedValue = Number(value)
      if (convertedValue > maxValue) {
        maxValue = convertedValue
      }

      if (convertedValue < minValue) {
        minValue = convertedValue
      }

      if (Number.isNaN(convertedValue)) {
        return getErrorCell(
          `Incompatible chart value: ${quiverCell.content}`,
          "All values in the array should be numbers."
        )
      }
      convertedChartData.push(convertedValue)
    })

    if (maxValue > 1 || minValue < 0) {
      // Normalize values
      normalizedChartData = convertedChartData.map(
        v => (v - minValue) / (maxValue - minValue)
      )
    } else {
      // Values are already in range 0-1
      normalizedChartData = convertedChartData
    }
  }

  return {
    ...cellTemplate,
    copyData: JSON.stringify(convertedChartData),
    data: {
      ...(cellTemplate as CustomCell)?.data,
      values: normalizedChartData,
      displayValues: convertedChartData,
    },
  } as CustomCell
}

export function fillProgressCell(
  cellTemplate: GridCell,
  quiverCell: DataFrameCell
): GridCell {
  if (!notNullOrUndefined(quiverCell.content)) {
    return getEmptyCell()
  }

  const cellData = Number(quiverCell.content)

  if (Number.isNaN(cellData) || cellData < 0 || cellData > 1) {
    return getErrorCell(
      `Incompatible progress value: ${quiverCell.content}`,
      "The value has to be between 0 and 1."
    )
  }

  return {
    ...cellTemplate,
    copyData: String(quiverCell.content),
    data: {
      ...(cellTemplate as CustomCell)?.data,
      value: cellData,
      label: `${Math.round(cellData * 100).toString()}%`,
    },
  } as CustomCell
}
