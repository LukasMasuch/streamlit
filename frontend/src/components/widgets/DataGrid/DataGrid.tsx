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

import React, { ReactElement, useState, useLayoutEffect } from "react"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
  GridSelection,
  CompactSelection,
  GridMouseEventArgs,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"

import {
  getCellTemplate,
  fillCellTemplate,
  getColumnSortMode,
  determineColumnType,
  ColumnType,
} from "./DataGridCells"
import ThemedDataGridContainer from "./DataGridContainer"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 500

/**
 * The GridColumn type extended with a function to get a template of the given type.
 */
type GridColumnWithCellTemplate = GridColumn & {
  getTemplate(): GridCell
  columnType: ColumnType
}

interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
}

/**
 * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
 */
export function getColumns(element: Quiver): GridColumnWithCellTemplate[] {
  const columns: GridColumnWithCellTemplate[] = []

  if (element.isEmpty()) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(ColumnType.Text, true, "faded")
      },
      columnType: ColumnType.Text,
    } as GridColumnWithCellTemplate)
    return columns
  }

  const columnsConfig = element.widget.columns
    ? JSON.parse(element.widget.columns)
    : {}

  const numIndices = element.types?.index?.length ?? 0
  const numColumns = element.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    const quiverType = element.types.index[i]
    const columnType = determineColumnType(quiverType)
    columns.push({
      id: `index-${i}`,
      // Indices currently have empty titles:
      title: "",
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(columnType, true, "faded")
      },
      columnType,
    } as GridColumnWithCellTemplate)
  }

  for (let i = 0; i < numColumns; i++) {
    const columnTitle = element.columns[0][i]

    const quiverType = element.types.data[i]
    const columnConfig =
      columnTitle in columnsConfig
        ? (columnsConfig[columnTitle] as ColumnConfigProps)
        : ({} as ColumnConfigProps)

    const columnType = columnConfig.type
      ? (columnConfig.type.toLowerCase() as ColumnType)
      : determineColumnType(quiverType)

    let columnData = {
      id: `column-${columnTitle}-${i}`,
      title: columnConfig.title ? columnConfig.title : columnTitle,
      hasMenu: false,
      getTemplate: () => {
        return getCellTemplate(columnType, true)
      },
      columnType,
    } as GridColumnWithCellTemplate

    if (columnConfig.width) {
      columnData = {
        ...columnData,
        width: columnConfig.width,
      } as GridColumnWithCellTemplate
    }

    columns.push(columnData)
  }
  return columns
}

/**
 * Configuration type for column sorting hook.
 */
