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

import React, { ReactElement, useState } from "react"
import {
  DataEditor as GlideDataEditor,
  EditableGridCell,
  GridCell,
  GridColumn,
  DataEditorProps,
  DataEditorRef,
  GridSelection,
  CompactSelection,
  GridMouseEventArgs,
  isEditableGridCell,
} from "@glideapps/glide-data-grid"
import { useColumnSort } from "@glideapps/glide-data-grid-source"
import { useExtraCells } from "@glideapps/glide-data-grid-cells"

import { WidgetStateManager } from "src/lib/WidgetStateManager"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import { Quiver, Type as QuiverType, DataType } from "src/lib/Quiver"
import { logError } from "src/lib/log"
import { notNullOrUndefined } from "src/lib/utils"
import { DataEditor as DataEditorProto } from "src/autogen/proto"

import {
  getCellTemplate,
  fillCellTemplate,
  updateCell,
  getColumnSortMode,
  ColumnType,
  getColumnTypeFromConfig,
  getColumnTypeFromQuiver,
} from "./DataFrameCells"
import ThemedDataFrameContainer from "./DataFrameContainer"

const ROW_HEIGHT = 35
const MIN_COLUMN_WIDTH = 35
const MAX_COLUMN_WIDTH = 600
// Min width for the resizable table container:
// Based on one column at minimum width + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_WIDTH = MIN_COLUMN_WIDTH + 3
// Min height for the resizable table container:
// Based on header + one column, and + 2 for borders + 1 to prevent overlap problem with selection ring.
const MIN_TABLE_HEIGHT = 2 * ROW_HEIGHT + 3

/**
 * The GridColumn type extended with a function to get a template of the given type.
 */
type GridColumnWithCellTemplate = GridColumn & {
  // The type of the column.
  columnType: ColumnType
  // The index number of the column.
  columnIndex: number
  // The quiver data type of the column.
  quiverType: QuiverType
  // If `True`, the column can be edited.
  isEditable: boolean
  // If `True`, the column is hidden (will not be shown).
  isHidden: boolean
  // If `True`, the column is a table index.
  isIndex: boolean
}

interface ColumnConfigProps {
  width?: number
  title?: string
  type?: string
  hide?: boolean
  editable?: boolean
}

function applyColumnConfig(
  column: GridColumnWithCellTemplate,
  columnsConfig: Map<string | number, ColumnConfigProps>
): GridColumnWithCellTemplate | null {
  if (!columnsConfig) {
    // No column config configured
    return column
  }

  let columnConfig
  if (columnsConfig.has(column.columnIndex)) {
    columnConfig = columnsConfig.get(column.columnIndex)
  } else if (columnsConfig.has(column.title)) {
    columnConfig = columnsConfig.get(column.title)
  }

  if (!columnConfig) {
    // No column config found for this column
    return column
  }

  if (notNullOrUndefined(columnConfig.hide) && columnConfig.hide === true) {
    // If column is hidden, return null
    return null
  }

  return {
    ...column,
    // Update title:
    ...(notNullOrUndefined(columnConfig.title)
      ? {
          title: columnConfig.title,
        }
      : {}),
    // Update width:
    ...(notNullOrUndefined(columnConfig.width)
      ? {
          width: Math.max(
            Math.min(columnConfig.width, MIN_COLUMN_WIDTH),
            MAX_COLUMN_WIDTH
          ),
        }
      : {}),
    // Update data type:
    ...(notNullOrUndefined(columnConfig.type)
      ? {
          columnType: getColumnTypeFromConfig(columnConfig.type),
        }
      : {}),
    // Update editable state:
    ...(notNullOrUndefined(columnConfig.editable)
      ? {
          isEditable: columnConfig.editable,
        }
      : {}),
  } as GridColumnWithCellTemplate
}
/**
 * Returns a list of glide-data-grid compatible columns based on a Quiver instance.
 */
