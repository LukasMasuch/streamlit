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
  CustomCell,
} from "@glideapps/glide-data-grid"

import { DataFrameCell, Quiver, Type as QuiverType } from "src/lib/Quiver"

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
 * Maps the data type from Quiver to a valid column type.
 */
export function determineColumnType(quiverType: QuiverType): ColumnType {
  const dataTypeName = quiverType && Quiver.getTypeName(quiverType)

  let columnType = ColumnType.Text

  if (!dataTypeName) {
    // Use text column as fallback
    columnType = ColumnType.Text
  } else if (["bool"].includes(dataTypeName)) {
    // TODO: lukasmasuch: Use text cell for now since the boolean cell does not support empty values.
    columnType = ColumnType.Text
  } else if (["int64", "float64", "range"].includes(dataTypeName)) {
    // The default index in pandas uses a range type.
    columnType = ColumnType.Number
  } else if (dataTypeName.startsWith("list")) {
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
 *
 * @return a GridCell object that can be used by glide-data-grid.
 */
export function getCellTemplate(
  type: ColumnType,
  readonly: boolean,
  style: "normal" | "faded" = "normal"
): GridCell {
  if (type === ColumnType.Text) {
    return {
      kind: GridCellKind.Text,
      data: "",
      displayData: "",
      allowOverlay: true,
      readonly,
      style,
    } as TextCell
  }

  if (type === ColumnType.Boolean) {
    return {
      kind: GridCellKind.Boolean,
      data: false,
      showUnchecked: true,
      allowEdit: readonly,
      allowOverlay: false, // no overlay possible
      style,
    } as BooleanCell
  }

  if (type === ColumnType.Number) {
    return {
      kind: GridCellKind.Number,
      data: undefined,
      displayData: "",
      readonly,
      allowOverlay: true,
      style,
    } as NumberCell
  }

  if (type === ColumnType.List) {
    return {
      kind: GridCellKind.Bubble,
      data: [],
      allowOverlay: true,
      style,
    } as BubbleCell
  }

  if (type === ColumnType.Url) {
    return {
      kind: GridCellKind.Uri,
      data: "",
      readonly,
      allowOverlay: true,
      style,
    } as UriCell
  }

  if (type === ColumnType.Image) {
    return {
      kind: GridCellKind.Image,
      data: [],
      displayData: [],
      allowAdd: !readonly,
      allowOverlay: true,
      style,
    } as ImageCell
  }

  if (type === ColumnType.LineChart) {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: false,
      copyData: "[]",
      data: {
        kind: "sparkline-cell",
        values: [],
        displayValues: [],
        //color: "#77c4c4",
        graphKind: "line",
        yAxis: [0, 1],
      },
    } as CustomCell
  }

  if (type === ColumnType.BarChart) {
    return {
      kind: GridCellKind.Custom,
      allowOverlay: false,
      copyData: "[]",
      data: {
        kind: "sparkline-cell",
        values: [],
        //color: "#77c4c4",
        graphKind: "bar",
        yAxis: [0, 1],
      },
    } as CustomCell
  }

  if (type === ColumnType.ProgressChart) {
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
  }

  throw new Error(`Unsupported cell type: ${type}`)
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

/**
 * Returns a glide-data-grid compatible cell object based on the
 * cell data from the quiver object. Different types of data will
 * result in different cell types.
 *
 * @param cellTemplate: the empty cell template from the column.
 * @param quiverCell: a dataframe cell object from Quiver.
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
    const themeOverride = {}

    // Extract and apply the font color
    const fontColor = extractCssProperty(quiverCell.cssId, "color", cssStyles)
    if (fontColor) {
      ;(themeOverride as GlideTheme).textDark = fontColor
    }

    // Extract and apply the background color
    const backgroundColor = extractCssProperty(
      quiverCell.cssId,
      "background-color",
      cssStyles
    )
    if (backgroundColor) {
      ;(themeOverride as GlideTheme).bgCell = backgroundColor
    }

    if (themeOverride) {
      // Apply the background and font color in the theme override
      cellTemplate = {
        ...cellTemplate,
        themeOverride,
      }
    }
  }

  if (cellKind === GridCellKind.Text) {
    const formattedContents = getDisplayContent(quiverCell)
    return {
      ...cellTemplate,
      data:
        typeof quiverCell.content === "string" ||
        quiverCell.content === undefined ||
        quiverCell.content === null
          ? quiverCell.content
          : formattedContents,
      displayData: formattedContents,
    } as TextCell
  }

  if (cellKind === GridCellKind.Number) {
    const formattedContents = getDisplayContent(quiverCell)
    let cellData = quiverCell.content

    if (cellData instanceof Int32Array) {
      // int values need to be extracted this way:
      // eslint-disable-next-line prefer-destructuring
      cellData = (cellData as Int32Array)[0]
    }

    return {
      ...cellTemplate,
      data:
        cellData !== undefined && cellData !== null
          ? Number(cellData)
          : undefined,
      displayData: formattedContents,
    } as NumberCell
  }

  if (cellKind === GridCellKind.Boolean) {
    return {
      ...cellTemplate,
      data: quiverCell.content as boolean,
    } as BooleanCell
  }

  if (cellKind === GridCellKind.Bubble) {
    return {
      ...cellTemplate,
      data:
        quiverCell.content !== undefined && quiverCell.content !== null
          ? JSON.parse(JSON.stringify(quiverCell.content))
          : [],
    } as BubbleCell
  }

  if (cellKind === GridCellKind.Image) {
    const imageUrls =
      quiverCell.content !== undefined && quiverCell.content !== null
        ? [String(quiverCell.content)]
        : []

    return {
      ...cellTemplate,
      data: imageUrls,
      displayData: imageUrls,
    } as ImageCell
  }

  if (cellKind === GridCellKind.Uri) {
    return {
      ...cellTemplate,
      data:
        quiverCell.content !== undefined && quiverCell.content !== null
          ? String(quiverCell.content)
          : "",
    } as UriCell
  }

  if (cellKind === "sparkline-cell") {
    const chartData = JSON.parse(
      JSON.stringify(quiverCell.content)
    ) as number[]
    return {
      ...cellTemplate,
      copyData: JSON.stringify(quiverCell.content),
      data: {
        ...(cellTemplate as CustomCell)?.data,
        values: chartData,
        displayValues: chartData.map(x =>
          (Math.round(x * 100) / 100).toString()
        ),
      },
    } as CustomCell
  }

  if (cellKind === "range-cell") {
    return {
      ...cellTemplate,
      copyData: String(quiverCell.content),
      data: {
        ...(cellTemplate as CustomCell)?.data,
        value: quiverCell.content,
        label: `${
          quiverCell.content
            ? Math.round((quiverCell.content as number) * 100).toString()
            : "0"
        }%`,
      },
    } as CustomCell
  }

  throw new Error(`Unsupported cell kind: ${cellKind}`)
}