type ColumnSortConfig = {
  column: GridColumn
  mode?: "default" | "raw" | "smart"
  direction?: "asc" | "desc"
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = { numRows: number; numIndices: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent" | "onColumnResize"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
export function useDataLoader(
  element: Quiver,
  sort?: ColumnSortConfig | undefined
): DataLoaderReturn {
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSizes, setColumnSizes] = useState<Map<string, number>>(
    () => new Map()
  )

  let columns = getColumns(element)
  columns = columns.map(column => {
    if (column.id && columnSizes.has(column.id)) {
      return {
        ...column,
        width: columnSizes.get(column.id),
      } as GridColumnWithCellTemplate
    }
    return column
  })

  // Number of rows of the table minus 1 for the header row:
  const numRows = element.isEmpty() ? 1 : element.dimensions.rows - 1
  const numIndices = element.types?.index?.length ?? 0

  const onColumnResize = React.useCallback(
    (column: GridColumn, newSize: number) => {
      if (column.id) {
        setColumnSizes(new Map(columnSizes).set(column.id, newSize))
      }
    },
    [columns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      if (element.isEmpty()) {
        return {
          ...getCellTemplate(ColumnType.Text, true, "faded"),
          displayData: "empty",
        } as GridCell
      }

      if (col > columns.length - 1) {
        // This should never happen
        return getCellTemplate(ColumnType.Text, true)
      }

      const cellTemplate = columns[col].getTemplate()
      if (row > numRows - 1) {
        // This should never happen
        return cellTemplate
      }
      try {
        // Quiver has the header in first row
        const quiverCell = element.getCell(row + 1, col)
        return fillCellTemplate(cellTemplate, quiverCell, element.cssStyles)
      } catch (error) {
        // This should not happen in read-only table.
        logError(error)
        return cellTemplate
      }
    },
    [columns, numRows, element]
  )

  const { getCellContent: getCellContentSorted } = useColumnSort({
    columns,
    getCellContent,
    rows: numRows,
    sort,
  })

  if (sort !== undefined) {
    columns = columns.map(column => {
      if (column.id === sort.column.id) {
        return {
          ...column,
          title:
            sort.direction === "asc"
              ? `↑ ${column.title}`
              : `↓ ${column.title}`,
        }
      }
      return column
    })
  }

  return {
    numRows,
    numIndices,
    columns,
    getCellContent: getCellContentSorted,
    onColumnResize,
  }
}
export interface DataGridProps {
  element: Quiver
  height?: number
  width: number
}

function DataGrid({
  element,
  height: propHeight,
  width: propWidth,
}: DataGridProps): ReactElement {
  const extraCellArgs = useExtraCells()

  const [width, setWidth] = useState(propWidth)
  const [sort, setSort] = React.useState<ColumnSortConfig>()

  const {
    numRows,
    numIndices,
    columns,
    getCellContent,
    onColumnResize,
  } = useDataLoader(element, sort)

  const [isFocused, setIsFocused] = React.useState<boolean>(true)

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })

  const dataEditorRef = React.useRef<DataEditorRef>(null)

  const minWidth = MIN_COLUMN_WIDTH + 3

  // TODO: Remove this:
  // useLayoutEffect(() => {
  //   // Without this timeout,the width calculation might fail in a few cases. The timeout ensures
  //   // that the execution of this function is placed after the component render in the event loop.
  //   const timerId = setTimeout(() => {
  //     // TODO(lukasmasuch): Support use_container_width parameter

  //     let adjustedTableWidth = Math.max(
  //       columns.length * MIN_COLUMN_WIDTH + 3,
  //       minWidth
  //     )

  //     console.log("Update size", columns.length, numRows)
  //     if (numRows) {
  //       const firstCell = dataEditorRef.current?.getBounds(0, 0)
  //       const lastCell = dataEditorRef.current?.getBounds(
  //         columns.length - 1,
  //         numRows - 1
  //       )

  //       if (firstCell && lastCell) {
  //         // Calculate the table width, the +2 corresponds to the table borders
  //         adjustedTableWidth = lastCell.x - firstCell.x + lastCell.width + 2
  //       }
  //     }
  //     const newWidth = Math.min(adjustedTableWidth, propWidth)
  //     if (newWidth !== width) {
  //       setWidth(newWidth)
  //     }
  //   }, 0)

  //   return () => window.clearTimeout(timerId)
  // }, [numRows, columns, dataEditorRef, getCellContent])

  const onHeaderClick = React.useCallback(
    (index: number) => {
      let sortDirection = "asc"
      const clickedColumn = columns[index]

      if (sort && sort.column.id === clickedColumn.id) {
        // The clicked column is already sorted
        if (sort.direction === "asc") {
          // Sort column descending
          sortDirection = "desc"
        } else {
          // Remove sorting of column
          setSort(undefined)
          return
        }
      }

      setSort({
        column: clickedColumn,
        direction: sortDirection,
        mode: getColumnSortMode(
          (clickedColumn as GridColumnWithCellTemplate).columnType
        ),
      } as ColumnSortConfig)
    },
    [sort, columns]
  )

  // Calculate min height for the resizable container. header + one column, and +3 pixels for borders
  const minHeight = 2 * ROW_HEIGHT + 3

  // Automatic table height calculation: numRows +1 because of header, and +3 pixels for borders
  let maxHeight = Math.max((numRows + 1) * ROW_HEIGHT + 3, minHeight)
  let height = Math.min(maxHeight, 400)

  if (propHeight) {
    // User has explicitly configured a height
    height = Math.max(propHeight, minHeight)
    maxHeight = Math.max(propHeight, maxHeight)
  }

  return (
    <ThemedDataGridContainer
      width={width}
      height={height}
      minHeight={minHeight}
      maxHeight={maxHeight}
      minWidth={minWidth}
      maxWidth={propWidth}
      onBlur={() => {
        // If the container loses focus, clear the current selection
        if (!isFocused) {
          setGridSelection({
            columns: CompactSelection.empty(),
            rows: CompactSelection.empty(),
            current: undefined,
          } as GridSelection)
        }
      }}
    >
      <GlideDataEditor
        ref={dataEditorRef}
        columns={columns}
        rows={numRows}
        minColumnWidth={MIN_COLUMN_WIDTH}
        maxColumnWidth={MAX_COLUMN_WIDTH}
        rowHeight={ROW_HEIGHT}
        headerHeight={ROW_HEIGHT}
        getCellContent={getCellContent}
        onColumnResized={onColumnResize}
        // Freeze all index columns:
        freezeColumns={numIndices}
        smoothScrollX={true}
        // Only activate smooth mode for vertical scrolling for large tables:
        smoothScrollY={numRows < 100000}
        // Show borders between cells:
        verticalBorder={true}
        // Activate copy to clipboard functionality:
        getCellsForSelection={true}
        // Deactivate row markers and numbers:
        rowMarkers={"none"}
        // Deactivate selections:
        rangeSelect={"rect"}
        columnSelect={"none"}
        rowSelect={"none"}
        // Activate search:
        keybindings={{ search: true }}
        // Header click is used for column sorting:
        onHeaderClicked={onHeaderClick}
        gridSelection={gridSelection}
        onGridSelectionChange={(newSelection: GridSelection) => {
          setGridSelection(newSelection)
        }}
        onMouseMove={(args: GridMouseEventArgs) => {
          // Determine if the dataframe is focused or not
          if (args.kind === "out-of-bounds" && isFocused) {
            setIsFocused(false)
          } else if (args.kind !== "out-of-bounds" && !isFocused) {
            setIsFocused(true)
          }
        }}
        provideEditor={extraCellArgs.provideEditor}
        drawCell={extraCellArgs.drawCell}
      />
    </ThemedDataGridContainer>
  )
}

export default withFullScreenWrapper(DataGrid)
