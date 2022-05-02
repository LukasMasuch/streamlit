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

import React, {
  ReactElement,
  useState,
  useLayoutEffect,
  useEffect,
} from "react"
import {
  DataEditor as GlideDataEditor,
  GridCell,
  GridCellKind,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"

import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver } from "src/lib/Quiver"
import { logError } from "src/lib/log"

import { getCellTemplate, fillCellTemplate } from "./DataGridCells"
import ThemedDataGridContainer from "./DataGridContainer"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 500

/**
 * The GridColumn type extended with a function to get a template of the given type.
 */
type GridColumnWithCellTemplate = GridColumn & {
  getTemplate(): GridCell
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
      width: 100,
      getTemplate: () => {
        return getCellTemplate(GridCellKind.RowID, true)
      },
    } as GridColumnWithCellTemplate)
    return columns
  }

  const numIndices = element.types?.index?.length ?? 0
  const numColumns = element.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    columns.push({
      id: `index-${i}`,
      // Indices currently have empty titles:
      title: "",
      hasMenu: false,
      width: 100,
      getTemplate: () => {
        return getCellTemplate(GridCellKind.RowID, true)
      },
    } as GridColumnWithCellTemplate)
  }

  for (let i = 0; i < numColumns; i++) {
    const columnTitle = element.columns[0][i]

    const quiverType = element.types.data[i]
    const dataTypeName = quiverType && Quiver.getTypeName(quiverType)

    let cellKind = GridCellKind.Text

    if (!dataTypeName) {
      // Use text cell as fallback
      cellKind = GridCellKind.Text
    } else if (["bool"].includes(dataTypeName)) {
      cellKind = GridCellKind.Boolean
    } else if (["int64", "float64"].includes(dataTypeName)) {
      cellKind = GridCellKind.Number
    } else if (dataTypeName.startsWith("list")) {
      cellKind = GridCellKind.Bubble
    }

    columns.push({
      id: `column-${i}`,
      title: columnTitle,
      hasMenu: false,
      width: 100,
      getTemplate: () => {
        return getCellTemplate(cellKind, true)
      },
    } as GridColumnWithCellTemplate)
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
  "columns" | "getCellContent" | "onColumnResized"
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
  const [columns, setColumns] = useState(() => getColumns(element))

  useEffect(() => {
    // Update columns when the element changes:
    setColumns(getColumns(element))
  }, [element])

  // Number of rows of the table minus 1 for the header row:
  const numRows = element.dimensions.rows - 1
  const numIndices = element.types?.index?.length ?? 0

  const onColumnResized = React.useCallback(
    (column: GridColumn, newSize: number) => {
      setColumns(prevColumns => {
        const index = prevColumns.findIndex(ci => ci.id === column.id)
        const updatedColumns = [...prevColumns]
        updatedColumns.splice(index, 1, {
          ...prevColumns[index],
          width: newSize,
        })
        return updatedColumns
      })
    },
    [columns]
  )

  const getCellContent = React.useCallback(
    ([col, row]: readonly [number, number]): GridCell => {
      const cellTemplate = columns[col].getTemplate()
      if (row > numRows - 1) {
        // TODO(lukasmasuch): This should never happen
        return cellTemplate
      }
      try {
        // Quiver has the index in 1 column and the header in first row
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

  return {
    numRows,
    numIndices,
    columns,
    getCellContent: getCellContentSorted,
    onColumnResized,
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
  const [width, setWidth] = useState(propWidth)
  const [sort, setSort] = React.useState<ColumnSortConfig>()

  const {
    numRows,
    numIndices,
    columns,
    getCellContent,
    onColumnResized,
  } = useDataLoader(element, sort)

  const dataEditorRef = React.useRef<DataEditorRef>(null)

  // useLayoutEffect(() => {
  //   // Without this timeout,the width calculation might fail in a few cases. The timeout ensures
  //   // that the execution of this function is placed after the component render in the event loop.
  //   setTimeout(() => {
  //     // TODO(lukasmasuch): Support use_container_width parameter

  //     let adjustedTableWidth = Math.max(
  //       columns.length * MIN_COLUMN_WIDTH + 3,
  //       MIN_COLUMN_WIDTH + 3
  //     )

  //     if (numRows) {
  //       const firstCell = dataEditorRef.current?.getBounds(0, 0)
  //       const lastCell = dataEditorRef.current?.getBounds(
  //         columns.length - 1,
  //         numRows - 1
  //       )

  //       if (firstCell && lastCell) {
  //         // Calculate the table width, the +2 corresponds to the table borders
  //         adjustedTableWidth = lastCell.x - firstCell.x + lastCell.width + 2

  //         // TODO(lukasmasuch): Also adjust the table height?
  //         // const fullTableHeight = lastCell.y - firstCell.y + lastCell.height + 2
  //       }
  //     }
  //     const newWidth = Math.min(adjustedTableWidth, propWidth)
  //     if (newWidth !== width) {
  //       setWidth(newWidth)
  //     }
  //   }, 0)
  // })

  const onHeaderClick = React.useCallback(
    (index: number) => {
      let sortDirection = "asc"
      const clickedColumn = columns[index]

      if (
        sort &&
        sort.column.id === clickedColumn.id &&
        sort.direction === "asc"
      ) {
        // The clicked column is already sorted ascending, sort descending instead
        sortDirection = "desc"
      }

      setSort({
        column: clickedColumn,
        direction: sortDirection,
        // Smart mode also detects numbers and sorts those correctly:
        mode: "smart",
      } as ColumnSortConfig)
    },
    [sort, columns]
  )

  // Automatic table height calculation: numRows +1 because of header, and +3 pixels for borders
  const height = propHeight || Math.min((numRows + 1) * ROW_HEIGHT + 3, 400)

  // Calculate min height for the resizable container. header + one column, and +3 pixels for borders
  const minHeight = 2 * ROW_HEIGHT + 3

  return (
    <ThemedDataGridContainer
      width={width}
      height={height}
      minHeight={minHeight}
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
        onColumnResized={onColumnResized}
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
        rangeSelect={"none"}
        columnSelect={"none"}
        rowSelect={"none"}
        // Activate search:
        keybindings={{ search: true }}
        // Header click is used for column sorting:
        onHeaderClicked={onHeaderClick}
      />
    </ThemedDataGridContainer>
  )
}

export default withFullScreenWrapper(DataGrid)