export function getColumns(
  data: Quiver,
  columnsConfig: Map<string, ColumnConfigProps>
): GridColumnWithCellTemplate[] {
  const columns: GridColumnWithCellTemplate[] = []

  if (data.isEmpty()) {
    // Tables that don't have any columns cause an exception in glide-data-grid.
    // As a workaround, we are adding an empty index column in this case.
    columns.push({
      id: `empty-index`,
      title: "",
      hasMenu: false,
      columnType: ColumnType.Text,
      columnIndex: 0,
      isEditable: false,
      isIndex: true,
    } as GridColumnWithCellTemplate)
    return columns
  }

  const numIndices = data.types?.index?.length ?? 0
  const numColumns = data.columns?.[0]?.length ?? 0

  for (let i = 0; i < numIndices; i++) {
    const quiverType = data.types.index[i]
    const columnType = getColumnTypeFromQuiver(quiverType)

    const column = {
      id: `index-${i}`,
      title: "", // Indices have empty titles as default.
      hasMenu: false,
      columnType,
      quiverType,
      columnIndex: i,
      isEditable: false,
      isHidden: false,
      isIndex: true,
    } as GridColumnWithCellTemplate

    const updatedColumn = applyColumnConfig(column, columnsConfig)
    // If column is hidden, the return value is null.
    if (updatedColumn) {
      columns.push(updatedColumn)
    }
  }

  for (let i = 0; i < numColumns; i++) {
    const columnTitle = data.columns[0][i]
    const quiverType = data.types.data[i]
    const columnType = getColumnTypeFromQuiver(quiverType)

    const column = {
      id: `column-${columnTitle}-${i}`,
      title: columnTitle,
      hasMenu: false,
      columnType,
      quiverType,
      columnIndex: i + numIndices,
      isEditable: false,
      isHidden: false,
      isIndex: false,
    } as GridColumnWithCellTemplate

    const updatedColumn = applyColumnConfig(column, columnsConfig)
    // If column is hidden, the return value is null.
    if (updatedColumn) {
      columns.push(updatedColumn)
    }
  }
  return columns
}

class EditingCache {
  // column -> row -> value
  private cachedContent: Map<number, Map<number, GridCell>> = new Map()

  get(col: number, row: number): GridCell | undefined {
    const colCache = this.cachedContent.get(col)

    if (colCache === undefined) {
      return undefined
    }

    return colCache.get(row)
  }

  set(col: number, row: number, value: GridCell): void {
    if (this.cachedContent.get(col) === undefined) {
      this.cachedContent.set(col, new Map())
    }

    const rowCache = this.cachedContent.get(col) as Map<number, GridCell>
    rowCache.set(row, value)
  }
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
 * Updates the column headers based on the sorting configuration.
 */
function updateSortingHeader(
  columns: GridColumnWithCellTemplate[],
  sort: ColumnSortConfig | undefined
): GridColumnWithCellTemplate[] {
  if (sort === undefined) {
    return columns
  }
  return columns.map(column => {
    if (column.id === sort.column.id) {
      return {
        ...column,
        title:
          sort.direction === "asc" ? `↑ ${column.title}` : `↓ ${column.title}`,
      }
    }
    return column
  })
}

/**
 * Create return type for useDataLoader hook based on the DataEditorProps.
 */
type DataLoaderReturn = { numRows: number; numIndices: number } & Pick<
  DataEditorProps,
  "columns" | "getCellContent" | "onColumnResize" | "onCellEdited"
>

/**
 * A custom hook that handles all data loading capabilities for the interactive data table.
 * This also includes the logic to load and configure columns.
 * And features that influence the data representation and column configuration
 * such as column resizing, sorting, etc.
 */
export function useDataLoader(
  element: DataEditorProto,
  data: Quiver,
  sort?: ColumnSortConfig | undefined
): DataLoaderReturn {
  const editingCache = React.useRef<EditingCache>(new EditingCache())
  // The columns with the corresponding empty template for every type:
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [columnSizes, setColumnSizes] = useState<Map<string, number>>(
    () => new Map()
  )

  const columnsConfig = element.columns
    ? new Map(Object.entries(JSON.parse(element.columns)))
    : new Map()

  const columns = getColumns(data, columnsConfig).map(column => {
    // Apply column widths from state
    if (column.id && columnSizes.has(column.id)) {
      return {
        ...column,
        width: columnSizes.get(column.id),
      } as GridColumnWithCellTemplate
    }
    return column
  })

  // Number of rows of the table minus 1 for the header row:
  const numRows = data.isEmpty() ? 1 : data.dimensions.rows - 1
  const numIndices = data.types?.index?.length ?? 0

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
      if (data.isEmpty()) {
        return {
          ...getCellTemplate(ColumnType.Text, true, true),
          displayData: "empty",
        } as GridCell
      }

      if (col > columns.length - 1) {
        // This should never happen
        return getCellTemplate(ColumnType.Text, true, false)
      }

      // Try to load cell from cache
      const cell = editingCache.current.get(col, row)
      if (notNullOrUndefined(cell)) {
        return cell
      }

      const column = columns[col]
      const cellTemplate = getCellTemplate(
        column.columnType,
        !column.isEditable,
        column.isIndex
      )

      if (row > numRows - 1) {
        // This should never happen
        return cellTemplate
      }

      try {
        // Quiver has the header in first row
        const quiverCell = data.getCell(row + 1, column.columnIndex)
        return fillCellTemplate(cellTemplate, quiverCell, data.cssStyles)
      } catch (error) {
        // This should not happen in read-only table.
        logError(error)
        return cellTemplate
      }
    },
    [columns, numRows, data]
  )

  const {
    getCellContent: getCellContentSorted,
    getOriginalIndex,
  } = useColumnSort({
    columns,
    getCellContent,
    rows: numRows,
    sort,
  })

  const updatedColumns = updateSortingHeader(columns, sort)

  const onCellEdited = React.useCallback(
    (
      [col, row]: readonly [number, number],
      newVal: EditableGridCell
    ): void => {
      // TODO: check if editable
      // if (element.editable === false || element.disabled === true) {
      //   return
      // }

      const currentCell = getCellContentSorted([col, row])

      if (!isEditableGridCell(newVal) || !isEditableGridCell(currentCell)) {
        return
      }

      // TODO: check if type is compatible with DataType instead
      if (
        typeof newVal.data === "string" ||
        typeof newVal.data === "number" ||
        typeof newVal.data === "boolean"
      ) {
        // TODO: support display values
        editingCache.current.set(
          col,
          getOriginalIndex(row),
          updateCell(currentCell, newVal.data as DataType)
        )
      }
    },
    [columns]
  )

  return {
    numRows,
    numIndices,
    columns: updatedColumns,
    getCellContent: getCellContentSorted,
    onColumnResize,
    onCellEdited,
  }
}
export interface DataFrameProps {
  element: DataEditorProto
  data: Quiver
  widgetMgr: WidgetStateManager
  disabled: boolean
  height?: number
  width: number
}

function DataFrame({
  element,
  data,
  widgetMgr,
  disabled,
  height: propHeight,
  width: propWidth,
}: DataFrameProps): ReactElement {
  const extraCellArgs = useExtraCells()
  const [sort, setSort] = React.useState<ColumnSortConfig>()

  const {
    numRows,
    numIndices,
    columns,
    getCellContent,
    onColumnResize,
    onCellEdited,
  } = useDataLoader(element, data, sort)

  const [isFocused, setIsFocused] = React.useState<boolean>(true)

  const [gridSelection, setGridSelection] = React.useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })

  const dataEditorRef = React.useRef<DataEditorRef>(null)

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

  // Automatic table height calculation: numRows +1 because of header, and +3 pixels for borders
  let maxHeight = Math.max((numRows + 1) * ROW_HEIGHT + 3, MIN_TABLE_HEIGHT)
  let height = Math.min(maxHeight, 400)

  if (propHeight) {
    // User has explicitly configured a height
    height = Math.max(propHeight, MIN_TABLE_HEIGHT)
    maxHeight = Math.max(propHeight, maxHeight)
  }

  return (
    <ThemedDataFrameContainer
      width={propWidth}
      height={height}
      minHeight={MIN_TABLE_HEIGHT}
      maxHeight={maxHeight}
      minWidth={MIN_TABLE_WIDTH}
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
        experimental={{
          // We use an overlay scrollbar, so no need to have space for reserved for the scrollbar:
          scrollbarWidthOverride: 1,
        }}
        // Add support for additional cells:
        provideEditor={extraCellArgs.provideEditor}
        drawCell={extraCellArgs.drawCell}
        // Support editing:
        onCellEdited={onCellEdited}
      />
    </ThemedDataFrameContainer>
  )
}

export default withFullScreenWrapper(DataFrame)
